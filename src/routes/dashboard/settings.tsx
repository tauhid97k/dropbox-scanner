import { PageLoading } from '@/components/page-loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authClient } from '@/lib/auth-client'
import { isDocketwiseConnected, isDropboxConnected } from '@/lib/auth-tokens'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { CheckCircle2, Mail, Plug, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

interface ConnectionStatus {
  docketwise: boolean
  dropbox: boolean
}

const getConnectionStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [docketwise, dropbox] = await Promise.all([
      isDocketwiseConnected(),
      isDropboxConnected(),
    ])
    return { docketwise, dropbox }
  },
)

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
  pendingComponent: PageLoading,
  loader: () => getConnectionStatus(),
})

function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your integrations and notifications
        </p>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList>
          <TabsTrigger value="integrations">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Mail className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function IntegrationsTab() {
  const loaderData = Route.useLoaderData()
  const [connections, setConnections] = useState<ConnectionStatus>({
    docketwise: loaderData.docketwise,
    dropbox: loaderData.dropbox,
  })
  const [docketwiseLoading, setDocketwiseLoading] = useState(false)
  const [dropboxLoading, setDropboxLoading] = useState(false)

  const refreshConnections = async () => {
    try {
      const response = await fetch('/api/docketwise/status')
      if (response.ok) {
        const data = await response.json()
        setConnections({
          docketwise: data.docketwise,
          dropbox: data.dropbox,
        })
      }
    } catch (error) {
      console.error('Failed to check connections:', error)
    }
  }

  const handleConnect = async (provider: 'docketwise' | 'dropbox') => {
    const setLoading =
      provider === 'docketwise' ? setDocketwiseLoading : setDropboxLoading
    setLoading(true)
    try {
      // Delete any existing connection first (new connection replaces old)
      await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      await authClient.oauth2.link({
        providerId: provider,
        callbackURL: `/dashboard/settings?connected=${provider}`,
        errorCallbackURL: `/dashboard/settings?error=${provider}`,
      })
    } catch (error) {
      toast.error(
        `Failed to connect ${provider === 'docketwise' ? 'Docketwise' : 'Dropbox'}`,
      )
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (provider: 'docketwise' | 'dropbox') => {
    const setLoading =
      provider === 'docketwise' ? setDocketwiseLoading : setDropboxLoading
    setLoading(true)
    try {
      // Use server-side disconnect that deletes ALL accounts for this provider (firm-wide)
      const response = await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      toast.success(
        `${provider === 'docketwise' ? 'Docketwise' : 'Dropbox'} disconnected`,
      )
      await refreshConnections()
    } catch (error) {
      toast.error(`Failed to disconnect ${provider}`)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Docketwise */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-background">
                <img
                  src="/docketwise.png"
                  alt="Docketwise"
                  className="h-8 w-8"
                />
              </div>
              <div>
                <CardTitle>Docketwise</CardTitle>
                <CardDescription>
                  Sync documents and manage contacts and matters
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {connections.docketwise ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <XCircle className="h-5 w-5 shrink-0" />
                  Not Connected
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connections.docketwise ? (
            <Button
              variant="outline"
              onClick={() => handleDisconnect('docketwise')}
              disabled={docketwiseLoading}
              isLoading={docketwiseLoading}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={() => handleConnect('docketwise')}
              disabled={docketwiseLoading}
              isLoading={docketwiseLoading}
            >
              <img src="/docketwise.png" alt="" className="h-5 w-5" />
              Connect Docketwise
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dropbox */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-background">
                <img src="/dropbox.png" alt="Dropbox" className="h-8 w-8" />
              </div>
              <div>
                <CardTitle>Dropbox</CardTitle>
                <CardDescription>
                  Store files in organized client folders
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {connections.dropbox ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <XCircle className="h-5 w-5 shrink-0" />
                  Not Connected
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connections.dropbox ? (
            <Button
              variant="outline"
              onClick={() => handleDisconnect('dropbox')}
              disabled={dropboxLoading}
              isLoading={dropboxLoading}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={() => handleConnect('dropbox')}
              disabled={dropboxLoading}
              isLoading={dropboxLoading}
            >
              <img src="/dropbox.png" alt="" className="h-5 w-5" />
              Connect Dropbox
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const emailSchema = z.string().email('Please enter a valid email address')

function NotificationsTab() {
  const [recipients, setRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [notifyOnUpload, setNotifyOnUpload] = useState(true)
  const [notifyOnError, setNotifyOnError] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/email-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setRecipients(data.settings.recipients || [])
          setNotifyOnUpload(data.settings.notifyOnUpload ?? true)
          setNotifyOnError(data.settings.notifyOnError ?? true)
        }
      })
      .catch(console.error)
  }, [])

  const addRecipient = () => {
    const email = newEmail.trim()
    setEmailError('')

    const result = emailSchema.safeParse(email)
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message || 'Invalid email')
      return
    }

    if (recipients.includes(email)) {
      setEmailError('This email is already added')
      return
    }

    setRecipients([...recipients, email])
    setNewEmail('')
  }

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email))
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, notifyOnUpload, notifyOnError }),
      })
      if (!response.ok) throw new Error('Failed to save')
      toast.success('Email settings saved')
    } catch {
      toast.error('Failed to save email settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Email Notifications</CardTitle>
            <CardDescription>
              Configure who receives email notifications about uploads
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {/* Recipients */}
          <Field data-invalid={!!emailError}>
            <FieldLabel>Recipients</FieldLabel>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value)
                    if (emailError) setEmailError('')
                  }}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && (e.preventDefault(), addRecipient())
                  }
                  placeholder="Add email address..."
                  aria-invalid={!!emailError}
                />
              </div>
              <Button className="h-10" onClick={addRecipient}>
                Add
              </Button>
            </div>
            <FieldError errors={emailError ? [{ message: emailError }] : []} />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="pr-1">
                    {email}
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => removeRecipient(email)}
                    >
                      <X className="size-4" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </Field>

          {/* Toggle settings */}
          <Field>
            <FieldLabel>Preferences</FieldLabel>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-upload"
                  checked={notifyOnUpload}
                  onCheckedChange={(checked) =>
                    setNotifyOnUpload(checked === true)
                  }
                />
                <Label htmlFor="notify-upload" className="cursor-pointer">
                  Notify on successful upload
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-error"
                  checked={notifyOnError}
                  onCheckedChange={(checked) =>
                    setNotifyOnError(checked === true)
                  }
                />
                <Label htmlFor="notify-error" className="cursor-pointer">
                  Notify on upload failure
                </Label>
              </div>
            </div>
          </Field>

          <Button onClick={saveSettings} isLoading={isSaving}>
            Save Email Settings
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
