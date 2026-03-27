import { CreateContactModal } from '@/components/create-contact-modal'
import { PageLoading } from '@/components/page-loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { isDocketwiseConnected } from '@/lib/auth-tokens'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const checkDocketwise = createServerFn({ method: 'GET' }).handler(async () => {
  const connected = await isDocketwiseConnected()
  return { connected }
})

export const Route = createFileRoute('/dashboard/contacts/')({
  component: ContactsPage,
  pendingComponent: PageLoading,
  loader: () => checkDocketwise(),
})

interface Contact {
  id: string
  firstName: string
  lastName: string | null
  middleName: string | null
  companyName: string | null
  email: string | null
  lead: boolean
  docketwiseId: number | null
  docketwiseUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

function ContactsPage() {
  const { connected } = Route.useLoaderData()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [contacts, setContacts] = useState<Array<Contact>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

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
      const params = new URLSearchParams({
        page: String(pageNum),
        per_page: '18',
      })
      if (filter) params.set('search', filter)
      const response = await fetch(`/api/contacts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch contacts')
      const data = await response.json()
      setContacts(data.contacts || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
      setContacts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts(page, debouncedSearch)
  }, [page, debouncedSearch, fetchContacts])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/contacts/sync', { method: 'POST' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Sync failed')
      }
      const { created, updated, unchanged } = await response.json()
      toast.success(
        `Synced: ${created} new, ${updated} updated, ${unchanged} unchanged`,
      )
      fetchContacts(page, debouncedSearch)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to sync contacts',
      )
    } finally {
      setIsSyncing(false)
    }
  }

  const getContactName = (contact: Contact) =>
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    contact.companyName ||
    'Unknown'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            {total} contact{total !== 1 ? 's' : ''} — Docketwise + Manual
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Docketwise'}
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Create Contact
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search contacts by name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 size-6 animate-spin" />
          <span>Loading contacts...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {getContactName(contact)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {contact.email || 'No email'}
                        </p>
                      </div>
                      <Badge
                        variant={contact.docketwiseId ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {contact.docketwiseId ? 'Docketwise' : 'Manual'}
                      </Badge>
                    </div>
                    {contact.companyName && (
                      <p className="text-sm text-muted-foreground">
                        {contact.companyName}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {contact.docketwiseId
                          ? `DW #${contact.docketwiseId}`
                          : `ID: ${contact.id.substring(0, 6)}`}
                      </span>
                      <Link
                        to="/dashboard/contacts/$contactId"
                        params={{ contactId: contact.id }}
                      >
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
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
              {debouncedSearch
                ? `No contacts matching "${debouncedSearch}"`
                : 'No contacts found. Sync from Docketwise or create a new contact.'}
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

      <CreateContactModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={() => fetchContacts(page, debouncedSearch)}
      />
    </div>
  )
}
