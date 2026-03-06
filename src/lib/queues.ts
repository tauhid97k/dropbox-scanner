import { Queue } from 'bullmq'

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}

// File upload processing queue
export const fileQueue = new Queue('file-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

// Docketwise sync queue
export const docketwiseQueue = new Queue('docketwise-sync', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

// Email notification queue
export const emailQueue = new Queue('email-notifications', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
})

// Types for job data
export interface FileJobData {
  scanJobId: string
  userId: string
  fileData: string // base64 encoded
  originalName: string
  mimeType: string
  fileSize: number
  contentHash: string
  selectedClient?: string
  selectedMatter?: string
}

export interface DocketwiseJobData {
  scanJobId: string
  userId: string
  filePath: string
  clientName: string
  matterId?: string
  fileName: string
  fileData?: string // base64 if needed
}

export interface EmailJobData {
  to: Array<string>
  subject: string
  template: 'upload-success' | 'upload-error' | 'summary'
  data: Record<string, unknown>
}
