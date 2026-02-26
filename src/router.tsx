import { BProgress } from '@bprogress/core'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import NotFound from './components/system/not-found'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => {
      return (
        <div className="grid min-h-svh place-items-center">
          <NotFound />
        </div>
      )
    },
  })

  if (typeof window !== 'undefined') {
    // Progress bar Start
    router.subscribe('onBeforeNavigate', ({ pathChanged }) => {
      pathChanged && BProgress.start()
    })

    // Progress bar Done
    router.subscribe('onResolved', () => {
      BProgress.done()
    })
  }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
