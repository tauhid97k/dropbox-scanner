import { auth } from '@/lib/auth'
import { createDocketwiseService } from '@/lib/docketwise-service'
import { createDropboxService } from '@/lib/dropbox-service'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'
import { createHash } from 'node:crypto'
import { extname } from 'node:path'

export const Route = createFileRoute('/api/docketwise/upload' as any)({
  server: {
    handlers: {
      // POST /api/docketwise/upload
      // Downloads a file from Dropbox by path, uploads it directly to Docketwise.
      // Used by the "Upload to Docketwise" icon on the Files page.
      POST: async ({ request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let body: {
          filePath?: string
          fileName?: string
          clientId?: string
          clientName?: string
          matterId?: string
          matterName?: string
        }

        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { filePath, fileName, clientId, matterId } = body

        if (!filePath || !fileName) {
          return new Response(
            JSON.stringify({ error: 'filePath and fileName are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (!clientId || !matterId) {
          return new Response(
            JSON.stringify({ error: 'clientId and matterId are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const numericClientId = parseInt(clientId, 10)
        const numericMatterId = parseInt(matterId, 10)

        if (isNaN(numericClientId) || isNaN(numericMatterId)) {
          return new Response(
            JSON.stringify({
              error: 'clientId and matterId must be numeric Docketwise IDs',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        try {
          // Download from Dropbox
          const dropbox = await createDropboxService()
          if (!dropbox) {
            return new Response(
              JSON.stringify({ error: 'Dropbox not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const fileBuffer = await dropbox.downloadFile(filePath)
          const base64Data = fileBuffer.toString('base64')

          // Upload to Docketwise
          const docketwise = await createDocketwiseService()
          if (!docketwise) {
            return new Response(
              JSON.stringify({ error: 'Docketwise not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const doc = await docketwise.uploadDocument({
            title: fileName,
            filename: fileName,
            base64Data,
            clientId: numericClientId,
            matterId: numericMatterId,
            description: `Uploaded via Dropbox Scanner on ${new Date().toISOString()}`,
          })

          const docketwiseDocId = String(doc.id)

          // ─── Track in DB ───
          // Resolve local Matters ULID from Docketwise matter ID (best-effort)
          const localMatter = await prisma.matters.findFirst({
            where: { docketwiseId: String(numericMatterId) },
            select: { id: true },
          })

          // Content hash for dedup — use Dropbox path as a stable key
          const contentHash = createHash('sha256')
            .update(`docketwise-push:${filePath}`)
            .digest('hex')

          // Detect MIME type from extension
          const ext = extname(fileName).toLowerCase()
          const mimeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
            '.doc': 'application/msword',
            '.docx':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }
          const mimeType = mimeMap[ext] ?? 'application/octet-stream'

          const scanJob = await prisma.scanJobs.create({
            data: {
              userId: session.user.id,
              originalName: fileName,
              contentHash,
              mimeType,
              fileSize: fileBuffer.length,
              status: 'completed',
              progress: 100,
              stage: 'docketwise',
              source: 'docketwise-push',
              clientName: body.clientName || null,
              selectedMatter: String(numericMatterId),
              matterName: body.matterName || null,
              uploadToDocketwise: true,
              dropboxPath: filePath,
              docketwiseDocId,
            },
          })

          await prisma.fileMetadata.create({
            data: {
              scanJobId: scanJob.id,
              dropboxPath: filePath,
              docketwiseDocId,
              matterId: localMatter?.id ?? null,
              clientName: body.clientName || 'Unknown',
              fileName,
              fileType: mimeType,
              uploadedBy: session.user.id,
            },
          })

          return new Response(
            JSON.stringify({ success: true, docketwiseDocId }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('[DocketwiseUpload] Error:', error)
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Upload failed',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
