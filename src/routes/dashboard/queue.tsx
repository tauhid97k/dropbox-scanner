import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/dashboard/queue')({
  component: QueuePage,
})

interface QueueJob {
  id: string
  fileName: string
  clientName: string
  matterName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  stage: string
  progress: number
  createdAt: string
  errorMessage?: string | null
}

function QueuePage() {
  const [jobs, setJobs] = useState<Array<QueueJob>>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/queue')
      if (!response.ok) throw new Error('Failed to fetch queue')
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Processing Queue</h1>
          <p className="text-muted-foreground">
            Real-time status of file processing jobs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading queue...</span>
        </div>
      ) : (
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
                    Matter: {job.matterName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Stage: {getStageLabel(job.stage)}
                  </p>
                  {job.errorMessage && (
                    <p className="mt-1 text-sm text-destructive">
                      Error: {job.errorMessage}
                    </p>
                  )}
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
      )}
    </div>
  )
}
