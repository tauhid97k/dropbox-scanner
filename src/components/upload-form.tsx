import { FileDropzone } from '@/components/file-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UploadFormData } from '@/schema/upload'
import { uploadSchema } from '@/schema/upload'
import { zodResolver } from '@hookform/resolvers/zod'
import { Folder, Loader2, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface UploadFormProps {
  onUpload: (data: UploadFormData & { file: File }) => Promise<void>
  isUploading: boolean
}

export function UploadForm({ onUpload, isUploading }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const form = useForm<Omit<UploadFormData, 'file'>>({
    resolver: zodResolver(uploadSchema.omit({ file: true })),
    defaultValues: {
      clientName: '',
      matterId: '',
    },
  })

  const onSubmit = async (values: Omit<UploadFormData, 'file'>) => {
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }

    await onUpload({ ...values, file: selectedFile })
    setSelectedFile(null)
    form.reset()
  }

  return (
    <Card className="border-2">
      <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-blue-500" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* File Dropzone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Document</Label>
            <FileDropzone
              onFilesSelected={(files) => setSelectedFile(files[0] || null)}
            />
            {selectedFile && (
              <p className="text-xs text-green-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          {/* Client & Matter Fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Client Name
              </Label>
              <Input
                placeholder="Leave empty for auto-detection"
                {...form.register('clientName')}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Matter
              </Label>
              <Input placeholder="Optional" {...form.register('matterId')} />
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>AI Auto-Detection:</strong> If you leave the client name
              empty, our AI will analyze the document and suggest the
              appropriate client and matter type.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isUploading || !selectedFile}
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
        </form>
      </CardContent>
    </Card>
  )
}
