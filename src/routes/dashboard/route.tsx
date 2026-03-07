import NotFound from '@/components/system/not-found'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UploadModal } from '@/components/upload-modal'
import { signOut } from '@/lib/auth-client'
import { getSession } from '@/lib/auth-session'
import { cn } from '@/lib/utils'
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import {
  Bell,
  FileText,
  Home,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useLayoutEffect, useState } from 'react'

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/sign-in' })
    }
    return { session }
  },
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
  { name: 'Dashboard', to: '/dashboard' as const, icon: Home },
  { name: 'Contacts', to: '/dashboard/contacts' as const, icon: Users },
  { name: 'Files', to: '/dashboard/files' as const, icon: FileText },
  { name: 'Queue', to: '/dashboard/queue' as const, icon: ListTodo },
  {
    name: 'Notifications',
    to: '/dashboard/notifications' as const,
    icon: Bell,
  },
  { name: 'Settings', to: '/dashboard/settings' as const, icon: Settings },
]

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Close mobile sidebar on route change
  useLayoutEffect(() => {
    setMobileOpen(false)
  }, [router.state.location.pathname])

  // Handle sign out
  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.navigate({ to: '/auth/sign-in' })
        },
      },
    })
  }

  const SidebarNav = () => (
    <nav className="grow space-y-1.5 overflow-y-auto p-6">
      {navigation.map((item) => (
        <Link
          key={item.name}
          to={item.to}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-secondary-foreground/70 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-hidden"
          activeProps={{
            className:
              'bg-primary !text-white hover:!bg-primary focus-visible:!bg-primary',
          }}
          activeOptions={{ exact: item.to === '/dashboard' }}
        >
          <item.icon className="icon" />
          <span>{item.name}</span>
        </Link>
      ))}
      <Button
        variant="mist"
        size="lg"
        onClick={() => setUploadModalOpen(true)}
        className="mt-4 w-full text-base"
      >
        <Upload className="h-5 w-5" />
        Upload Files
      </Button>
    </nav>
  )

  return (
    <div className="fixed flex size-full">
      {/* Mobile Sidebar */}
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex items-center gap-3">
              <img src="/dropbox.png" alt="Dropbox" className="h-6 w-6" />
              <DrawerTitle>Dropbox Scanner</DrawerTitle>
            </div>
            <DrawerClose
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'icon' }),
              )}
            >
              <X className="h-4 w-4" />
            </DrawerClose>
          </DrawerHeader>
          <DrawerDescription className="sr-only">
            Mobile sidebar navigation
          </DrawerDescription>
          <SidebarNav />
        </DrawerContent>
      </Drawer>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden w-72 shrink-0 flex-col border-r bg-card transition-[margin] duration-300 md:flex',
          sidebarCollapsed && '-ml-72',
        )}
      >
        <div className="flex h-16 items-center justify-center gap-3 border-b">
          <img src="/dropbox.png" alt="Dropbox" className="h-6 w-6" />
          <h1 className="text-xl font-bold">Dropbox Scanner</h1>
        </div>
        <SidebarNav />
      </aside>

      {/* Main Content */}
      <div className="flex w-full flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(true)
                } else {
                  setSidebarCollapsed(!sidebarCollapsed)
                }
              }}
            >
              <Menu />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* Profile Dropdown */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="lg" className="px-3">
                  <span className="hidden text-xs sm:inline">
                    {session?.user?.email}
                  </span>
                  <UserRound />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/settings">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="grow overflow-y-auto bg-zinc-100 p-6">
          <Outlet />
        </main>
      </div>
      <UploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  )
}
