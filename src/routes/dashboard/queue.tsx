import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export const Route = createFileRoute('/dashboard/queue')({
  component: QueuePage,
})

interface QueueJob {
  id: string
  fileName: string
  clientName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  stage: 'upload' | 'ai-analysis' | 'dropbox' | 'docketwise' | 'email'
  progress: number
  createdAt: string
}

function QueuePage() {
  const [jobs, setJobs] = useState<Array<QueueJob>>([
    {
      id: '1',
      fileName: 'passport.pdf',
      clientName: 'John Doe',
      status: 'processing',
      stage: 'ai-analysis',
      progress: 45,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      fileName: 'i485_form.pdf',
      clientName: 'Jane Smith',
      status: 'processing',
      stage: 'dropbox',
      progress: 75,
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      fileName: 'employment_letter.pdf',
      clientName: 'Bob Johnson',
      status: 'pending',
      stage: 'upload',
      progress: 0,
      createdAt: new Date().toISOString(),
    },
  ])

  useEffect(() => {
    // TODO: Connect to SSE for real-time updates
    const eventSource = new EventSource('/api/queue-progress')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setJobs((prev) =>
        prev.map((job) =>
          job.id === data.jobId
            ? { ...job, progress: data.progress, stage: data.stage, status: data.status }
            : job,
        ),
      )
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      upload: 'Uploading',
      'ai-analysis': 'AI Analysis',
      dropbox: 'Dropbox Upload',
      docketwise: 'Docketwise Sync',
      email: 'Sending Email',
    }
    return labels[stage] || stage
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
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
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Processing Queue</h1>
        <p className="text-muted-foreground">
          Real-time status of file processing jobs
        </p>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{job.fileName}</CardTitle>
                {getStatusBadge(job.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Client: {job.clientName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Stage: {getStageLabel(job.stage)}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{job.progress}%</span>
                </div>
                <Progress value={job.progress} />
              </div>
            </CardContent>
          </Card>
        ))}

        {jobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No jobs in queue
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
