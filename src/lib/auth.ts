import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { organization } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { prisma } from './prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  advanced: {
    database: {
      generateId: false,
    },
  },
  user: {
    modelName: 'users',
  },
  session: {
    modelName: 'sessions',
  },
  account: {
    modelName: 'accounts',
  },
  verification: {
    modelName: 'verifications',
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      schema: {
        organization: {
          modelName: 'organizations',
        },
        member: {
          modelName: 'members',
        },
        invitation: {
          modelName: 'invitations',
        },
        organizationRole: {
          modelName: 'organizationRoles',
        },
        team: {
          modelName: 'teams',
        },
        teamMember: {
          modelName: 'teamMembers',
        },
      },
    }),
    tanstackStartCookies(),
  ],
})
