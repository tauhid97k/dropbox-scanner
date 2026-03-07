import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const Route = createFileRoute('/api/queue')({
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

        try {
          const jobs = await prisma.scanJobs.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              originalName: true,
              selectedClient: true,
              status: true,
              stage: true,
              progress: true,
              createdAt: true,
              errorMessage: true,
            },
          })

          const mapped = jobs.map((job) => ({
            id: job.id,
            fileName: job.originalName,
            clientName: job.selectedClient || 'Unassigned',
            status: job.status,
            stage: job.stage || 'upload',
            progress: job.progress || 0,
            createdAt: job.createdAt.toISOString(),
            errorMessage: job.errorMessage,
          }))

          return new Response(JSON.stringify({ jobs: mapped }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error fetching queue:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch queue' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
