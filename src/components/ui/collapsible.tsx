import { cn } from '@/lib/utils'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import type * as React from 'react'

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn(
        'data-[state=closed]:animate-collapsible-collapse data-[state=open]:animate-collapsible-expand overflow-hidden transition-[height]',
        className,
      )}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Content>
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
