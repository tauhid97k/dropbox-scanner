import { FileDropzone } from '@/components/file-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface UploadJob {
  id: string
  fileName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  aiSuggestion?: {
    clientName: string | null
    matterType: string | null
    confidence: number
  }
}

export const Route = createFileRoute('/dashboard/upload')({
  component: UploadPage,
})

function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [clientName, setClientName] = useState('')
  const [matterId, setMatterId] = useState('')
  const [jobs, setJobs] = useState<Array<UploadJob>>([])

  const connectToProgress = (jobId: string) => {
    const eventSource = new EventSource(`/api/progress?jobId=${jobId}`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      setJobs((prev) =>
        prev.map((job) => {
          if (job.id === jobId) {
            return {
              ...job,
              status: data.status || job.status,
              progress: data.progress ?? job.progress,
            }
          }
          return job
        }),
      )

      if (data.status === 'completed') {
        toast.success('Upload completed successfully')
        eventSource.close()
      } else if (data.status === 'failed') {
        toast.error(`Upload failed: ${data.error}`)
        eventSource.close()
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (clientName) formData.append('selectedClient', clientName)
    if (matterId) formData.append('selectedMatter', matterId)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      toast.success('Upload started')

      const newJob: UploadJob = {
        id: data.jobId,
        fileName: file.name,
        status: 'pending',
        progress: 0,
        aiSuggestion: data.aiSuggestion,
      }
      setJobs((prev) => [newJob, ...prev])

      connectToProgress(data.jobId)

      setFile(null)
      setClientName('')
      setMatterId('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Document</h1>
        <p className="text-gray-500">
          Upload files to Dropbox with AI-powered client detection
        </p>
      </div>

      {/* Upload Card */}
      <Card className="border-2">
        <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* File Dropzone */}
          <div className="space-y-2">
            <Label>Document</Label>
            <FileDropzone
              onFilesSelected={(files) => setFile(files[0] || null)}
            />
            {file && (
              <p className="text-xs text-green-600">Selected: {file.name}</p>
            )}
          </div>

          {/* Client & Matter Fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client Name (optional)</Label>
              <Input
                placeholder="Will auto-detect if empty"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Matter (optional)</Label>
              <Input
                placeholder="Will auto-detect if empty"
                value={matterId}
                onChange={(e) => setMatterId(e.target.value)}
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              <strong>AI Auto-Detection:</strong> If you leave fields empty, AI
              will analyze the document and suggest the appropriate client and
              matter type.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleUpload}
            disabled={isUploading || !file}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading & Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Upload & Process with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{job.fileName}</span>
                    <span
                      className={`text-sm ${
                        job.status === 'completed'
                          ? 'text-green-600'
                          : job.status === 'failed'
                            ? 'text-red-600'
                            : 'text-blue-600'
                      }`}
                    >
                      {job.status === 'completed' && 'Completed'}
                      {job.status === 'failed' && 'Failed'}
                      {job.status === 'processing' &&
                        `Processing... ${job.progress}%`}
                      {job.status === 'pending' && 'Pending...'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  {job.aiSuggestion && job.aiSuggestion.clientName && (
                    <p className="mt-2 text-sm text-blue-600">
                      AI Suggested: {job.aiSuggestion.clientName}
                      {job.aiSuggestion.confidence > 0 && (
                        <span className="ml-1 text-xs">
                          ({Math.round(job.aiSuggestion.confidence * 100)}%
                          confidence)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
