import { createDropboxService } from '@/lib/dropbox-service'
import { prisma } from '@/lib/prisma'
import type { FileJobData } from '@/lib/queues'
import { docketwiseQueue, emailQueue } from '@/lib/queues'
import { publishJobUpdate } from '@/lib/redis'
import type { Job } from 'bullmq'
import { Worker } from 'bullmq'

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}

// File processing worker
export const fileWorker = new Worker<FileJobData>(
  'file-processing',
  async (job: Job<FileJobData>) => {
    const {
      scanJobId,
      fileData,
      originalName,
      mimeType,
      userId,
      selectedClient,
      selectedMatter,
    } = job.data

    try {
      // Update job status to processing
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { status: 'processing', progress: 10, stage: 'ai-analysis' },
      })
      await publishJobUpdate(scanJobId, { progress: 10, stage: 'ai-analysis' })

      // Decode file data
      const buffer = Buffer.from(fileData, 'base64')

      let clientName = selectedClient || 'unknown_client'
      const matterType = selectedMatter ?? undefined

      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { progress: 30, stage: 'dropbox' },
      })
      await publishJobUpdate(scanJobId, { progress: 30, stage: 'dropbox' })

      // Upload to Dropbox (shared firm-wide token)
      const dropbox = await createDropboxService()
      if (!dropbox) {
        throw new Error(
          'Dropbox not connected. Please connect Dropbox in Settings.',
        )
      }

      const { path: dropboxPath } = await dropbox.uploadFile(
        clientName,
        buffer,
        originalName,
      )

      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { progress: 60, dropboxPath },
      })
      await publishJobUpdate(scanJobId, {
        progress: 60,
        stage: 'docketwise',
        dropboxPath,
      })

      // Create file metadata record
      await prisma.fileMetadata.create({
        data: {
          scanJobId,
          dropboxPath,
          clientName,
          fileName: originalName,
          fileType: mimeType,
          uploadedBy: userId,
        },
      })

      // Enqueue Docketwise upload job
      await docketwiseQueue.add('upload-document', {
        scanJobId,
        userId,
        filePath: dropboxPath,
        clientName,
        matterId: selectedMatter,
        fileName: originalName,
        fileData, // pass base64 data so docketwise worker doesn't need to re-download
      })

      // Return result
      return {
        success: true,
        dropboxPath,
        clientName,
        matterType,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: {
          status: 'failed',
          errorMessage,
          retryCount: { increment: 1 },
        },
      })
      await publishJobUpdate(scanJobId, {
        status: 'failed',
        error: errorMessage,
      })

      // Enqueue error notification email
      const emailSettings = await prisma.emailSettings.findFirst({
        where: { userId },
      })
      if (emailSettings?.notifyOnError && emailSettings.recipients.length > 0) {
        await emailQueue.add('send-notification', {
          to: emailSettings.recipients,
          subject: `File Upload Failed: ${originalName}`,
          template: 'upload-error' as const,
          data: { fileName: originalName, error: errorMessage },
        })
      }

      throw error
    }
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
)

// Handle worker errors
fileWorker.on('failed', (job, err) => {
  console.error(`File job ${job?.id} failed:`, err)
})

fileWorker.on('completed', (job) => {
  console.log(`File job ${job.id} completed`)
})
