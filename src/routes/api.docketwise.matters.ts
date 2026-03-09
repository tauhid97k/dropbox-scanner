import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { createDocketwiseService } from '@/lib/docketwise-service'

export const Route = createFileRoute('/api/docketwise/matters')({
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
        const filter = url.searchParams.get('filter') || undefined
        const clientIdParam = url.searchParams.get('client_id')
        const clientId = clientIdParam ? parseInt(clientIdParam, 10) : undefined
        const perPage = parseInt(url.searchParams.get('per_page') || '200')

        try {
          const service = await createDocketwiseService()
          if (!service) {
            return new Response(
              JSON.stringify({ error: 'Docketwise not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const result = await service.getMatters(
            page,
            filter,
            clientId,
            perPage,
          )

          return new Response(
            JSON.stringify({
              matters: result.matters,
              pagination: result.pagination,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error fetching matters:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to fetch matters',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
