import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 rounded text-sm font-semibold transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground dark:bg-primary/70',
        secondary: 'bg-secondary text-secondary-foreground',
        warning: 'bg-amber-500 text-primary-foreground dark:bg-amber-500/70',
        success:
          'bg-emerald-500 text-primary-foreground dark:bg-emerald-500/70',
        destructive: 'bg-destructive/70 text-white',
        outline: 'border border-border bg-transparent text-foreground',
      },
      size: {
        default: 'px-3 py-1',
        icon: 'p-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
