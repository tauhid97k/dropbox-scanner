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
          clientName,
          selectedMatter,
          matterName,
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

          // Run Gemini AI analysis for RFE detection
          try {
            const { analyzeDocument } = await import('@/lib/gemini-service')
            const analysis = await analyzeDocument(buffer, originalName)
            await prisma.scanJobs.update({
              where: { id: scanJobId },
              data: {
                isRfe: analysis.isRfe,
                aiAnalysis: analysis as any,
                aiConfidence: analysis.confidence,
                progress: 20,
              },
            })
            await publishJobUpdate(scanJobId, {
              progress: 20,
              stage: 'ai-analysis',
            })
            console.log(
              `[Worker] AI analysis for ${originalName}: isRfe=${analysis.isRfe}, confidence=${analysis.confidence}`,
            )
          } catch (aiError) {
            console.warn(
              '[Worker] Gemini AI analysis failed, continuing:',
              aiError,
            )
          }

          // Dropbox folder format: clientName_clientId (e.g. "John_Smith_25146161")
          const folderName = clientName
            ? `${clientName.replace(/\s+/g, '_')}_${selectedClient}`
            : selectedClient || 'unknown_client'
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
            folderName,
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
              clientName: clientName || selectedClient || 'unknown',
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
            clientName: clientName || selectedClient || 'unknown',
            clientId: selectedClient,
            matterId: selectedMatter,
            matterName: matterName || selectedMatter,
            fileName: originalName,
            fileData,
          })

          return { success: true, dropboxPath, folderName }
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

          // Always create an email log for error notifications
          const emailLog = await prisma.emailLog.create({
            data: {
              scanJobId,
              recipients: emailSettings?.recipients || [],
              subject: `File Upload Failed: ${originalName}`,
              status:
                !emailSettings?.notifyOnError ||
                !emailSettings.recipients.length
                  ? 'failed'
                  : 'pending',
              errorMessage:
                !emailSettings?.notifyOnError ||
                !emailSettings.recipients.length
                  ? 'No recipients configured'
                  : undefined,
              fileName: originalName,
              fileSize: job.data.fileSize,
              fileType: mimeType,
              clientName: clientName || selectedClient || undefined,
              matterName: matterName || selectedMatter || undefined,
              template: 'upload-error',
            },
          })

          if (
            emailSettings?.notifyOnError &&
            emailSettings.recipients.length > 0
          ) {
            const emailQueue = await getEmailQueue()
            await emailQueue.add('send-notification', {
              emailLogId: emailLog.id,
              to: emailSettings.recipients,
              subject: `File Upload Failed: ${originalName}`,
              template: 'upload-error' as const,
              data: {
                fileName: originalName,
                fileSize: job.data.fileSize,
                fileType: mimeType,
                clientName: clientName || selectedClient || 'Unknown',
                matterName: matterName || selectedMatter || 'Unknown',
                error: errorMessage,
              },
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
        const {
          scanJobId,
          userId,
          clientName,
          clientId,
          matterId,
          fileName,
          fileData,
        } = job.data

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

          const numericClientId = clientId ? parseInt(clientId, 10) : NaN
          if (isNaN(numericClientId)) {
            throw new Error(`Invalid Docketwise client ID: ${clientId}`)
          }

          const doc = await docketwise.uploadDocument({
            title: fileName,
            filename: fileName,
            base64Data: fileData,
            clientId: numericClientId,
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

          // Get scanJob for file metadata
          const scanJobData = await prisma.scanJobs.findUnique({
            where: { id: scanJobId },
            select: { fileSize: true, mimeType: true },
          })

          // Always create an email log for success notifications
          const emailLog = await prisma.emailLog.create({
            data: {
              scanJobId,
              recipients: emailSettings?.recipients || [],
              subject: `Document Processed: ${fileName}`,
              status:
                !emailSettings?.notifyOnUpload ||
                !emailSettings.recipients.length
                  ? 'failed'
                  : 'pending',
              errorMessage:
                !emailSettings?.notifyOnUpload ||
                !emailSettings.recipients.length
                  ? 'No recipients configured'
                  : undefined,
              fileName,
              fileSize: scanJobData?.fileSize || undefined,
              fileType: scanJobData?.mimeType || undefined,
              clientName: clientName || undefined,
              matterName: job.data.matterName || matterId || undefined,
              template: 'upload-success',
            },
          })

          if (
            emailSettings?.notifyOnUpload &&
            emailSettings.recipients.length > 0
          ) {
            const emailQueue = await getEmailQueue()
            await emailQueue.add('send-notification', {
              emailLogId: emailLog.id,
              to: emailSettings.recipients,
              subject: `Document Processed: ${fileName}`,
              template: 'upload-success' as const,
              data: {
                clientName: clientName || 'Unknown',
                matterName: job.data.matterName || matterId || 'Unknown',
                fileName,
                fileSize: scanJobData?.fileSize || 0,
                fileType: scanJobData?.mimeType || 'Unknown',
                dropboxPath: job.data.filePath,
                docketwiseDocId: docId,
              },
            })
          }

          await prisma.scanJobs.update({
            where: { id: scanJobId },
            data: {
              status: 'completed',
              progress: 100,
              stage: 'completed',
              errorMessage: null,
            },
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
      { connection, concurrency: 1, limiter: { max: 1, duration: 2000 } },
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
        const { emailLogId, to, subject, template, data } = job.data

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

          const formatFileSize = (bytes: number) => {
            if (!bytes) return 'Unknown'
            if (bytes < 1024) return `${bytes} B`
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
          }

          const appUrl = (
            process.env.BETTER_AUTH_URL || 'http://localhost:3000'
          ).replace(/\/$/, '')
          const logoUrl = `${appUrl}/logo.png`

          let html = ''
          const isSuccess = template === 'upload-success'
          const headerBg = isSuccess
            ? 'linear-gradient(135deg, #0061FE 0%, #0042A8 100%)'
            : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
          const statusIcon = isSuccess ? '✅' : '❌'
          const statusTitle = isSuccess
            ? 'Document Processed Successfully'
            : 'Document Processing Failed'

          html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden;">
          <!-- Header with Brand Logo -->
          <tr>
            <td style="background: ${headerBg}; padding: 32px; text-align: center;">
              <img src="${logoUrl}" alt="Brand Logo" width="160" style="display: block; margin: 0 auto 16px; max-width: 160px; height: auto;" />
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">
                ${statusIcon} ${statusTitle}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
                ${
                  isSuccess
                    ? 'A document has been successfully uploaded to Dropbox and synced with Docketwise.'
                    : 'There was an error processing a document upload. Please review the details below.'
                }
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Document Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; width: 120px; border-bottom: 1px solid #e5e7eb;">Client</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${data.clientName || 'Unknown'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">Matter</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${data.matterName || 'Unknown'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">File Name</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${data.fileName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">File Size</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${formatFileSize(data.fileSize)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">File Type</td>
                        <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.fileType || 'Unknown'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                !isSuccess && data.error
                  ? `
              <!-- Error Alert -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 500;">Error: ${data.error}</p>
                  </td>
                </tr>
              </table>
              `
                  : ''
              }

              ${
                isSuccess && data.dropboxPath
                  ? `
              <!-- Dropbox Path -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #1e40af;"><strong>Dropbox Path:</strong> ${data.dropboxPath}</p>
                  </td>
                </tr>
              </table>
              `
                  : ''
              }

              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Processed on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 2px solid #f3f4f6; background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <img src="${logoUrl}" alt="Brand Logo" width="100" style="display: block; margin: 0 auto 8px; max-width: 100px; height: auto;" />
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">Automated Document Processing</p>
                    <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af;">You received this because you are a configured notification recipient.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

          const info = await transporter.sendMail({
            from: `"Dropbox Scanner" <${process.env.SMTP_USER}>`,
            to: to.join(', '),
            subject,
            html,
          })

          // Update email log as sent
          if (emailLogId) {
            await prisma.emailLog.update({
              where: { id: emailLogId },
              data: { status: 'sent' },
            })
          }

          console.log('[Worker] Email sent:', info.messageId)
          return {
            success: true,
            recipients: to.length,
            messageId: info.messageId,
          }
        } catch (error) {
          console.error('[Worker] Email sending failed:', error)

          // Update email log as failed
          if (emailLogId) {
            await prisma.emailLog.update({
              where: { id: emailLogId },
              data: {
                status: 'failed',
                errorMessage:
                  error instanceof Error ? error.message : 'Email send failed',
              },
            })
          }

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
