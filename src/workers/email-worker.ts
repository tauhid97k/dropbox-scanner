import { Worker } from 'bullmq'
import nodemailer from 'nodemailer'
import type { EmailJobData } from '@/lib/queues'
import type { Job } from 'bullmq'

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}

// Email notification worker
export const emailWorker = new Worker<EmailJobData>(
  'email-notifications',
  async (job: Job<EmailJobData>) => {
    const { to, subject, template, data } = job.data

    try {
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

      // Send email via SMTP
      const info = await transporter.sendMail({
        from: `"Dropbox Scanner" <${process.env.SMTP_USER}>`,
        to: to.join(', '),
        subject,
        html,
      })

      console.log('Email sent:', info.messageId)

      return { success: true, recipients: to.length, messageId: info.messageId }
    } catch (error) {
      console.error('Email sending failed:', error)
      throw error
    }
  },
  {
    connection,
    concurrency: 2,
  },
)

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err)
})
