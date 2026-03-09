import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerTarget = useRef<HTMLDivElement | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const loadOptions = useCallback(
    async (searchTerm: string, pageNum: number, append = false) => {
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
      } catch (error) {
        console.error('Failed to load options:', error)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
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
      setPage(1)
      loadOptions(search, 1, false)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [search, loadOptions])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !isLoading &&
          !isLoadingMore
        ) {
          const nextPage = page + 1
          setPage(nextPage)
          loadOptions(search, nextPage, true)
        }
      },
      { threshold: 0.1 },
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, isLoading, isLoadingMore, page, search, loadOptions])

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
                {options.length === 0 && (
                  <CommandEmpty>{emptyText}</CommandEmpty>
                )}
                {options.length > 0 && (
                  <CommandGroup>
                    {options.map((option) => {
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
                        ref={observerTarget}
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
