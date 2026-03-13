import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface AdvancedSelectOption {
  value: string
  label: string
  description?: string
  docketwiseId?: number
}

interface AdvancedSelectProps {
  value?: string
  onValueChange: (value: string) => void
  onOptionSelect?: (option: AdvancedSelectOption | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  fetchOptions: (
    search: string,
    page: number,
  ) => Promise<{
    options: Array<AdvancedSelectOption>
    hasMore: boolean
  }>
  disabled?: boolean
  className?: string
}

export function AdvancedSelect({
  value,
  onValueChange,
  onOptionSelect,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  fetchOptions,
  disabled = false,
  className,
}: AdvancedSelectProps) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Array<AdvancedSelectOption>>([])
  const [search, setSearch] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const pageRef = useRef(1)
  const searchRef = useRef('')
  const loadingRef = useRef(false)

  const loadOptions = useCallback(
    async (searchTerm: string, pageNum: number, append = false) => {
      if (loadingRef.current) return
      loadingRef.current = true

      if (pageNum === 1) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      try {
        const result = await fetchOptions(searchTerm, pageNum)
        setOptions((prev) =>
          append ? [...prev, ...result.options] : result.options,
        )
        setHasMore(result.hasMore)
        pageRef.current = pageNum
        searchRef.current = searchTerm
      } catch (error) {
        console.error('Failed to load options:', error)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [fetchOptions],
  )

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      pageRef.current = 1
      loadOptions(search, 1, false)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [search, loadOptions])

  // Keep the observer instance in sync with loadOptions
  useEffect(() => {
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) {
          const nextPage = pageRef.current + 1
          loadOptions(searchRef.current, nextPage, true)
        }
      },
      { threshold: 0.1 },
    )
    return () => {
      observerRef.current?.disconnect()
    }
  }, [loadOptions])

  // Callback ref — attaches/detaches observer when the sentinel div mounts/unmounts
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    // Disconnect from any previous node
    observerRef.current?.disconnect()
    // Observe the new node if it exists
    if (node) {
      observerRef.current?.observe(node)
    }
  }, [])

  // Client-side filtering as fallback (API filter may not match all cases)
  const filteredOptions = useMemo(() => {
    if (!search) return options
    const term = search.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.description && o.description.toLowerCase().includes(term)),
    )
  }, [options, search])

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-sm transition-colors hover:border-input focus-visible:border-primary focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span
            className={cn(
              'flex-1 truncate text-left',
              !selectedOption && 'text-muted-foreground',
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="size-5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-75 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Loading...
                </span>
              </div>
            ) : (
              <>
                {filteredOptions.length === 0 && (
                  <CommandEmpty>{emptyText}</CommandEmpty>
                )}
                {filteredOptions.length > 0 && (
                  <CommandGroup>
                    {filteredOptions.map((option) => {
                      const isSelected = value === option.value
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={(currentValue) => {
                            const newValue =
                              currentValue === value ? '' : currentValue
                            onValueChange(newValue)
                            if (onOptionSelect) {
                              const selected = newValue
                                ? options.find((o) => o.value === newValue) ||
                                  null
                                : null
                              onOptionSelect(selected)
                            }
                            setOpen(false)
                          }}
                          className={cn(
                            'flex cursor-pointer items-center justify-between',
                            isSelected && 'bg-accent',
                          )}
                        >
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            {option.description && (
                              <span className="text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="size-4" />}
                        </CommandItem>
                      )
                    })}
                    {hasMore && (
                      <div
                        ref={sentinelRef}
                        className="flex items-center justify-center gap-2 py-2"
                      >
                        {isLoadingMore && (
                          <>
                            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="text-xs text-muted-foreground">
                              Loading...
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
