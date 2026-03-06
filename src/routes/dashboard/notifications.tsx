import { format } from 'date-fns'
import { CheckCircle, Mail, XCircle } from 'lucide-react'
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
  const [notifications] = useState<Array<EmailNotification>>([
    {
      id: '1',
      recipient: 'john@example.com',
      subject: 'Document Processed: passport.pdf',
      status: 'sent',
      sentAt: '2026-03-06T10:30:00Z',
      fileName: 'passport.pdf',
    },
    {
      id: '2',
      recipient: 'jane@example.com',
      subject: 'Document Processed: i485_form.pdf',
      status: 'sent',
      sentAt: '2026-03-06T09:15:00Z',
      fileName: 'i485_form.pdf',
    },
    {
      id: '3',
      recipient: 'bob@example.com',
      subject: 'Document Processing Failed: invalid.pdf',
      status: 'failed',
      sentAt: '2026-03-05T16:45:00Z',
      fileName: 'invalid.pdf',
    },
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Email notification history</p>
      </div>

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
                    {format(new Date(notification.sentAt), 'MMM dd, yyyy HH:mm')}
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

      {notifications.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No notifications yet
        </div>
      )}
    </div>
  )
}
