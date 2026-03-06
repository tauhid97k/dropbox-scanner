import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ConnectionBannerProps {
  dropboxConnected: boolean
  docketwiseConnected: boolean
  onConnectDropbox?: () => void
  onConnectDocketwise?: () => void
}

export function ConnectionBanner({
  dropboxConnected,
  docketwiseConnected,
  onConnectDropbox,
  onConnectDocketwise,
}: ConnectionBannerProps) {
  if (dropboxConnected && docketwiseConnected) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Connection Required</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {dropboxConnected ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Dropbox {dropboxConnected ? 'Connected' : 'Not Connected'}</span>
            </div>
            {!dropboxConnected && (
              <Button size="sm" variant="outline" onClick={onConnectDropbox}>
                Connect Dropbox
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {docketwiseConnected ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Docketwise {docketwiseConnected ? 'Connected' : 'Not Connected'}</span>
            </div>
            {!docketwiseConnected && (
              <Button size="sm" variant="outline" onClick={onConnectDocketwise}>
                Connect Docketwise
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
