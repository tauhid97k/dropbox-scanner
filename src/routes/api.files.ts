import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'

const PAGE_SIZE = 20

export const Route = createFileRoute('/api/files')({
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
        const page = parseInt(url.searchParams.get('page') || '1')
        const clientId = url.searchParams.get('clientId')
        const matterId = url.searchParams.get('matterId')
        const search = url.searchParams.get('search') || ''
        const date = url.searchParams.get('date') || ''

        try {
          const where: Record<string, unknown> = {}
          const scanJobFilter: Record<string, unknown> = {}
          if (clientId) scanJobFilter.selectedClient = clientId
          if (matterId) scanJobFilter.selectedMatter = matterId
          if (Object.keys(scanJobFilter).length > 0) {
            where.scanJob = scanJobFilter
          }
          if (search) {
            where.OR = [
              { fileName: { contains: search, mode: 'insensitive' } },
              { clientName: { contains: search, mode: 'insensitive' } },
            ]
          }
          if (date) {
            const dayStart = new Date(date)
            const dayEnd = new Date(date)
            dayEnd.setDate(dayEnd.getDate() + 1)
            where.uploadedAt = { gte: dayStart, lt: dayEnd }
          }

          const [files, total] = await Promise.all([
            prisma.fileMetadata.findMany({
              where,
              include: {
                scanJob: {
                  select: {
                    status: true,
                    selectedClient: true,
                    selectedMatter: true,
                    originalName: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: { uploadedAt: 'desc' },
              skip: (page - 1) * PAGE_SIZE,
              take: PAGE_SIZE,
            }),
            prisma.fileMetadata.count({ where }),
          ])

          const mapped = files.map((f: any) => ({
            id: f.id,
            fileName: f.fileName,
            fileType: f.fileType || 'unknown',
            clientName: f.clientName || 'Unknown',
            matterName: f.scanJob?.selectedMatter || null,
            uploadedAt: f.uploadedAt.toISOString(),
            createdAt: (f.scanJob?.createdAt || f.uploadedAt).toISOString(),
            status: f.scanJob?.status || 'completed',
            dropboxPath: f.dropboxPath,
          }))

          return new Response(
            JSON.stringify({
              files: mapped,
              total,
              totalPages: Math.ceil(total / PAGE_SIZE),
              page,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error fetching files:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch files' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
