import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(main)/')({ component: App })

function App() {
  return <h1 className="text-center my-8">Home Page</h1>
}
