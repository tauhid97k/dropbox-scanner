import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import Spinner from './spinner'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap ring-offset-background transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50',
        mist: 'bg-mist-500 text-white hover:bg-mist-500/90 focus-visible:ring-mist-500/50',
        destructive:
          'bg-destructive/80 text-white hover:bg-destructive/90 focus-visible:ring-destructive/50',
        outline:
          'border-2 border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-600',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/90 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-600',
        ghost:
          'hover:bg-accent hover:text-accent-foreground focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-600',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 gap-1.5 px-2.5 [&_svg]:size-4',
        lg: 'h-10 px-6',
        icon: 'size-9',
        'icon-sm': 'size-8 [&_svg]:size-4',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  isLoading,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner className="dark:stroke-white" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
