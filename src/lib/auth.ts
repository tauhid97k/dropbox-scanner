import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { genericOAuth, organization } from 'better-auth/plugins'
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
    modelName: 'Users',
  },
  session: {
    modelName: 'Sessions',
  },
  account: {
    modelName: 'Accounts',
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
    },
  },
  verification: {
    modelName: 'Verifications',
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      schema: {
        organization: {
          modelName: 'Organizations',
        },
        member: {
          modelName: 'Members',
        },
        invitation: {
          modelName: 'Invitations',
        },
        organizationRole: {
          modelName: 'OrganizationRoles',
        },
        team: {
          modelName: 'Teams',
        },
        teamMember: {
          modelName: 'TeamMembers',
        },
      },
    }),
    tanstackStartCookies(),
    genericOAuth({
      config: [
        {
          providerId: 'docketwise',
          clientId: process.env.DOCKETWISE_CLIENT_ID!,
          clientSecret: process.env.DOCKETWISE_CLIENT_SECRET!,
          authorizationUrl: process.env.DOCKETWISE_OAUTH_AUTHORIZE_URL!,
          tokenUrl: process.env.DOCKETWISE_OAUTH_TOKEN_URL!,
          redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/oauth2/callback/docketwise`,
          scopes: ['public', 'write'],
          pkce: false,
          accessType: 'offline',
          getUserInfo: async () => {
            // For Docketwise OAuth, we create a placeholder user
            return {
              id: 'docketwise_firm_connection',
              email: 'docketwise@firm.local',
              name: 'Docketwise Connection',
              emailVerified: true,
            }
          },
        },
        {
          providerId: 'dropbox',
          clientId: process.env.DROPBOX_CLIENT_ID!,
          clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
          authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
          tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
          redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/oauth2/callback/dropbox`,
          scopes: [
            'files.content.write',
            'files.content.read',
            'account_info.read',
          ],
          pkce: true,
          accessType: 'offline',
          getUserInfo: async (tokens) => {
            // Fetch Dropbox account info (POST required by Dropbox API)
            const response = await fetch(
              'https://api.dropboxapi.com/2/users/get_current_account',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${tokens.accessToken}`,
                },
              },
            )
            const data = await response.json()
            return {
              id: data.account_id,
              email: data.email,
              name: data.name.display_name,
              emailVerified: true,
            }
          },
        },
      ],
    }),
  ],
})
