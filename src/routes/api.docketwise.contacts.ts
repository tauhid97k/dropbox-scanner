import { auth } from '@/lib/auth'
import { createDocketwiseService } from '@/lib/docketwise-service'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/docketwise/contacts')({
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

        const url = new URL(request.url)
        const page = parseInt(url.searchParams.get('page') || '1')
        const type = url.searchParams.get('type') as
          | 'Person'
          | 'Institution'
          | null
        const filter = url.searchParams.get('filter') || undefined

        try {
          const service = await createDocketwiseService()
          if (!service) {
            return new Response(
              JSON.stringify({ error: 'Docketwise not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const result = await service.getContacts(
            page,
            type || undefined,
            filter,
          )

          return new Response(
            JSON.stringify({
              contacts: result.contacts,
              pagination: result.pagination,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error fetching contacts:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to fetch contacts',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
