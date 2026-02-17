import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(main)/auth/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return <div>Sign In</div>
}
