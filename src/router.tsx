import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import NotFound from './components/system/not-found'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: false,
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => {
      return (
        <div className="min-h-screen grid place-items-center">
          <NotFound />
        </div>
      )
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
