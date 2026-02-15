import NotFound from '@/components/system/not-found'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
  notFoundComponent: () => {
    return (
      <div className="h-full grid place-items-center">
        <NotFound />
      </div>
    )
  },
})

function DashboardLayout() {
  return (
    <div className="fixed flex size-full">
      {/* Sidebar Here */}
      <div className="flex w-full flex-col overflow-hidden">
        {/* Header Here */}
        <main className="grow overflow-y-auto bg-neutral-100 p-6 dark:bg-background">
          <Outlet />
        </main>
        {/* Notification Side Panel Here */}
      </div>
    </div>
  )
}
