import { createDocketwiseService } from '@/lib/docketwise-service'
import { prisma } from '@/lib/prisma'
import type { DocketwiseJobData } from '@/lib/queues'
import { getEmailQueue } from '@/lib/queues'
import { publishJobUpdate } from '@/lib/redis'
import type { Job } from 'bullmq'
import { Worker } from 'bullmq'

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}

// Docketwise sync worker
export const docketwiseWorker = new Worker<DocketwiseJobData>(
  'docketwise-sync',
  async (job: Job<DocketwiseJobData>) => {
    const { scanJobId, userId, clientName, matterId, fileName, fileData } =
      job.data

    try {
      // Update job progress
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { progress: 70, stage: 'docketwise' },
      })
      await publishJobUpdate(scanJobId, { progress: 70, stage: 'docketwise' })

      // Create Docketwise service using shared firm-wide token
      const docketwise = await createDocketwiseService()
      if (!docketwise) {
        throw new Error('Docketwise not connected. Please connect in Settings.')
      }

      // Use the base64 data passed from file-worker (avoids re-downloading from Dropbox)
      if (!fileData) {
        throw new Error('File data not available for Docketwise upload')
      }

      // Upload document to Docketwise API
      // Uses the correct API format: { document: { title, filename, base64_data, client_id, matter_id } }
      const doc = await docketwise.uploadDocument({
        title: fileName,
        filename: fileName,
        base64Data: fileData,
        clientId: parseInt(clientName, 10), // clientName is actually the Docketwise contact ID
        matterId: matterId ? parseInt(matterId, 10) : undefined,
        description: `Uploaded via Dropbox Scanner on ${new Date().toISOString()}`,
      })

      const docId = String(doc.id)

      // Update job with Docketwise document ID
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: {
          docketwiseDocId: docId,
          progress: 90,
          stage: 'email',
        },
      })

      // Update file metadata
      await prisma.fileMetadata.update({
        where: { scanJobId },
        data: { docketwiseDocId: docId },
      })

      await publishJobUpdate(scanJobId, {
        docketwiseDocId: docId,
        progress: 90,
        stage: 'email',
      })

      // Enqueue success email notification
      const emailSettings = await prisma.emailSettings.findFirst({
        where: { userId },
      })
      if (
        emailSettings?.notifyOnUpload &&
        emailSettings.recipients.length > 0
      ) {
        const emailQueue = await getEmailQueue()
        await emailQueue.add('send-notification', {
          to: emailSettings.recipients,
          subject: `File Uploaded: ${fileName}`,
          template: 'upload-success' as const,
          data: {
            clientName,
            fileName,
            uploadedBy: userId,
            dropboxPath: job.data.filePath,
            docketwiseDocId: docId,
          },
        })
      }

      // Mark scan job as completed
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { status: 'completed', progress: 100, stage: 'completed' },
      })
      await publishJobUpdate(scanJobId, {
        progress: 100,
        stage: 'completed',
        status: 'completed',
      })

      return { success: true, docketwiseDocId: docId }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Docketwise sync failed'
      console.error('Docketwise sync error:', error)

      // Update scan job with error
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: {
          status: 'failed',
          errorMessage,
          stage: 'docketwise',
        },
      })
      await publishJobUpdate(scanJobId, {
        status: 'failed',
        error: errorMessage,
      })

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

docketwiseWorker.on('completed', (job) => {
  console.log(`Docketwise job ${job.id} completed`)
})
