import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { redisSub } from '@/lib/redis'

export const Route = createFileRoute('/api/progress')({
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
        const jobId = url.searchParams.get('jobId')

        if (!jobId) {
          return new Response(JSON.stringify({ error: 'Job ID required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Set up SSE
        const stream = new ReadableStream({
          start(controller) {
            // Send initial message
            controller.enqueue(`data: ${JSON.stringify({ connected: true, jobId })}\n\n`)

            // Subscribe to Redis channel for this job
            const channel = `job:${jobId}`
            redisSub.subscribe(channel)

            redisSub.on('message', (receivedChannel, message) => {
              if (receivedChannel === channel) {
                controller.enqueue(`data: ${message}\n\n`)
              }
            })

            // Handle client disconnect
            request.signal.addEventListener('abort', () => {
              redisSub.unsubscribe(channel)
              controller.close()
            })
          },
          cancel() {
            redisSub.unsubscribe(`job:${jobId}`)
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
