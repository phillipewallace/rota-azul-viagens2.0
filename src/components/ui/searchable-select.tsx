import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface SearchableSelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Minimum options before search input is shown. Default 5. */
  searchThreshold?: number;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

/**
 * Drop-in replacement for shadcn <Select> with built-in text search.
 * Keeps the same visual trigger (h-10 border rounded-md) so layouts are
 * preserved. Filters by `label` and optional `hint`.
 */
export const SearchableSelect = React.forwardRef<
  HTMLButtonElement,
  SearchableSelectProps
>(
  (
    {
      value,
      onValueChange,
      options,
      placeholder = "Selecione...",
      searchPlaceholder = "Buscar...",
      emptyText = "Nenhum resultado",
      disabled,
      className,
      triggerClassName,
      searchThreshold = 5,
      id,
      name,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const internalRef = React.useRef<HTMLButtonElement | null>(null);
    const setRefs = (el: HTMLButtonElement | null) => {
      internalRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    };

    // Normalize options defensively — labels/values from API may be null/undefined
    // and would otherwise crash cmdk on filter (`.toLowerCase()` on non-string).
    const safeOptions = React.useMemo<SearchableSelectOption[]>(
      () =>
        (options || [])
          .filter((o) => o && o.value != null)
          .map((o) => ({
            value: String(o.value),
            label: o.label == null || o.label === '' ? String(o.value) : String(o.label),
            hint: o.hint == null ? undefined : String(o.hint),
            disabled: o.disabled,
          })),
      [options]
    );

    const selected = safeOptions.find((o) => o.value === value);
    const showSearch = safeOptions.length >= searchThreshold;

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return safeOptions;
      return safeOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint ? o.hint.toLowerCase().includes(q) : false) ||
          o.value.toLowerCase().includes(q)
      );
    }, [safeOptions, query]);

    return (
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={setRefs}
            id={id}
            name={name}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className,
              triggerClassName
            )}
          >
            <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command shouldFilter={false}>
            {showSearch && (
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
              />
            )}
            <CommandList className="max-h-64">
              <CommandEmpty>{emptyText}</CommandEmpty>
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                      onSelect={() => {
                        onValueChange?.(opt.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === opt.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="ml-2 text-xs text-muted-foreground">{opt.hint}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);
SearchableSelect.displayName = "SearchableSelect";
