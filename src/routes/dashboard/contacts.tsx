import { Eye, FileText, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/dashboard/contacts')({
  component: ContactsPage,
})

interface Contact {
  id: string
  name: string
  email: string
  docketwiseContactId: number
  fileCount: number
}

function ContactsPage() {
  const [search, setSearch] = useState('')
  const [contacts] = useState<Array<Contact>>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      docketwiseContactId: 8116,
      fileCount: 12,
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      docketwiseContactId: 8117,
      fileCount: 8,
    },
  ])

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">Manage your client contacts</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredContacts.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{contact.fileCount} files</span>
                  </div>
                  <Link to={`/dashboard/contacts/${contact.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View Files
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No contacts found
        </div>
      )}
    </div>
  )
}
