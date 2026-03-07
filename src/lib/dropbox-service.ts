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

  // Upload file to client folder
  async uploadFile(
    clientName: string,
    fileData: Buffer,
    originalFilename: string,
  ): Promise<{ path: string; folder: string }> {
    const folder = await this.getOrCreateClientFolder(clientName)
    const newFilename = this.generateTimestampedFilename(originalFilename)
    const filePath = `${folder}/${newFilename}`

    await this.client.filesUpload({
      path: filePath,
      contents: fileData,
      mode: { '.tag': 'add' },
      autorename: true,
    })

    return { path: filePath, folder }
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

  // Normalize client name for folder naming
  // Preserves underscores and digits (e.g. "John_Smith_25146161")
  private normalizeClientName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80)
  }

  // Generate timestamped filename
  private generateTimestampedFilename(originalName: string): string {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    return `${timestamp}_${sanitized}`
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
