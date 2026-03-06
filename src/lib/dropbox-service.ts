import { Dropbox } from 'dropbox'
import { prisma } from './prisma'

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
        .map((entry) => ({
          name: entry.name,
          path: entry.path_display || entry.path_lower || '',
          size: (entry as { size: number }).size || 0,
          modified: entry.client_modified || entry.server_modified || '',
        }))
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
  private normalizeClientName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  // Generate timestamped filename
  private generateTimestampedFilename(originalName: string): string {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    return `${timestamp}_${sanitized}`
  }
}

// Factory to create service with user's stored tokens
export async function createDropboxService(
  userId: string,
): Promise<DropboxService | null> {
  const account = await prisma.DropboxAccounts.findUnique({
    where: { userId },
  })

  if (!account) {
    return null
  }

  // Check if token is expired and needs refresh
  if (account.expiresAt && account.expiresAt < new Date()) {
    // Token refresh logic would go here
    // For now, we'll just use the existing token
    // Dropbox tokens are typically long-lived
  }

  return new DropboxService(account.accessToken)
}
