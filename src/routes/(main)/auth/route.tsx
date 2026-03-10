import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(main)/auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="grid grow place-items-center bg-neutral-100 px-4 py-6 dark:bg-background">
      <main className="flex w-full max-w-md flex-col gap-8">
        <div className="flex justify-center">
          <img src="/logo.png" alt="Brand Logo" width={200} />
        </div>
        <Outlet />
      </main>
    </div>
  )
}
