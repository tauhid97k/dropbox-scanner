import { auth } from './auth'
import { prisma } from './prisma'

// Get Docketwise access token (shared across all users, like law-firm-dashboard)
export async function getDocketwiseToken(): Promise<string | null> {
  const account = await prisma.accounts.findFirst({
    where: {
      providerId: 'docketwise',
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  if (!account) {
    return null
  }

  try {
    const result = await auth.api.getAccessToken({
      body: {
        providerId: 'docketwise',
        userId: account.userId,
      },
    })

    return result?.accessToken || null
  } catch (error) {
    console.error('Error getting Docketwise access token:', error)
    return null
  }
}

// Get Dropbox access token (shared across all users)
export async function getDropboxToken(): Promise<string | null> {
  const account = await prisma.accounts.findFirst({
    where: {
      providerId: 'dropbox',
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  if (!account) {
    return null
  }

  try {
    const result = await auth.api.getAccessToken({
      body: {
        providerId: 'dropbox',
        userId: account.userId,
      },
    })

    return result?.accessToken || null
  } catch (error) {
    console.error('Error getting Dropbox access token:', error)
    return null
  }
}

// Check if Docketwise is connected
export async function isDocketwiseConnected(): Promise<boolean> {
  const account = await prisma.accounts.findFirst({
    where: { providerId: 'docketwise' },
  })
  return !!account
}

// Check if Dropbox is connected
export async function isDropboxConnected(): Promise<boolean> {
  const account = await prisma.accounts.findFirst({
    where: { providerId: 'dropbox' },
  })
  return !!account
}
