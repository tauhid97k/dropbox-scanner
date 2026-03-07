import { auth } from '@/lib/auth'
import { createDropboxService } from '@/lib/dropbox-service'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/dropbox/download')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const url = new URL(request.url)
        const path = url.searchParams.get('path')

        if (!path) {
          return new Response(JSON.stringify({ error: 'No path provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const dropbox = await createDropboxService()
          if (!dropbox) {
            return new Response(
              JSON.stringify({ error: 'Dropbox not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const fileBuffer = await dropbox.downloadFile(path)
          const fileName = path.split('/').pop() || 'download'
          const uint8 = new Uint8Array(fileBuffer)

          return new Response(uint8, {
            status: 200,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Content-Length': String(uint8.length),
            },
          })
        } catch (error) {
          console.error('Error downloading file:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to download file',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
