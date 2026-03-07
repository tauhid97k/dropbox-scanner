import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/dashboard/notifications')({
  component: NotificationsPage,
})

interface EmailNotification {
  id: string
  recipient: string
  subject: string
  status: 'sent' | 'failed'
  sentAt: string
  fileName: string
}

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Array<EmailNotification>>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Email notification history</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No notifications yet
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {notification.recipient}
                      </div>
                    </TableCell>
                    <TableCell>{notification.subject}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {notification.fileName}
                    </TableCell>
                    <TableCell>
                      {format(
                        new Date(notification.sentAt),
                        'MMM dd, yyyy HH:mm',
                      )}
                    </TableCell>
                    <TableCell>
                      {notification.status === 'sent' ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
