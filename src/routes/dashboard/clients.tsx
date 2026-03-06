import { createFileRoute } from '@tanstack/react-router'
import { FileText, Loader2, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Client {
  id: string
  name: string
  email?: string
  fileCount: number
  lastUpload?: string
}

export const Route = createFileRoute('/dashboard/clients')({
  component: ClientsPage,
})

function ClientsPage() {
  const [clients, setClients] = useState<Array<Client>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/clients')
      // const data = await response.json()
      // setClients(data)
      setClients([
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          fileCount: 5,
          lastUpload: '2026-03-05',
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          fileCount: 3,
          lastUpload: '2026-03-04',
        },
      ])
    } catch (error) {
      toast.error('Failed to load clients')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6" />
            Clients
          </h1>
          <p className="text-gray-500">Manage client documents and uploads</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="divide-y">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="-mx-4 flex cursor-pointer items-center justify-between rounded-lg px-4 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <span className="font-medium text-blue-600">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium">{client.name}</h3>
                      {client.email && (
                        <p className="text-sm text-gray-500">{client.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <FileText className="h-4 w-4" />
                        {client.fileCount} files
                      </div>
                      {client.lastUpload && (
                        <p className="text-xs text-gray-400">
                          Last upload: {client.lastUpload}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              ))}
              {filteredClients.length === 0 && (
                <p className="py-8 text-center text-gray-500">
                  No clients found
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
