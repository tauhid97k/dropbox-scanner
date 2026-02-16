import { organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const {
  signIn,
  signUp,
  signOut,
  changePassword,
  requestPasswordReset,
  resetPassword,
} = createAuthClient({
  plugins: [organizationClient()],
})
