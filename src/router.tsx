import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import NotFound from './components/system/not-found'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: false,
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => {
      return (
        <div className="grid min-h-screen place-items-center">
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
