import { Dropbox } from 'dropbox'
import { getDropboxToken } from './auth-tokens'

export class DropboxService {
  private client: Dropbox

  constructor(accessToken: string) {
    this.client = new Dropbox({ accessToken })
  }

  // Get or create client folder in Dropbox
  async getOrCreateClientFolder(clientName: string): Promise<string> {
    const normalizedName = this.normalizeClientName(clientName)
    const folderPath = `/Scans/${normalizedName}`

    try {
      // Check if folder exists
      await this.client.filesGetMetadata({ path: folderPath })
      return folderPath
    } catch {
      // Create folder if it doesn't exist
      await this.client.filesCreateFolderV2({ path: folderPath })
      return folderPath
    }
  }

  // Upload file to /Scans/Queue for staging (resume-safe)
  async uploadToQueue(
    scanJobId: string,
    fileData: Buffer,
    originalFileName: string,
  ): Promise<string> {
    const folder = await this.getOrCreateFolder('/Scans/Queue')
    const sanitized = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const queuePath = `${folder}/${scanJobId}_${sanitized}`

    await this.client.filesUpload({
      path: queuePath,
      contents: fileData,
      mode: { '.tag': 'overwrite' },
    })

    return queuePath
  }

  // Move a file from one path to another (Queue → /Scans/{clientFolder}/)
  async moveFile(
    fromPath: string,
    toFolder: string,
    newFileName: string,
  ): Promise<string> {
    const folder = await this.getOrCreateClientFolder(toFolder)
    const sanitized = newFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const toPath = `${folder}/${sanitized}`

    const result = await this.client.filesMoveV2({
      from_path: fromPath,
      to_path: toPath,
      autorename: true,
    })

    // Return actual path (autorename may change it)
    const metadata = result.result.metadata as { path_display?: string }
    return metadata.path_display || toPath
  }

  // Move a file to /Scans/Unknown_Clients/{subFolder}/ for unmatched physical scans
  async moveFileToUnknown(
    fromPath: string,
    subFolder: string,
    newFileName: string,
  ): Promise<string> {
    const normalizedSub = this.normalizeClientName(subFolder)
    const folderPath = `/Scans/Unknown_Clients/${normalizedSub}`
    await this.getOrCreateFolder('/Scans/Unknown_Clients')
    await this.getOrCreateFolder(folderPath)

    const sanitized = newFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const toPath = `${folderPath}/${sanitized}`

    const result = await this.client.filesMoveV2({
      from_path: fromPath,
      to_path: toPath,
      autorename: true,
    })

    const metadata = result.result.metadata as { path_display?: string }
    return metadata.path_display || toPath
  }

  // Upload file directly to client folder (legacy/direct path)
  async uploadFile(
    clientName: string,
    fileData: Buffer,
    fileName: string,
  ): Promise<{ path: string; folder: string }> {
    const folder = await this.getOrCreateClientFolder(clientName)
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${folder}/${sanitized}`

    const result = await this.client.filesUpload({
      path: filePath,
      contents: fileData,
      mode: { '.tag': 'add' },
      autorename: true,
    })

    // Return actual path (autorename may change it)
    return { path: result.result.path_display || filePath, folder }
  }

  // Get or create any arbitrary folder
  async getOrCreateFolder(folderPath: string): Promise<string> {
    try {
      await this.client.filesGetMetadata({ path: folderPath })
      return folderPath
    } catch {
      await this.client.filesCreateFolderV2({ path: folderPath })
      return folderPath
    }
  }

  // Delete a file from Queue after successful move
  async deleteQueueFile(path: string): Promise<void> {
    try {
      await this.client.filesDeleteV2({ path })
    } catch {
      // Ignore — file may already have been moved/deleted
    }
  }

  // List all client folders
  async listClientFolders(): Promise<Array<string>> {
    try {
      const response = await this.client.filesListFolder({
        path: '/Scans',
        recursive: false,
      })

      return response.result.entries
        .filter((entry) => entry['.tag'] === 'folder')
        .map((entry) => entry.name)
    } catch {
      // Scans folder doesn't exist yet
      return []
    }
  }

  // List files for a specific client
  async listClientFiles(
    clientName: string,
  ): Promise<
    Array<{ name: string; path: string; size: number; modified: string }>
  > {
    const folderPath = `/Scans/${this.normalizeClientName(clientName)}`

    try {
      const response = await this.client.filesListFolder({
        path: folderPath,
        recursive: false,
      })

      return response.result.entries
        .filter((entry) => entry['.tag'] === 'file')
        .map((entry) => {
          const file = entry as unknown as {
            name: string
            path_display?: string
            path_lower?: string
            size?: number
            client_modified?: string
            server_modified?: string
          }
          return {
            name: file.name,
            path: file.path_display || file.path_lower || '',
            size: file.size || 0,
            modified: file.client_modified || file.server_modified || '',
          }
        })
    } catch {
      return []
    }
  }

  // Download file
  async downloadFile(path: string): Promise<Buffer> {
    const response = await this.client.filesDownload({ path })
    const fileBinary = (response.result as unknown as { fileBinary: Buffer })
      .fileBinary
    return fileBinary
  }

  // Delete file
  async deleteFile(path: string): Promise<void> {
    await this.client.filesDeleteV2({ path })
  }

  // Get account info
  async getAccountInfo(): Promise<{ id: string; email: string; name: string }> {
    const response = await this.client.usersGetCurrentAccount()
    return {
      id: response.result.account_id,
      email: response.result.email,
      name: response.result.name.display_name,
    }
  }

  // Initialize cursor for /Scanned folder — call once per account to establish baseline.
  // Returns the cursor WITHOUT processing existing files (safe first-run).
  async initScannedFolderCursor(): Promise<string> {
    await this.getOrCreateFolder('/Scanned')
    const result = await this.client.filesListFolder({
      path: '/Scanned',
      recursive: false,
    })
    // Page through to get the latest cursor without returning entries
    let cursor = result.result.cursor
    let hasMore = result.result.has_more
    while (hasMore) {
      const cont = await this.client.filesListFolderContinue({ cursor })
      cursor = cont.result.cursor
      hasMore = cont.result.has_more
    }
    return cursor
  }

  // Poll for new changes using a stored cursor. Returns new file entries + updated cursor.
  async getScannedFolderChanges(cursor: string): Promise<{
    entries: Array<{
      tag: string
      name: string
      pathLower: string
      pathDisplay: string
    }>
    cursor: string
    hasMore: boolean
  }> {
    const result = await this.client.filesListFolderContinue({ cursor })
    const entries = result.result.entries
      .filter((e) => e['.tag'] === 'file')
      .map((e) => {
        const f = e as unknown as {
          name: string
          path_lower?: string
          path_display?: string
        }
        return {
          tag: 'file',
          name: f.name,
          pathLower: f.path_lower || '',
          pathDisplay: f.path_display || f.path_lower || '',
        }
      })
    return {
      entries,
      cursor: result.result.cursor,
      hasMore: result.result.has_more,
    }
  }

  // Normalize client name for folder naming
  // Preserves underscores and digits (e.g. "John_Smith_25146161")
  private normalizeClientName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80)
  }
}

// Factory to create service using shared firm-wide Dropbox token from better-auth
export async function createDropboxService(): Promise<DropboxService | null> {
  const token = await getDropboxToken()
  if (!token) {
    return null
  }
  return new DropboxService(token)
}
