import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import {
  Download,
  FileIcon,
  FileText,
  Image,
  Loader2,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface FileItem {
  id: string
  fileName: string
  fileType: string
  clientName: string
  matterName?: string
  uploadedAt: string
  status: 'processing' | 'completed' | 'failed'
  dropboxPath?: string
}

interface FilesTableProps {
  clientId?: string
  matterId?: string
}

export function FilesTable({ clientId, matterId }: FilesTableProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [files, setFiles] = useState<Array<FileItem>>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [search])

  // Reset page on date filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter])

  const fetchFiles = useCallback(
    async (page: number, searchTerm: string, date: string) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page) })
        if (clientId) params.set('clientId', clientId)
        if (matterId) params.set('matterId', matterId)
        if (searchTerm) params.set('search', searchTerm)
        if (date) params.set('date', date)
        const response = await fetch(`/api/files?${params}`)
        if (!response.ok) throw new Error('Failed to fetch files')
        const data = await response.json()
        setFiles(data.files || [])
        setTotalPages(data.totalPages || 1)
      } catch (error) {
        console.error('Failed to fetch files:', error)
        setFiles([])
      } finally {
        setIsLoading(false)
      }
    },
    [clientId, matterId],
  )

  useEffect(() => {
    fetchFiles(currentPage, debouncedSearch, dateFilter)
  }, [currentPage, debouncedSearch, dateFilter, fetchFiles])

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    if (fileType.includes('image')) {
      return <Image className="h-5 w-5 text-blue-500" />
    }
    return <FileIcon className="h-5 w-5 text-gray-500" />
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="Filter by date"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Matter</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading files...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No files found
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.fileType)}
                      <span className="font-medium">{file.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{file.clientName}</TableCell>
                  <TableCell>{file.matterName || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(file.uploadedAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{getStatusBadge(file.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!file.dropboxPath}
                      onClick={() => {
                        if (file.dropboxPath) {
                          window.open(
                            `/api/dropbox/download?path=${encodeURIComponent(file.dropboxPath)}`,
                            '_blank',
                          )
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
