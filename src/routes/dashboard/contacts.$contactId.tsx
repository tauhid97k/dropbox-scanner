import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  Download,
  FileIcon,
  FileText,
  Image,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/dashboard/contacts/$contactId')({
  component: ContactDetailPage,
})

interface ContactFile {
  id: string
  fileName: string
  fileType: string
  status: string
  dropboxPath: string | null
  createdAt: string
}

function ContactDetailPage() {
  const { contactId } = Route.useParams()
  const [files, setFiles] = useState<ContactFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [contactName, setContactName] = useState<string | null>(null)

  const fetchContactFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/files?clientId=${contactId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setFiles(data.files || [])
      // Try to get the contact name from Docketwise
      if (!contactName) {
        const contactRes = await fetch(
          `/api/docketwise/contacts?filter=${contactId}`,
        )
        if (contactRes.ok) {
          const contactData = await contactRes.json()
          const contact = (contactData.contacts || []).find(
            (c: { id: number }) => String(c.id) === contactId,
          )
          if (contact) {
            const name =
              [contact.first_name, contact.last_name]
                .filter(Boolean)
                .join(' ') ||
              contact.company_name ||
              null
            setContactName(name)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch contact files:', error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [contactId, contactName])

  useEffect(() => {
    fetchContactFiles()
  }, [fetchContactFiles])

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('pdf'))
      return <FileText className="h-5 w-5 text-red-500" />
    if (fileType?.includes('image'))
      return <Image className="h-5 w-5 text-blue-500" />
    return <FileIcon className="h-5 w-5 text-gray-500" />
  }

  const filteredFiles = files.filter((f) =>
    f.fileName.toLowerCase().includes(search.toLowerCase()),
  )

  const displayName = contactName || `Contact ${contactId}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground">
            {files.length} file(s) uploaded for this contact
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchContactFiles}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Button asChild variant="outline" className="h-10 shrink-0">
          <Link to="/dashboard/contacts">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <InputGroup className="flex-1">
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {files.filter((f) => f.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Processing / Failed
            </CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                files.filter(
                  (f) => f.status === 'processing' || f.status === 'failed',
                ).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading files...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No files found for this contact
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Dropbox Path</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.fileType)}
                          <span className="font-medium">{file.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {file.status}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {file.dropboxPath || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {file.dropboxPath && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              window.open(
                                `/api/dropbox/download?path=${encodeURIComponent(file.dropboxPath!)}`,
                                '_blank',
                              )
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
