'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Generic searchable + virtualized combobox for selecting a single entity
 * from a potentially large list (100s – 1000s of items).
 *
 * - Virtualized via `@tanstack/react-virtual` so the viewport stays smooth
 *   even at ~2000 items.
 * - Full-text match on the entries' `searchText` (caller-supplied).
 * - `onChange(null)` is emitted when the user clears, so callers can
 *   distinguish "no selection" from "untouched" by using `null` in their
 *   payloads.
 *
 * Multi-select variant is out of scope for phase 6.6 (not needed by any
 * current form). Add it when a form legitimately requires it.
 */
export interface EntityComboboxOption<T = unknown> {
  value: string;
  label: string;
  /** Full text used for matching (e.g. "Router 01 RTR-01 FRONT-HALL"). Lower- or mixed-case is fine; match is case-insensitive. */
  searchText?: string;
  /** Optional per-row rendering. Falls back to label. */
  render?: (option: EntityComboboxOption<T>) => React.ReactNode;
  /** Optional payload — use it to attach arbitrary data to the option. */
  data?: T;
  disabled?: boolean;
}

interface EntitySelectComboboxProps<T> {
  options: EntityComboboxOption<T>[];
  value: string | null | undefined;
  onChange: (value: string | null, option: EntityComboboxOption<T> | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** If true, shows a clear option when a value is selected. Default: true. */
  clearable?: boolean;
  /** aria-label for the trigger button. Required for a11y when no visible label. */
  ariaLabel?: string;
  id?: string;
}

const ITEM_HEIGHT = 36;
const VIRT_THRESHOLD = 50; // Below this count, render plainly — no virtualizer overhead.

export function EntitySelectCombobox<T = unknown>({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  emptyMessage = 'Aucun résultat.',
  disabled,
  className,
  clearable = true,
  ariaLabel,
  id,
}: EntitySelectComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = (opt.searchText ?? opt.label).toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const selected = React.useMemo(
    () => (value ? options.find((o) => o.value === value) ?? null : null),
    [options, value],
  );

  const triggerLabel = selected ? selected.label : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[240px] p-0"
      >
        {/* `shouldFilter={false}` — we filter outside cmdk so the virtualizer
            can drive the rendered set. cmdk keeps keyboard nav/selection. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <VirtualizedItems
                options={filtered}
                selectedValue={value ?? null}
                onSelect={(opt) => {
                  onChange(opt.value, opt);
                  setOpen(false);
                }}
              />
            )}
            {clearable && selected && (
              <div className="border-t p-1">
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Effacer la sélection
                </CommandItem>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function VirtualizedItems<T>({
  options,
  selectedValue,
  onSelect,
}: {
  options: EntityComboboxOption<T>[];
  selectedValue: string | null;
  onSelect: (opt: EntityComboboxOption<T>) => void;
}) {
  // Plain render below the threshold — preserves cmdk keyboard nav without
  // paying the virtualizer cost on typical small lists.
  if (options.length < VIRT_THRESHOLD) {
    return (
      <div role="listbox" className="p-1">
        {options.map((opt) => (
          <ItemRow
            key={opt.value}
            option={opt}
            selected={selectedValue === opt.value}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return <VirtualList options={options} selectedValue={selectedValue} onSelect={onSelect} />;
}

function VirtualList<T>({
  options,
  selectedValue,
  onSelect,
}: {
  options: EntityComboboxOption<T>[];
  selectedValue: string | null;
  onSelect: (opt: EntityComboboxOption<T>) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 6,
  });

  return (
    <div
      ref={scrollRef}
      role="listbox"
      className="max-h-[280px] overflow-y-auto p-1"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const opt = options[vi.index];
          return (
            <div
              key={opt.value}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <ItemRow
                option={opt}
                selected={selectedValue === opt.value}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemRow<T>({
  option,
  selected,
  onSelect,
}: {
  option: EntityComboboxOption<T>;
  selected: boolean;
  onSelect: (opt: EntityComboboxOption<T>) => void;
}) {
  return (
    <CommandItem
      value={option.value}
      disabled={option.disabled}
      onSelect={() => !option.disabled && onSelect(option)}
      className={cn(selected && 'aria-selected:bg-accent')}
    >
      <Check
        className={cn(
          'mr-2 h-4 w-4 shrink-0',
          selected ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 truncate">
        {option.render ? option.render(option) : option.label}
      </div>
    </CommandItem>
  );
}
