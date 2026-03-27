import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/contacts/$contactId')({
  server: {
    handlers: {
      // GET /api/contacts/:contactId — single contact by ULID
      GET: async ({ request, params }) => {
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
          const contact = await prisma.contacts.findUnique({
            where: { id: params.contactId },
          })

          if (!contact) {
            return new Response(
              JSON.stringify({ error: 'Contact not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            )
          }

          return new Response(JSON.stringify({ contact }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error fetching contact:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to fetch contact',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
