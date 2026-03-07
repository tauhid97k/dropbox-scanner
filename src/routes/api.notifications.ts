import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFileRoute } from '@tanstack/react-router'

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
          const logs = await prisma.emailLog.findMany({
            orderBy: { sentAt: 'desc' },
            take: 50,
            select: {
              id: true,
              recipients: true,
              subject: true,
              status: true,
              errorMessage: true,
              fileName: true,
              fileSize: true,
              fileType: true,
              clientName: true,
              matterName: true,
              template: true,
              sentAt: true,
            },
          })

          const notifications = logs.map((log) => ({
            id: log.id,
            recipients: log.recipients,
            subject: log.subject,
            status: log.status as 'sent' | 'failed' | 'pending',
            errorMessage: log.errorMessage,
            fileName: log.fileName || 'Unknown',
            fileSize: log.fileSize,
            fileType: log.fileType,
            clientName: log.clientName,
            matterName: log.matterName,
            template: log.template,
            sentAt: log.sentAt.toISOString(),
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
