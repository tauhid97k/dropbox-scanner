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
import { signUp } from '@/lib/auth-client'
import { signUpSchema, type SignUpSchemaType } from '@/schema/authSchema'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  LuBuilding,
  LuEye,
  LuEyeOff,
  LuLock,
  LuMail,
  LuUserRound,
} from 'react-icons/lu'
import { toast } from 'sonner'

export const Route = createFileRoute('/(main)/auth/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  const [pendingAuth, setPendingAuth] = useState<boolean>(false)
  const [formError, setFormError] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      organizationName: '',
      password: '',
    },
  })

  // On Submit
  const onSubmit = async (values: SignUpSchemaType) => {
    await signUp.email(
      {
        name: values.name,
        email: values.email,
        password: values.password,
      },
      {
        onRequest: () => {
          setPendingAuth(true)
          setFormError('')
        },
        onSuccess: () => {
          toast.success('Registration successful')
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
        <CardTitle className="text-2xl">Sign Up</CardTitle>
        <CardDescription className="text-center">
          Create an account to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
          <FieldSet>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <LuUserRound />
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="name"
                        placeholder="John Doe"
                      />
                    </InputGroup>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
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
                name="organizationName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="organizationName">
                      Organization Name
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <LuBuilding />
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="organizationName"
                        placeholder="acme inc"
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
                        autoComplete="new-password"
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
                Sign Up
              </Button>
            </FieldGroup>
          </FieldSet>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1 text-center text-sm">
          <span className="text-muted-foreground">
            Already have an account?
          </span>
          <Link
            to="/auth/sign-in"
            className="underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-hidden"
          >
            Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
