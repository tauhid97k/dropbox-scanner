import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const Route = createFileRoute('/api/email-settings')({
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
          const settings = await prisma.emailSettings.findFirst({
            where: { userId: session.user.id },
          })

          return new Response(
            JSON.stringify({
              settings: settings || {
                recipients: [],
                notifyOnUpload: true,
                notifyOnError: true,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error fetching email settings:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch email settings' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },

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
          const { recipients, notifyOnUpload, notifyOnError } = body

          const settings = await prisma.emailSettings.upsert({
            where: { userId: session.user.id },
            update: {
              recipients: recipients || [],
              notifyOnUpload: notifyOnUpload ?? true,
              notifyOnError: notifyOnError ?? true,
            },
            create: {
              userId: session.user.id,
              recipients: recipients || [],
              notifyOnUpload: notifyOnUpload ?? true,
              notifyOnError: notifyOnError ?? true,
            },
          })

          return new Response(
            JSON.stringify({ success: true, settings }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('Error saving email settings:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to save email settings' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
