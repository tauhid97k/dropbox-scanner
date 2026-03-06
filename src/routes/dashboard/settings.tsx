import { createFileRoute } from '@tanstack/react-router'
import { createAuthClient } from 'better-auth/client'
import { AlertCircle, Check, Link2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const authClient = createAuthClient()

interface ConnectionStatus {
  docketwise: boolean
  dropbox: boolean
}

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [connections, setConnections] = useState<ConnectionStatus>({
    docketwise: false,
    dropbox: false,
  })

  const checkConnections = async () => {
    try {
      const accounts = await authClient.listAccounts()
      if (accounts.data) {
        const hasDocketwise = accounts.data.some(
          (account: { provider: string }) => account.provider === 'docketwise',
        )
        const hasDropbox = accounts.data.some(
          (account: { provider: string }) => account.provider === 'dropbox',
        )
        setConnections({
          docketwise: hasDocketwise,
          dropbox: hasDropbox,
        })
      }
    } catch (error) {
      console.error('Failed to check connections:', error)
    }
  }

  useEffect(() => {
    checkConnections()
  }, [])

  const handleConnectDocketwise = async () => {
    setIsLoading(true)
    try {
      await authClient.oauth2.link({
        providerId: 'docketwise',
        callbackURL: '/dashboard/settings?connected=docketwise',
        errorCallbackURL: '/dashboard/settings?error=docketwise',
      })
    } catch (error) {
      toast.error('Failed to connect Docketwise')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectDropbox = async () => {
    setIsLoading(true)
    try {
      await authClient.oauth2.link({
        providerId: 'dropbox',
        callbackURL: '/dashboard/settings?connected=dropbox',
        errorCallbackURL: '/dashboard/settings?error=dropbox',
      })
    } catch (error) {
      toast.error('Failed to connect Dropbox')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async (provider: 'docketwise' | 'dropbox') => {
    setIsLoading(true)
    try {
      const { error } = await authClient.unlinkAccount({
        providerId: provider,
      })

      if (error) {
        throw new Error(error.message)
      }

      toast.success(
        `${provider === 'docketwise' ? 'Docketwise' : 'Dropbox'} disconnected`,
      )
      await checkConnections()
    } catch (error) {
      toast.error(`Failed to disconnect ${provider}`)
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">
          Manage your integrations and connections
        </p>
      </div>

      <Separator />

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect your accounts to enable file syncing and document management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Docketwise */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <span className="text-lg font-bold text-blue-600">D</span>
              </div>
              <div>
                <h3 className="font-medium">Docketwise</h3>
                <p className="text-sm text-gray-500">
                  Sync documents to your Docketwise matters
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {connections.docketwise ? (
                <>
                  <Badge variant="default" className="bg-green-500">
                    <Check className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect('docketwise')}
                    disabled={isLoading}
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnectDocketwise}
                  disabled={isLoading}
                  size="sm"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Dropbox */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <span className="text-lg font-bold text-blue-600">Db</span>
              </div>
              <div>
                <h3 className="font-medium">Dropbox</h3>
                <p className="text-sm text-gray-500">
                  Store files in organized client folders
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {connections.dropbox ? (
                <>
                  <Badge variant="default" className="bg-green-500">
                    <Check className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect('dropbox')}
                    disabled={isLoading}
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnectDropbox}
                  disabled={isLoading}
                  size="sm"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>Overview of your connected services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {connections.docketwise ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span>Docketwise</span>
              <Badge variant={connections.docketwise ? 'default' : 'secondary'}>
                {connections.docketwise ? 'Active' : 'Not connected'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              {connections.dropbox ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span>Dropbox</span>
              <Badge variant={connections.dropbox ? 'default' : 'secondary'}>
                {connections.dropbox ? 'Active' : 'Not connected'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Help</CardTitle>
          <CardDescription>Need assistance?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Having trouble connecting? Make sure you have the correct OAuth
            credentials configured in your environment variables.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
