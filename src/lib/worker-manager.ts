/**
 * Worker Manager — lazily starts BullMQ workers in the same server process.
 * Uses dynamic imports so bullmq (externalized) resolves at runtime.
 * Workers are started once and reused for the lifetime of the process.
 */

let _started = false

export async function ensureWorkersStarted() {
  if (_started) return
  _started = true

  console.log('[Workers] Initializing workers...')

  try {
    const { Worker } = await import('bullmq')

    const connection = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }

    // --- File Processing Worker ---
    const { createDropboxService } = await import('@/lib/dropbox-service')
    const { prisma } = await import('@/lib/prisma')
    const { publishJobUpdate } = await import('@/lib/redis')
    const { getDocketwiseQueue, getEmailQueue } = await import('@/lib/queues')

    const fileWorker = new Worker(
      'file-processing',
      async (job) => {
        const {
          scanJobId,
          fileData,
          originalName,
          mimeType,
          userId,
          selectedClient,
          selectedMatter,
        } = job.data

        try {
          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: { status: 'processing', progress: 10, stage: 'ai-analysis' },
          })
          await publishJobUpdate(scanJobId, {
            progress: 10,
            stage: 'ai-analysis',
          })

          const buffer = Buffer.from(fileData, 'base64')
          const clientName = selectedClient || 'unknown_client'
          const matterType = selectedMatter ?? undefined

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: { progress: 30, stage: 'dropbox' },
          })
          await publishJobUpdate(scanJobId, { progress: 30, stage: 'dropbox' })

          // Upload to Dropbox
          const dropbox = await createDropboxService()
          if (!dropbox) {
            throw new Error(
              'Dropbox not connected. Please connect Dropbox in Settings.',
            )
          }

          const { path: dropboxPath } = await dropbox.uploadFile(
            clientName,
            buffer,
            originalName,
          )

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: { progress: 60, dropboxPath },
          })
          await publishJobUpdate(scanJobId, {
            progress: 60,
            stage: 'docketwise',
            dropboxPath,
          })

          // Create file metadata record
          await prisma.fileMetadata.create({
            data: {
              scanJobId,
              dropboxPath,
              clientName,
              fileName: originalName,
              fileType: mimeType,
              uploadedBy: userId,
            },
          })

          // Enqueue Docketwise upload job
          const docketwiseQueue = await getDocketwiseQueue()
          await docketwiseQueue.add('upload-document', {
            scanJobId,
            userId,
            filePath: dropboxPath,
            clientName,
            matterId: selectedMatter,
            fileName: originalName,
            fileData,
          })

          return { success: true, dropboxPath, clientName, matterType }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: {
              status: 'failed',
              errorMessage,
              retryCount: { increment: 1 },
            },
          })
          await publishJobUpdate(scanJobId, {
            status: 'failed',
            error: errorMessage,
          })

          const emailSettings = await prisma.emailSettings.findFirst({
            where: { userId },
          })
          if (
            emailSettings?.notifyOnError &&
            emailSettings.recipients.length > 0
          ) {
            const emailQueue = await getEmailQueue()
            await emailQueue.add('send-notification', {
              to: emailSettings.recipients,
              subject: `File Upload Failed: ${originalName}`,
              template: 'upload-error' as const,
              data: { fileName: originalName, error: errorMessage },
            })
          }

          throw error
        }
      },
      {
        connection,
        concurrency: 3,
        limiter: { max: 5, duration: 1000 },
      },
    )

    fileWorker.on('ready', () => console.log('[Worker] file-processing ready'))
    fileWorker.on('failed', (job, err) => {
      console.error(`[Worker] File job ${job?.id} failed:`, err.message)
    })
    fileWorker.on('completed', (job) => {
      console.log(`[Worker] File job ${job.id} completed`)
    })

    // --- Docketwise Sync Worker ---
    const { createDocketwiseService } = await import('@/lib/docketwise-service')

    const docketwiseWorker = new Worker(
      'docketwise-sync',
      async (job) => {
        const { scanJobId, userId, clientName, matterId, fileName, fileData } =
          job.data

        try {
          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: { progress: 70, stage: 'docketwise' },
          })
          await publishJobUpdate(scanJobId, {
            progress: 70,
            stage: 'docketwise',
          })

          const docketwise = await createDocketwiseService()
          if (!docketwise) {
            throw new Error(
              'Docketwise not connected. Please connect in Settings.',
            )
          }

          if (!fileData) {
            throw new Error('File data not available for Docketwise upload')
          }

          const doc = await docketwise.uploadDocument({
            title: fileName,
            filename: fileName,
            base64Data: fileData,
            clientId: parseInt(clientName, 10),
            matterId: matterId ? parseInt(matterId, 10) : undefined,
            description: `Uploaded via Dropbox Scanner on ${new Date().toISOString()}`,
          })

          const docId = String(doc.id)

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: {
              docketwiseDocId: docId,
              progress: 90,
              stage: 'email',
            },
          })

          await prisma.fileMetadata.update({
            where: { scanJobId },
            data: { docketwiseDocId: docId },
          })

          await publishJobUpdate(scanJobId, {
            docketwiseDocId: docId,
            progress: 90,
            stage: 'email',
          })

          const emailSettings = await prisma.emailSettings.findFirst({
            where: { userId },
          })
          if (
            emailSettings?.notifyOnUpload &&
            emailSettings.recipients.length > 0
          ) {
            const emailQueue = await getEmailQueue()
            await emailQueue.add('send-notification', {
              to: emailSettings.recipients,
              subject: `File Uploaded: ${fileName}`,
              template: 'upload-success' as const,
              data: {
                clientName,
                fileName,
                uploadedBy: userId,
                dropboxPath: job.data.filePath,
                docketwiseDocId: docId,
              },
            })
          }

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: { status: 'completed', progress: 100, stage: 'completed' },
          })
          await publishJobUpdate(scanJobId, {
            progress: 100,
            stage: 'completed',
            status: 'completed',
          })

          return { success: true, docketwiseDocId: docId }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Docketwise sync failed'
          console.error('[Worker] Docketwise sync error:', error)

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: {
              status: 'failed',
              errorMessage,
              stage: 'docketwise',
            },
          })
          await publishJobUpdate(scanJobId, {
            status: 'failed',
            error: errorMessage,
          })

          throw new Error(errorMessage)
        }
      },
      { connection, concurrency: 2 },
    )

    docketwiseWorker.on('failed', (job, err) => {
      console.error(`[Worker] Docketwise job ${job?.id} failed:`, err.message)
    })
    docketwiseWorker.on('completed', (job) => {
      console.log(`[Worker] Docketwise job ${job.id} completed`)
    })

    // --- Email Notification Worker ---
    const emailWorker = new Worker(
      'email-notifications',
      async (job) => {
        const { to, subject, template, data } = job.data

        try {
          const nodemailer = await import('nodemailer')
          const transporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          })

          let html = ''
          switch (template) {
            case 'upload-success':
              html = `
                <h2>File Upload Successful</h2>
                <p>A new file has been uploaded and processed successfully.</p>
                <ul>
                  <li><strong>Client:</strong> ${data.clientName}</li>
                  <li><strong>File:</strong> ${data.fileName}</li>
                  <li><strong>Uploaded by:</strong> ${data.uploadedBy}</li>
                  <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                  ${data.dropboxPath ? `<li><strong>Dropbox:</strong> ${data.dropboxPath}</li>` : ''}
                </ul>
              `
              break
            case 'upload-error':
              html = `
                <h2>File Upload Failed</h2>
                <p>There was an error processing a file upload.</p>
                <ul>
                  <li><strong>File:</strong> ${data.fileName}</li>
                  <li><strong>Error:</strong> ${data.error}</li>
                  <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
              `
              break
            case 'summary':
              html = `
                <h2>Daily Upload Summary</h2>
                <p>${data.summary}</p>
              `
              break
          }

          const info = await transporter.sendMail({
            from: `"Dropbox Scanner" <${process.env.SMTP_USER}>`,
            to: to.join(', '),
            subject,
            html,
          })

          console.log('[Worker] Email sent:', info.messageId)
          return {
            success: true,
            recipients: to.length,
            messageId: info.messageId,
          }
        } catch (error) {
          console.error('[Worker] Email sending failed:', error)
          throw error
        }
      },
      { connection, concurrency: 2 },
    )

    docketwiseWorker.on('ready', () =>
      console.log('[Worker] docketwise-sync ready'),
    )
    emailWorker.on('ready', () =>
      console.log('[Worker] email-notifications ready'),
    )
    emailWorker.on('failed', (job, err) => {
      console.error(`[Worker] Email job ${job?.id} failed:`, err.message)
    })

    console.log(
      '[Workers] All workers registered, waiting for Redis connection...',
    )
  } catch (error) {
    _started = false
    console.error('[Workers] Failed to start workers:', error)
  }
}
