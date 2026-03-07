import {
  genericOAuthClient,
  organizationClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [organizationClient(), genericOAuthClient()],
})

export const {
  signIn,
  signUp,
  signOut,
  changePassword,
  requestPasswordReset,
  resetPassword,
} = authClient
