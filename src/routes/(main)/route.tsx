import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(main)')({
  component: MainLayout,
})

function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar Here */}
      <Outlet />
      {/* Footer Here */}
    </div>
  )
}
