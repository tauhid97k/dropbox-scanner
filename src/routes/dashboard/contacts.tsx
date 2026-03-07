import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/dashboard/contacts')({
  component: ContactsPage,
})

interface Contact {
  id: number
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  lead: boolean
}

function ContactsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [contacts, setContacts] = useState<Array<Contact>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Check Docketwise connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/docketwise/status')
        if (response.ok) {
          const data = await response.json()
          setIsConnected(data.docketwise)
        } else {
          setIsConnected(false)
        }
      } catch {
        setIsConnected(false)
      }
    }
    checkConnection()
  }, [])

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [search])

  const fetchContacts = useCallback(async (pageNum: number, filter: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageNum) })
      if (filter) params.set('filter', filter)
      const response = await fetch(`/api/docketwise/contacts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch contacts')
      const data = await response.json()
      setContacts(data.contacts || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
      setContacts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isConnected) {
      fetchContacts(page, debouncedSearch)
    } else {
      setIsLoading(false)
    }
  }, [page, debouncedSearch, fetchContacts, isConnected])

  const getContactName = (contact: Contact) =>
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.company_name ||
    'Unknown'

  if (isConnected === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Checking connection...</span>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Contacts from Docketwise</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-semibold">Docketwise Not Connected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your Docketwise account to view and manage contacts.
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">Contacts from Docketwise</p>
      </div>

      <div className="flex items-center gap-4">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading contacts...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">
                        {getContactName(contact)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {contact.email || 'No email'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>ID: {contact.id}</span>
                      </div>
                      <Link
                        to="/dashboard/contacts/$contactId"
                        params={{ contactId: String(contact.id) }}
                      >
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {contacts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No contacts found
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
