import { Worker } from 'bullmq'
import type { FileJobData } from '@/lib/queues'
import type { Job } from 'bullmq'
import { aiService } from '@/lib/ai-service'
import { createDropboxService } from '@/lib/dropbox-service'
import { prisma } from '@/lib/prisma'
import { publishJobUpdate } from '@/lib/redis'

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

      // If no client selected, use AI to suggest
      let clientName = selectedClient
      let matterType = selectedMatter ?? undefined

      if (!clientName) {
        // Analyze document with Gemini
        const analysis = await aiService.analyzeDocument(buffer, originalName)
        clientName = analysis.clientName || 'unknown_client'
        matterType = analysis.matterType ?? undefined

        // Update job with AI suggestions
        await prisma.scanJobs.update({
          where: { id: scanJobId },
          data: {
            suggestedClient: analysis.clientName,
            suggestedMatter: analysis.matterType,
            aiConfidence: analysis.confidence,
            selectedClient: clientName,
            selectedMatter: matterType,
          },
        })
      }

      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { progress: 30, stage: 'dropbox' },
      })
      await publishJobUpdate(scanJobId, { progress: 30, stage: 'dropbox' })

      // Upload to Dropbox
      const dropbox = await createDropboxService(job.data.userId)
      if (!dropbox) {
        throw new Error('Dropbox not connected')
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
      await publishJobUpdate(scanJobId, { progress: 60, dropboxPath })

      // Create file metadata record
      await prisma.fileMetadata.create({
        data: {
          scanJobId,
          dropboxPath,
          clientName,
          fileName: originalName,
          fileType: job.data.mimeType,
          uploadedBy: job.data.userId,
        },
      })

      // Mark job as completed
      await prisma.scanJobs.update({
        where: { id: scanJobId },
        data: { status: 'completed', progress: 100, stage: 'completed' },
      })
      await publishJobUpdate(scanJobId, {
        progress: 100,
        stage: 'completed',
        status: 'completed',
      })

      // Return result for potential Docketwise sync
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
