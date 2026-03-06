import { Worker } from 'bullmq'
import type { DocketwiseJobData } from '@/lib/queues'
import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { publishJobUpdate } from '@/lib/redis'

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}

// Docketwise API client
class DocketwiseClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async uploadDocument(
    matterId: string,
    fileName: string,
    fileData: Buffer,
    description?: string,
  ): Promise<{ id: string; url: string }> {
    // Convert buffer to base64 for API
    const base64Data = fileData.toString('base64')

    const response = await fetch('https://api.docketwise.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matter_id: matterId,
        filename: fileName,
        file_data: base64Data,
        description:
          description ||
          `Uploaded via Dropbox Scanner on ${new Date().toISOString()}`,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Docketwise API error: ${error}`)
    }

    const data = await response.json()
    return { id: data.id, url: data.url }
  }

  async getMatters(): Promise<
    Array<{ id: string; title: string; client_name: string }>
  > {
    const response = await fetch('https://api.docketwise.com/v1/matters', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch matters from Docketwise')
    }

    const data = await response.json()
    return data.matters || []
  }
}

// Docketwise sync worker
export const docketwiseWorker = new Worker<DocketwiseJobData>(
  'docketwise-sync',
  async (job: Job<DocketwiseJobData>) => {
    const { scanJobId, userId, filePath, matterId, fileName } = job.data

    try {
      // Update job progress
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { progress: 70, stage: 'docketwise' },
      })
      await publishJobUpdate(scanJobId, { progress: 70, stage: 'docketwise' })

      // Get Docketwise access token from user's accounts
      const account = await prisma.accounts.findFirst({
        where: {
          userId,
          providerId: 'docketwise',
        },
      })

      if (!account?.accessToken) {
        throw new Error('Docketwise account not connected')
      }

      const docketwise = new DocketwiseClient(account.accessToken)

      // Download file from Dropbox for upload to Docketwise
      const dropboxService = await import('@/lib/dropbox-service').then((m) =>
        m.createDropboxService(userId),
      )

      if (!dropboxService) {
        throw new Error('Dropbox service not available')
      }

      const fileData = await (await dropboxService).downloadFile(filePath)

      // Upload to Docketwise
      const doc = await docketwise.uploadDocument(
        matterId || '',
        fileName,
        fileData,
        `Synced from Dropbox: ${filePath}`,
      )

      // Update job with Docketwise document ID
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { docketwiseDocId: doc.id },
      })

      // Update file metadata
      await prisma.fileMetadata.update({
        where: { scanJobId },
        data: { docketwiseDocId: doc.id },
      })

      await publishJobUpdate(scanJobId, {
        docketwiseDocId: doc.id,
        progress: 85,
      })

      return { success: true, docketwiseDocId: doc.id }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Docketwise sync failed'
      console.error('Docketwise sync error:', error)
      throw new Error(errorMessage)
    }
  },
  {
    connection,
    concurrency: 2,
  },
)

docketwiseWorker.on('failed', (job, err) => {
  console.error(`Docketwise job ${job?.id} failed:`, err)
})
