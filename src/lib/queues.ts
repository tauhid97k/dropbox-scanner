const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}

let _fileQueue: any
let _docketwiseQueue: any
let _emailQueue: any

async function getQueue(name: string, opts: Record<string, any>) {
  const { Queue } = await import('bullmq')
  return new Queue(name, { connection, defaultJobOptions: opts })
}

// File upload processing queue (lazy)
export async function getFileQueue() {
  if (!_fileQueue) {
    _fileQueue = await getQueue('file-processing', {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    })
  }
  return _fileQueue
}

// Docketwise sync queue (lazy)
export async function getDocketwiseQueue() {
  if (!_docketwiseQueue) {
    _docketwiseQueue = await getQueue('docketwise-sync', {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    })
  }
  return _docketwiseQueue
}

// Email notification queue (lazy)
export async function getEmailQueue() {
  if (!_emailQueue) {
    _emailQueue = await getQueue('email-notifications', {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 50,
      removeOnFail: 20,
    })
  }
  return _emailQueue
}

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
