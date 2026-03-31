import { getScanFolderQueue } from '@/lib/queues'
import { ensureWorkersStarted } from '@/lib/worker-manager'
import { createFileRoute } from '@tanstack/react-router'
import { createHmac } from 'node:crypto'

export const Route = createFileRoute('/api/dropbox/webhook')({
  server: {
    handlers: {
      // ── Dropbox verification handshake ──
      // Dropbox sends GET ?challenge=<random> when registering the webhook.
      // We must echo back the challenge as plain text with specific headers.
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const challenge = url.searchParams.get('challenge') || ''
        return new Response(challenge, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },

      // ── Dropbox change notification ──
      // Dropbox sends POST with JSON listing accounts that have file changes.
      // We must respond 200 immediately, then process asynchronously.
      POST: async ({ request }) => {
        const appSecret = process.env.DROPBOX_CLIENT_SECRET || ''
        const rawBody = await request.text()

        // Verify HMAC-SHA256 signature
        const signature = request.headers.get('X-Dropbox-Signature') || ''
        const expected = createHmac('sha256', appSecret)
          .update(rawBody)
          .digest('hex')

        if (!signature || signature !== expected) {
          console.warn('[Webhook] Invalid Dropbox signature — rejected')
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let payload: { list_folder?: { accounts?: Array<string> } }
        try {
          payload = JSON.parse(rawBody)
        } catch {
          return new Response(JSON.stringify({ error: 'Bad Request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const accounts = payload?.list_folder?.accounts ?? []

        if (accounts.length > 0) {
          try {
            await ensureWorkersStarted()
            const queue = await getScanFolderQueue()
            for (const accountId of accounts) {
              await queue.add(
                'scan-folder-check',
                { accountId },
                { jobId: `scan-${accountId}-${Date.now()}` },
              )
            }
            console.log(
              `[Webhook] Queued scan-folder-check for ${accounts.length} account(s)`,
            )
          } catch (err) {
            console.error('[Webhook] Failed to enqueue scan-folder-check:', err)
          }
        }

        // Always respond 200 quickly — Dropbox will retry on non-200
        return new Response('', { status: 200 })
      },
    },
  },
})
