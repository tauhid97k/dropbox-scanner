import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import {
  Bell,
  FileText,
  Home,
  ListTodo,
  Settings,
  Upload,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import NotFound from '@/components/system/not-found'
import { Button } from '@/components/ui/button'
import { UploadModal } from '@/components/upload-modal'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
  notFoundComponent: () => {
    return (
      <div className="grid h-full place-items-center">
        <NotFound />
      </div>
    )
  },
})

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: Home },
  { name: 'Contacts', to: '/dashboard/contacts', icon: Users },
  { name: 'Files', to: '/dashboard/files', icon: FileText },
  { name: 'Queue', to: '/dashboard/queue', icon: ListTodo },
  { name: 'Notifications', to: '/dashboard/notifications', icon: Bell },
  { name: 'Settings', to: '/dashboard/settings', icon: Settings },
]

function DashboardLayout() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  return (
    <div className="fixed flex size-full">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-white">
        <div className="border-b p-6">
          <h1 className="text-xl font-bold">Dropbox Scanner</h1>
          <p className="text-xs text-gray-500">
            AI-Powered Document Management
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-100"
              activeProps={{
                className: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
              }}
              activeOptions={{ exact: item.to === '/dashboard' }}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="mt-4 w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </nav>

        <div className="border-t p-4">
          <p className="text-xs text-gray-400">
            Connected to Dropbox & Docketwise
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex w-full flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <h2 className="text-lg font-medium">Document Management</h2>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="grow overflow-y-auto bg-gray-50 p-6 dark:bg-background">
          <Outlet />
        </main>
      </div>
      <UploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  )
}
