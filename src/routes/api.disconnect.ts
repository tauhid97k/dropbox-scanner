import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/disconnect')({
  server: {
    handlers: {
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

        try {
          const body = await request.json()
          const provider = body.provider as string

          if (!provider || !['docketwise', 'dropbox'].includes(provider)) {
            return new Response(
              JSON.stringify({ error: 'Invalid provider' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // Delete ALL accounts for this provider (firm-wide disconnect)
          await prisma.accounts.deleteMany({
            where: {
              providerId: provider,
            },
          })

          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Disconnect error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to disconnect' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
