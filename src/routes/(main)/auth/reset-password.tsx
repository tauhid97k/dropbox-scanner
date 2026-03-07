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
import { resetPassword } from '@/lib/auth-client'
import type { ResetPasswordSchemaType } from '@/schema/authSchema'
import { resetPasswordSchema } from '@/schema/authSchema'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { LuEye, LuEyeOff, LuLock } from 'react-icons/lu'
import { toast } from 'sonner'
import * as z from 'zod'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/(main)/auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search) => searchSchema.parse(search),
})

function ResetPasswordPage() {
  const router = useRouter()
  const { token } = Route.useSearch()
  const [pendingAuth, setPendingAuth] = useState<boolean>(false)
  const [formError, setFormError] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
    },
  })

  const onSubmit = async (values: ResetPasswordSchemaType) => {
    if (!token) {
      setFormError('Invalid token! Please check your email again')
      return
    }

    await resetPassword(
      {
        newPassword: values.password,
        token,
      },
      {
        onRequest: () => {
          setPendingAuth(true)
          setFormError('')
        },
        onSuccess: () => {
          toast.success('Password reset successful')
          router.navigate({ to: '/auth/sign-in' })
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
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription className="text-center">
          Enter new password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldSet disabled={pendingAuth}>
            <FieldGroup>
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
                        {...field}
                        id="password"
                        placeholder="Enter new password"
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
                className="mt-4 w-full"
                isLoading={pendingAuth}
              >
                Reset Password
              </Button>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  )
}
