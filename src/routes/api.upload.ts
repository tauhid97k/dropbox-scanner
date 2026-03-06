import { createHash } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { aiService } from '@/lib/ai-service'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fileQueue } from '@/lib/queues'

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Check authentication using better-auth
          const session = await auth.api.getSession({
            headers: request.headers,
          })

          if (!session) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Parse multipart form data
          const formData = await request.formData()
          const file = formData.get('file') as File | null
          const selectedClient = formData.get('selectedClient') as string | null
          const selectedMatter = formData.get('selectedMatter') as string | null

          if (!file) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Convert file to buffer
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Generate content hash for deduplication
          const contentHash = createHash('sha256').update(buffer).digest('hex')

          // Check if file already processed
          const existingJob = await prisma.ScanJobs.findFirst({
            where: { contentHash },
          })

          if (existingJob) {
            return new Response(
              JSON.stringify({
                error: 'File already processed',
                jobId: existingJob.id,
                status: existingJob.status,
              }),
              {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Create scan job record
          const scanJob = await prisma.ScanJobs.create({
            data: {
              userId: session.user.id,
              originalName: file.name,
              contentHash,
              mimeType: file.type,
              fileSize: file.size,
              status: 'pending',
              progress: 0,
              selectedClient: selectedClient || undefined,
              selectedMatter: selectedMatter || undefined,
            },
          })

          // Convert to base64 for queue
          const base64Data = buffer.toString('base64')

          // Add to file processing queue
          await fileQueue.add('process-file', {
            scanJobId: scanJob.id,
            userId: session.user.id,
            fileData: base64Data,
            originalName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            contentHash,
            selectedClient: selectedClient || undefined,
            selectedMatter: selectedMatter || undefined,
          })

          // If no client selected, get AI suggestion
          let aiSuggestion = null
          if (!selectedClient) {
            const analysis = await aiService.analyzeDocument(buffer, file.name)
            aiSuggestion = {
              clientName: analysis.clientName,
              matterType: analysis.matterType,
              confidence: analysis.confidence,
            }

            // Update job with AI suggestion
            await prisma.ScanJobs.update({
              where: { id: scanJob.id },
              data: {
                suggestedClient: analysis.clientName,
                suggestedMatter: analysis.matterType,
                aiConfidence: analysis.confidence,
              },
            })
          }

          return new Response(
            JSON.stringify({
              success: true,
              jobId: scanJob.id,
              status: 'pending',
              aiSuggestion,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('Upload error:', error)
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Upload failed',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
