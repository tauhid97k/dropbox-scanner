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
import { isDropboxConnected } from '@/lib/auth-tokens'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  AlertCircle,
  ArrowLeft,
  FileIcon,
  FileText,
  Folder,
  Image,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const checkDropbox = createServerFn({ method: 'GET' }).handler(async () => {
  const connected = await isDropboxConnected()
  return { connected }
})

export const Route = createFileRoute('/dashboard/files')({
  component: FilesPage,
  loader: () => checkDropbox(),
})

interface DropboxFile {
  name: string
  path: string
  size: number
  modified: string
}

function FilesPage() {
  const { connected } = Route.useLoaderData()
  const [folders, setFolders] = useState<string[]>([])
  const [files, setFiles] = useState<DropboxFile[]>([])
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchFolders = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/dropbox/files')
      if (!res.ok) throw new Error('Failed to fetch folders')
      const data = await res.json()
      setFolders(data.folders || [])
    } catch (error) {
      console.error('Failed to fetch folders:', error)
      setFolders([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchFiles = useCallback(async (folder: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/dropbox/files?folder=${encodeURIComponent(folder)}`,
      )
      if (!res.ok) throw new Error('Failed to fetch files')
      const data = await res.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Failed to fetch files:', error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (connected) {
      if (activeFolder) {
        fetchFiles(activeFolder)
      } else {
        fetchFolders()
      }
    } else {
      setIsLoading(false)
    }
  }, [connected, activeFolder, fetchFolders, fetchFiles])

  const openFolder = (folder: string) => {
    setActiveFolder(folder)
    setSearch('')
  }

  const goBack = () => {
    setActiveFolder(null)
    setFiles([])
    setSearch('')
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '—'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || ''))
      return <Image className="h-5 w-5 text-blue-500" />
    return <FileIcon className="h-5 w-5 text-gray-500" />
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            Browse files stored in Dropbox
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-semibold">Dropbox Not Connected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your Dropbox account to upload and manage files.
              </p>
            </div>
            <Button asChild>
              <Link to="/dashboard/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filter folders or files by search
  const filteredFolders = folders.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            {activeFolder
              ? `Files in ${activeFolder}`
              : 'Client folders in Dropbox'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            activeFolder ? fetchFiles(activeFolder) : fetchFolders()
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        {activeFolder && (
          <Button variant="outline" size="sm" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={activeFolder ? 'Search files...' : 'Search folders...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeFolder ? `${activeFolder}` : 'Client Folders'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              <span>
                {activeFolder ? 'Loading files...' : 'Loading folders...'}
              </span>
            </div>
          ) : activeFolder ? (
            // File listing
            filteredFiles.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No files found in this folder
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead>Path</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => (
                      <TableRow key={file.path}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(file.name)}
                            <span className="font-medium">{file.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatSize(file.size)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {file.modified
                            ? new Date(file.modified).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {file.path}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : // Folder listing
          filteredFolders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No folders found. Upload files to create client folders.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFolders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => openFolder(folder)}
                  className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-secondary"
                >
                  <Folder className="h-8 w-8 shrink-0 text-blue-500" />
                  <span className="truncate font-medium">{folder}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
