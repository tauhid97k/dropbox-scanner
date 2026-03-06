import { createFileRoute } from '@tanstack/react-router'
import { Briefcase, FileText, Loader2, Search, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface Matter {
  id: string
  docketwiseId: string
  clientName: string
  matterType: string
  description?: string
  status: 'active' | 'inactive' | 'closed'
  fileCount: number
}

export const Route = createFileRoute('/dashboard/matters')({
  component: MattersPage,
})

function MattersPage() {
  const [matters, setMatters] = useState<Array<Matter>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchMatters()
  }, [])

  const fetchMatters = () => {
    try {
      // TODO: Replace with actual API call
      setMatters([
        {
          id: '1',
          docketwiseId: 'dw-123',
          clientName: 'John Doe',
          matterType: 'I-485 Adjustment',
          status: 'active',
          fileCount: 5,
        },
        {
          id: '2',
          docketwiseId: 'dw-124',
          clientName: 'Jane Smith',
          matterType: 'I-130 Petition',
          status: 'active',
          fileCount: 3,
        },
      ])
    } catch (error) {
      toast.error('Failed to load matters')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMatters = matters.filter(
    (m) =>
      m.clientName.toLowerCase().includes(search.toLowerCase()) ||
      m.matterType.toLowerCase().includes(search.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'closed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Briefcase className="h-6 w-6" />
            Matters
          </h1>
          <p className="text-gray-500">View and manage case matters</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search matters..."
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
              {filteredMatters.map((matter) => (
                <div
                  key={matter.id}
                  className="-mx-4 flex cursor-pointer items-center justify-between rounded-lg px-4 py-4 hover:bg-gray-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{matter.matterType}</h3>
                      <Badge className={getStatusColor(matter.status)}>
                        {matter.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {matter.clientName}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {matter.fileCount} files
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
              {filteredMatters.length === 0 && (
                <p className="py-8 text-center text-gray-500">
                  No matters found
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
