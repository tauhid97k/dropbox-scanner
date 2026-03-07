import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

const sheetVariants = cva('fixed flex flex-col bg-card outline-none', {
  variants: {
    side: {
      top: 'inset-x-0 top-0 max-h-[calc(100%-6rem)] border-b',
      bottom: 'inset-x-0 bottom-0 max-h-[calc(100%-6rem)] border-t',
      left: 'inset-y-0 left-0 h-full w-full max-w-72 border-r',
      right:
        'inset-y-0 right-0 h-full w-full max-w-72 border-l border-black/70 dark:border-inherit',
    },
  },
  defaultVariants: {
    side: 'left',
  },
})

function Drawer({
  direction = 'left',
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root autoFocus={true} direction={direction} {...props} />
  )
}

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerHandle = DrawerPrimitive.Handle

const DrawerClose = DrawerPrimitive.Close

function DrawerContent({
  className,
  children,
  side,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> &
  VariantProps<typeof sheetVariants>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
      <DrawerPrimitive.Content
        className={cn(sheetVariants({ side }), 'z-50', className)}
        {...props}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-h-16 shrink-0 flex-wrap items-center justify-between border-b px-6',
        className,
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn('text-sm font-medium text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
}
