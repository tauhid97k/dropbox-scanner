import { fileWorker } from './file-worker'
import { docketwiseWorker } from './docketwise-worker'
import { emailWorker } from './email-worker'

console.log('[Workers] Starting all workers...')

// Log worker status
fileWorker.on('ready', () => {
  console.log('[Workers] File processing worker ready')
})

docketwiseWorker.on('ready', () => {
  console.log('[Workers] Docketwise sync worker ready')
})

emailWorker.on('ready', () => {
  console.log('[Workers] Email notification worker ready')
})

// Graceful shutdown
async function shutdown() {
  console.log('[Workers] Shutting down workers...')
  await Promise.all([
    fileWorker.close(),
    docketwiseWorker.close(),
    emailWorker.close(),
  ])
  console.log('[Workers] All workers shut down')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('[Workers] All workers started successfully')
