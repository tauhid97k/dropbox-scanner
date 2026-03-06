import { Upload, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface FileDropzoneProps {
  onFilesSelected: (files: Array<File>) => void
  maxSize?: number // in bytes
  accept?: Record<string, Array<string>>
}

export function FileDropzone({
  onFilesSelected,
  maxSize = 50 * 1024 * 1024, // 50MB default
  accept = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  },
}: FileDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<Array<File>>([])

  const onDrop = useCallback(
    (acceptedFiles: Array<File>, rejectedFiles: Array<unknown>) => {
      if (rejectedFiles.length > 0) {
        toast.error('Some files were rejected. Check file type and size.')
      }

      if (acceptedFiles.length > 0) {
        setSelectedFiles(acceptedFiles)
        onFilesSelected(acceptedFiles)
        toast.success(`${acceptedFiles.length} file(s) selected`)
      }
    },
    [onFilesSelected],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    accept,
    multiple: false,
  })

  const removeFile = () => {
    setSelectedFiles([])
    onFilesSelected([])
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const getFileIcon = (file: File) => {
    if (file.type.includes('pdf')) return '📄'
    if (file.type.includes('image')) return '🖼️'
    return '📎'
  }

  if (selectedFiles.length > 0) {
    const file = selectedFiles[0]
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getFileIcon(file)}</span>
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200',
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center space-y-3">
        <div
          className={cn(
            'rounded-full p-3 transition-colors duration-200',
            isDragActive ? 'bg-blue-100' : 'bg-gray-100',
          )}
        >
          <Upload
            className={cn(
              'h-8 w-8 transition-colors duration-200',
              isDragActive ? 'text-blue-600' : 'text-gray-400',
            )}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? 'Drop file here' : 'Drag & drop your file here'}
          </p>
          <p className="text-xs text-gray-500">
            or{' '}
            <span className="text-blue-600 hover:underline">
              click to browse
            </span>
          </p>
        </div>
        <p className="text-xs text-gray-400">
          PDF, JPG, PNG up to {formatFileSize(maxSize)}
        </p>
      </div>
    </div>
  )
}
