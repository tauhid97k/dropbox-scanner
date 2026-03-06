import { Redis } from 'ioredis'

// Redis client for BullMQ and general caching
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Redis client for BullMQ (needs to be separate instance)
export const redisBull = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Event publisher for real-time updates
export const redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Event subscriber
export const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Helper to publish job progress updates
export async function publishJobUpdate(jobId: string, data: Record<string, unknown>) {
  await redisPub.publish(
    `job:${jobId}`,
    JSON.stringify({
      ...data,
      timestamp: Date.now(),
    })
  )
}

// Helper to publish user-specific updates
export async function publishUserUpdate(userId: string, data: Record<string, unknown>) {
  await redisPub.publish(
    `user:${userId}`,
    JSON.stringify({
      ...data,
      timestamp: Date.now(),
    })
  )
}
