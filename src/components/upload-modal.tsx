import { AdvancedSelect } from '@/components/advanced-select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { Loader2, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<Array<File>>([])
  const [clientId, setClientId] = useState('')
  const [matterId, setMatterId] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter((file) => {
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ]
      return validTypes.includes(file.type)
    })

    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files])
    } else {
      toast.error('Only PDF, images, and documents are allowed')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file')
      return
    }

    if (!clientId) {
      toast.error('Please select a contact')
      return
    }

    if (!matterId) {
      toast.error('Please select a matter')
      return
    }

    setIsProcessing(true)

    // Queue all files to the server, then immediately close the modal.
    // The actual processing (Dropbox upload, Docketwise sync, etc.) happens
    // in the background via BullMQ workers — we don't wait for that.
    const filesToUpload = [...selectedFiles]
    const client = clientId
    const matter = matterId

    // Reset state and close modal right away
    setSelectedFiles([])
    setClientId('')
    setMatterId('')
    setIsProcessing(false)
    onOpenChange(false)

    toast.info(`Queuing ${filesToUpload.length} file(s) for processing...`)

    const results = await Promise.allSettled(
      filesToUpload.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('selectedClient', client)
        formData.append('selectedMatter', matter)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        return response.json()
      }),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (succeeded > 0) {
      toast.success(
        `${succeeded} file(s) queued — check the Queue page for progress`,
      )
    }
    if (failed > 0) {
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason?.message || 'Unknown error')
      toast.error(`${failed} file(s) failed to queue: ${errors.join(', ')}`)
    }
  }

  const fetchClients = async (search: string, page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page), type: 'Person' })
      if (search) params.set('filter', search)
      const response = await fetch(`/api/docketwise/contacts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch contacts')
      const data = await response.json()

      const options = (data.contacts || []).map(
        (contact: {
          id: number
          first_name: string | null
          last_name: string | null
          company_name: string | null
        }) => {
          const name =
            [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
            contact.company_name ||
            'Unknown'
          return {
            value: String(contact.id),
            label: name,
            docketwiseId: contact.id,
          }
        },
      )

      return {
        options,
        hasMore: data.pagination?.nextPage !== null,
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      return { options: [], hasMore: false }
    }
  }

  const fetchMatters = async (search: string, page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('filter', search)
      const response = await fetch(`/api/docketwise/matters?${params}`)
      if (!response.ok) throw new Error('Failed to fetch matters')
      const data = await response.json()

      const options = (data.matters || []).map(
        (matter: { id: number; title: string }) => ({
          value: String(matter.id),
          label: matter.title,
          docketwiseId: matter.id,
        }),
      )

      return {
        options,
        hasMore: data.pagination?.nextPage !== null,
      }
    } catch (error) {
      console.error('Failed to fetch matters:', error)
      return { options: [], hasMore: false }
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Select files and assign them to a contact and matter before
            processing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Drop Zone */}
          <div
            className={cn(
              'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">
              Drag & drop files here, or click to browse
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              PDF, Images (JPG, PNG, WebP), and Documents (DOC, DOCX)
            </p>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <FieldLabel>Selected Files ({selectedFiles.length})</FieldLabel>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-4">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md bg-muted p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact and Matter Selection */}
          <div className="grid grid-cols-2 gap-6">
            <Field>
              <FieldLabel>Contact (Client) *</FieldLabel>
              <AdvancedSelect
                value={clientId}
                onValueChange={setClientId}
                placeholder="Select contact..."
                searchPlaceholder="Search contacts..."
                fetchOptions={fetchClients}
              />
            </Field>
            <Field>
              <FieldLabel>Matter *</FieldLabel>
              <AdvancedSelect
                value={matterId}
                onValueChange={setMatterId}
                placeholder="Select matter..."
                searchPlaceholder="Search matters..."
                fetchOptions={fetchMatters}
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Process Files
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
