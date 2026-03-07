import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const Route = createFileRoute('/api/notifications')({
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
          // Fetch completed and failed jobs as notification history
          const jobs = await prisma.scanJobs.findMany({
            where: {
              status: { in: ['completed', 'failed'] },
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
            select: {
              id: true,
              originalName: true,
              selectedClient: true,
              status: true,
              errorMessage: true,
              updatedAt: true,
            },
          })

          // Get email settings for the current user
          const emailSettings = await prisma.emailSettings.findFirst({
            where: { userId: session.user.id },
          })

          const notifications = jobs.map((job) => ({
            id: job.id,
            recipient: emailSettings?.recipients?.[0] || 'N/A',
            subject: job.status === 'completed'
              ? `Document Processed: ${job.originalName}`
              : `Document Processing Failed: ${job.originalName}`,
            status: job.status === 'completed' ? 'sent' : 'failed',
            sentAt: job.updatedAt.toISOString(),
            fileName: job.originalName,
          }))

          return new Response(JSON.stringify({ notifications }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error fetching notifications:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch notifications' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
