import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ConnectionBannerProps {
  dropboxConnected: boolean
  docketwiseConnected: boolean
}

export function ConnectionBanner({
  dropboxConnected,
  docketwiseConnected,
}: ConnectionBannerProps) {
  if (dropboxConnected && docketwiseConnected) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Docketwise Card */}
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
          <img src="/docketwise.png" alt="Docketwise" className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Docketwise</p>
          {docketwiseConnected ? (
            <div className="flex items-center gap-1 text-xs font-medium text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" />
              Not connected
            </div>
          )}
        </div>
        {!docketwiseConnected && (
          <Button asChild size="sm">
            <Link to="/dashboard/settings">Connect</Link>
          </Button>
        )}
      </div>

      {/* Dropbox Card */}
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
          <img src="/dropbox.png" alt="Dropbox" className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Dropbox</p>
          {dropboxConnected ? (
            <div className="flex items-center gap-1 text-xs font-medium text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" />
              Not connected
            </div>
          )}
        </div>
        {!dropboxConnected && (
          <Button asChild size="sm">
            <Link to="/dashboard/settings">Connect</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
