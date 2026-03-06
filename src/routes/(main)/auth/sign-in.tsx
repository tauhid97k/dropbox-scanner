import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { LuEye, LuEyeOff, LuLock, LuMail } from 'react-icons/lu'
import { toast } from 'sonner'
import type {SignInSchemaType} from '@/schema/authSchema';
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { FormError } from '@/components/ui/form-error'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { signIn } from '@/lib/auth-client'
import {  signInSchema } from '@/schema/authSchema'

export const Route = createFileRoute('/(main)/auth/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const [pendingAuth, setPendingAuth] = useState<boolean>(false)
  const [formError, setFormError] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // On Submit
  const onSubmit = async (values: SignInSchemaType) => {
    await signIn.email(
      {
        email: values.email,
        password: values.password,
      },
      {
        onRequest: () => {
          setPendingAuth(true)
          setFormError('')
        },
        onSuccess: () => {
          toast.success('Login successful')
          Route.redirect({ to: '/dashboard' })
        },
        onError: (ctx) => {
          setFormError(ctx.error.message)
        },
      },
    )

    setPendingAuth(false)
  }

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription className="text-center">
          Enter your account details to login
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldSet disabled={pendingAuth}>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <LuMail />
                      </InputGroupAddon>
                      <InputGroupInput
                        autoComplete="email"
                        {...field}
                        id="email"
                        placeholder="john@example.com"
                      />
                    </InputGroup>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <LuLock />
                      </InputGroupAddon>
                      <InputGroupInput
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        {...field}
                        id="password"
                        placeholder="password"
                      />
                      <InputGroupButton
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <LuEye /> : <LuEyeOff />}
                      </InputGroupButton>
                    </InputGroup>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <FormError message={formError} />
              <Button
                type="submit"
                className="mt-2 w-full"
                isLoading={pendingAuth}
              >
                Sign In
              </Button>
            </FieldGroup>
          </FieldSet>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1 text-center text-sm">
          <span className="text-muted-foreground">
            Don&apos;t have an account?
          </span>
          <Link
            to="/auth/sign-up"
            className="underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-hidden"
          >
            Sign Up
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
