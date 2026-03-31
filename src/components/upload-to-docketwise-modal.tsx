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
import { FileText, Loader2, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

interface UploadToDocketwiseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  fileName: string
}

export function UploadToDocketwiseModal({
  open,
  onOpenChange,
  filePath,
  fileName,
}: UploadToDocketwiseModalProps) {
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientDocketwiseId, setClientDocketwiseId] = useState<number | null>(
    null,
  )
  const [matterId, setMatterId] = useState('')
  const [matterName, setMatterName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [matterKey, setMatterKey] = useState(0)

  const resetState = () => {
    setClientId('')
    setClientName('')
    setClientDocketwiseId(null)
    setMatterId('')
    setMatterName('')
    setIsUploading(false)
    setMatterKey((k) => k + 1)
  }

  const handleClose = (open: boolean) => {
    if (!open) resetState()
    onOpenChange(open)
  }

  // Only fetch Docketwise contacts (source=docketwise)
  const fetchDocketwiseClients = useCallback(
    async (search: string, page: number) => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: '15',
          source: 'docketwise',
        })
        if (search) params.set('search', search)
        const response = await fetch(`/api/contacts?${params}`)
        if (!response.ok) throw new Error('Failed to fetch contacts')
        const data = await response.json()

        const options = (data.contacts || []).map(
          (contact: {
            id: string
            firstName: string
            lastName: string | null
            companyName: string | null
            docketwiseId: number | null
          }) => {
            const name =
              [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
              contact.companyName ||
              'Unknown'
            return {
              value: contact.id,
              label: name,
              docketwiseId: contact.docketwiseId ?? undefined,
            }
          },
        )

        return {
          options,
          hasMore: data.pagination?.hasMore ?? false,
        }
      } catch (error) {
        console.error('Failed to fetch Docketwise contacts:', error)
        return { options: [], hasMore: false }
      }
    },
    [],
  )

  const fetchMatters = useCallback(
    async (search: string, page: number) => {
      if (!clientDocketwiseId) return { options: [], hasMore: false }

      try {
        const params = new URLSearchParams({
          page: String(page),
          client_id: String(clientDocketwiseId),
          per_page: '15',
        })
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
          hasMore: data.pagination?.nextPage != null,
        }
      } catch (error) {
        console.error('Failed to fetch matters:', error)
        return { options: [], hasMore: false }
      }
    },
    [clientDocketwiseId],
  )

  const handleUpload = async () => {
    if (!clientId || !clientDocketwiseId) {
      toast.error('Please select a Docketwise contact')
      return
    }
    if (!matterId) {
      toast.error('Please select a matter')
      return
    }

    setIsUploading(true)
    try {
      const response = await fetch('/api/docketwise/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          fileName,
          clientId: String(clientDocketwiseId),
          clientName,
          matterId,
          matterName,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Upload failed')
      }

      toast.success(`"${fileName}" uploaded to Docketwise successfully`)
      handleClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload to Docketwise</DialogTitle>
          <DialogDescription>
            Select a Docketwise client and matter to upload this file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* File being uploaded */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{fileName}</span>
          </div>

          {/* Docketwise client — only DW contacts */}
          <Field>
            <FieldLabel>Docketwise Client *</FieldLabel>
            <AdvancedSelect
              value={clientId}
              onValueChange={(val) => {
                setClientId(val)
                setMatterId('')
                setMatterName('')
                setMatterKey((k) => k + 1)
              }}
              onOptionSelect={(opt) => {
                setClientName(opt?.label || '')
                setClientDocketwiseId(opt?.docketwiseId ?? null)
              }}
              placeholder="Select Docketwise client..."
              searchPlaceholder="Search clients..."
              emptyText="No Docketwise clients found. Sync contacts first."
              fetchOptions={fetchDocketwiseClients}
            />
          </Field>

          {/* Matter — required */}
          <Field>
            <FieldLabel>Matter *</FieldLabel>
            <AdvancedSelect
              key={matterKey}
              value={matterId}
              onValueChange={setMatterId}
              onOptionSelect={(opt) => setMatterName(opt?.label || '')}
              placeholder={
                clientDocketwiseId
                  ? 'Select matter...'
                  : 'Select a client first...'
              }
              searchPlaceholder="Search matters..."
              emptyText={
                clientDocketwiseId
                  ? 'No matters found for this client.'
                  : 'Select a client first.'
              }
              fetchOptions={fetchMatters}
              disabled={!clientDocketwiseId}
            />
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !clientId || !matterId}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload to Docketwise
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
