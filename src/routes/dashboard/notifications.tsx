import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createFileRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/dashboard/notifications')({
  component: NotificationsPage,
})

interface EmailNotification {
  id: string
  recipients: string[]
  subject: string
  status: 'sent' | 'failed' | 'pending'
  errorMessage: string | null
  fileName: string
  fileSize: number | null
  fileType: string | null
  clientName: string | null
  matterName: string | null
  template: string | null
  sentAt: string
}

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Array<EmailNotification>>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedNotification, setSelectedNotification] =
    useState<EmailNotification | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications')
      if (!response.ok) throw new Error('Failed to fetch notifications')
      const data = await response.json()
      setNotifications(data.notifications || [])
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Sent
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Email notification history</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchNotifications}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No notifications yet. Notifications will appear here after files are
          processed.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell className="max-w-[250px] truncate font-medium">
                      {notification.subject}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {notification.fileName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {notification.clientName || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(
                        new Date(notification.sentAt),
                        'MMM dd, yyyy HH:mm',
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(notification.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedNotification(notification)
                          setDetailsOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Status:
                </span>
                {getStatusBadge(selectedNotification.status)}
              </div>

              {/* Error message */}
              {selectedNotification.errorMessage && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {selectedNotification.errorMessage}
                  </p>
                </div>
              )}

              {/* Recipients */}
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Recipients
                </p>
                {selectedNotification.recipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedNotification.recipients.map((r) => (
                      <Badge key={r} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-destructive">
                    No recipients found
                  </p>
                )}
              </div>

              {/* File details */}
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Document Details
                </p>
                <div className="grid grid-cols-[100px_1fr] gap-y-1 text-sm">
                  <span className="text-muted-foreground">Subject</span>
                  <span className="truncate font-medium">
                    {selectedNotification.subject}
                  </span>
                  <span className="text-muted-foreground">File</span>
                  <span className="truncate font-medium">
                    {selectedNotification.fileName}
                  </span>
                  <span className="text-muted-foreground">Client</span>
                  <span>{selectedNotification.clientName || '—'}</span>
                  <span className="text-muted-foreground">Matter</span>
                  <span>{selectedNotification.matterName || '—'}</span>
                  <span className="text-muted-foreground">File Size</span>
                  <span>{formatFileSize(selectedNotification.fileSize)}</span>
                  <span className="text-muted-foreground">File Type</span>
                  <span>{selectedNotification.fileType || '—'}</span>
                </div>
              </div>

              {/* Sent at */}
              <p className="text-xs text-muted-foreground">
                {format(
                  new Date(selectedNotification.sentAt),
                  'MMMM dd, yyyy HH:mm:ss',
                )}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
