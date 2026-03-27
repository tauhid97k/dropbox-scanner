import { auth } from '@/lib/auth'
import { createDocketwiseService } from '@/lib/docketwise-service'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/contacts/sync')({
  server: {
    handlers: {
      // POST /api/contacts/sync — incremental sync from Docketwise
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
          const service = await createDocketwiseService()
          if (!service) {
            return new Response(
              JSON.stringify({ error: 'Docketwise not connected' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          let created = 0
          let updated = 0
          let unchanged = 0
          let page = 1
          let hasMore = true

          while (hasMore) {
            const result = await service.getContacts(page, undefined, undefined, 200)
            const dwContacts = result.contacts

            if (dwContacts.length === 0) break

            // Get all docketwiseIds from this batch
            const dwIds = dwContacts.map((c) => c.id)

            // Find existing contacts in our DB that match these docketwiseIds
            const existing = await prisma.contacts.findMany({
              where: { docketwiseId: { in: dwIds } },
              select: { id: true, docketwiseId: true, docketwiseUpdatedAt: true },
            })

            const existingMap = new Map(
              existing.map((c) => [c.docketwiseId!, c]),
            )

            for (const dw of dwContacts) {
              const local = existingMap.get(dw.id)
              const dwUpdatedAt = dw.updated_at ? new Date(dw.updated_at) : null

              if (!local) {
                // New contact — create
                await prisma.contacts.create({
                  data: {
                    firstName: dw.first_name || '',
                    lastName: dw.last_name || null,
                    middleName: dw.middle_name || null,
                    companyName: dw.company_name || null,
                    email: dw.email || null,
                    lead: dw.lead || false,
                    docketwiseId: dw.id,
                    docketwiseUpdatedAt: dwUpdatedAt,
                  },
                })
                created++
              } else if (
                dwUpdatedAt &&
                (!local.docketwiseUpdatedAt ||
                  dwUpdatedAt.getTime() !== local.docketwiseUpdatedAt.getTime())
              ) {
                // Existing contact with different updatedAt — update
                await prisma.contacts.update({
                  where: { id: local.id },
                  data: {
                    firstName: dw.first_name || '',
                    lastName: dw.last_name || null,
                    middleName: dw.middle_name || null,
                    companyName: dw.company_name || null,
                    email: dw.email || null,
                    lead: dw.lead || false,
                    docketwiseUpdatedAt: dwUpdatedAt,
                  },
                })
                updated++
              } else {
                // Same updatedAt — skip
                unchanged++
              }
            }

            hasMore = result.pagination.nextPage !== null
            page++
          }

          return new Response(
            JSON.stringify({ created, updated, unchanged }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error syncing contacts:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to sync contacts',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
