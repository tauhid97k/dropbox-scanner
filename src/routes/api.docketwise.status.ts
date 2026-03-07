import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { isDocketwiseConnected, isDropboxConnected } from '@/lib/auth-tokens'

export const Route = createFileRoute('/api/docketwise/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Check authentication
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const [docketwiseConnected, dropboxConnected] = await Promise.all([
            isDocketwiseConnected(),
            isDropboxConnected(),
          ])

          return new Response(
            JSON.stringify({
              docketwise: docketwiseConnected,
              dropbox: dropboxConnected,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error checking connection status:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to check connection status' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
