import { auth } from '@/lib/auth'
import { createDropboxService } from '@/lib/dropbox-service'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/dropbox/files')({
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
        const folder = url.searchParams.get('folder') || undefined

        try {
          const dropbox = await createDropboxService()
          if (!dropbox) {
            return new Response(
              JSON.stringify({ error: 'Dropbox not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (folder) {
            // List files within a specific client folder
            const files = await dropbox.listClientFiles(folder)
            return new Response(
              JSON.stringify({ files, folder }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // List all client folders under /Scans
          const folders = await dropbox.listClientFolders()
          return new Response(
            JSON.stringify({ folders }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error listing Dropbox files:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list files',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
