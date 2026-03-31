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
    sendResetPassword: async ({ user, url }) => {
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

        const appUrl = (
          process.env.BETTER_AUTH_URL || 'http://localhost:3000'
        ).replace(/\/$/, '')
        const logoUrl = `${appUrl}/logo.png`

        const html = `
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
          <tr>
            <td style="background: linear-gradient(135deg, #0061FE 0%, #0042A8 100%); padding: 32px; text-align: center;">
              <img src="${logoUrl}" alt="Brand Logo" width="160" style="display: block; margin: 0 auto 16px; max-width: 160px; height: auto;" />
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">
                Password Reset Request
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Hello${user.name ? ` ${user.name}` : ''},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
                We received a request to reset your password. Click the button below to set a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #0061FE 0%, #0042A8 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">This link will expire in 1 hour.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; border-top: 2px solid #f3f4f6; background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <img src="${logoUrl}" alt="Brand Logo" width="100" style="display: block; margin: 0 auto 8px; max-width: 100px; height: auto;" />
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">Automated Document Processing</p>
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

        await transporter.sendMail({
          from: `"Dropbox Scanner" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Reset Your Password - Dropbox Scanner',
          html,
          text: `Reset your password by visiting: ${url}`,
        })

        console.log(`[Auth] Password reset email sent to ${user.email}`)
      } catch (error) {
        console.error('[Auth] Failed to send password reset email:', error)
      }
    },
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
            'files.metadata.read',
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
