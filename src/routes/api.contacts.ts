import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/contacts')({
  server: {
    handlers: {
      // GET /api/contacts — list/search contacts from local DB
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
        const page = parseInt(url.searchParams.get('page') || '1')
        const perPage = parseInt(url.searchParams.get('per_page') || '20')
        const search = url.searchParams.get('search') || ''
        const source = url.searchParams.get('source') || 'all' // all | docketwise | manual

        try {
          // Build where clause
          const where: Record<string, unknown> = {}

          // Source filter
          if (source === 'docketwise') {
            where.docketwiseId = { not: null }
          } else if (source === 'manual') {
            where.docketwiseId = null
          }

          // Search filter — case-insensitive across name, company, email
          if (search) {
            where.OR = [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ]
          }

          const [contacts, total] = await Promise.all([
            prisma.contacts.findMany({
              where,
              orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
              skip: (page - 1) * perPage,
              take: perPage,
            }),
            prisma.contacts.count({ where }),
          ])

          const totalPages = Math.ceil(total / perPage)

          return new Response(
            JSON.stringify({
              contacts,
              pagination: {
                total,
                page,
                perPage,
                totalPages,
                hasMore: page < totalPages,
              },
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

      // POST /api/contacts — create a manual (outside) contact
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
          const { firstName, lastName, middleName, companyName, email } = body

          if (!firstName || typeof firstName !== 'string') {
            return new Response(
              JSON.stringify({ error: 'First name is required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const contact = await prisma.contacts.create({
            data: {
              firstName: firstName.trim(),
              lastName: lastName?.trim() || null,
              middleName: middleName?.trim() || null,
              companyName: companyName?.trim() || null,
              email: email?.trim() || null,
              // docketwiseId is null — manual contact
            },
          })

          return new Response(JSON.stringify({ contact }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error creating contact:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to create contact',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
