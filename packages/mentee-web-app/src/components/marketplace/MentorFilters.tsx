'use client';

import * as Select from '@radix-ui/react-select';
import * as Checkbox from '@radix-ui/react-checkbox';
import { IMarketplaceFilters } from '@felly/shared-types';

interface MentorFiltersProps {
  filters: IMarketplaceFilters;
  onChange: (filters: IMarketplaceFilters) => void;
}

const RATING_OPTIONS = [
  { label: 'Any Rating', value: '' },
  { label: '4+ Stars', value: '4' },
  { label: '4.5+ Stars', value: '4.5' },
];

export function MentorFilters({ filters, onChange }: MentorFiltersProps) {
  const handlePriceMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? Number(e.target.value) : undefined;
    onChange({ ...filters, priceMin: val });
  };

  const handlePriceMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? Number(e.target.value) : undefined;
    onChange({ ...filters, priceMax: val });
  };

  const handleRatingChange = (value: string) => {
    const val = value ? Number(value) : undefined;
    onChange({ ...filters, rating: val });
  };

  const handleAvailabilityChange = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      onChange({ ...filters, hasAvailability: true });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hasAvailability: _removed, ...rest } = filters;
      onChange(rest);
    }
  };

  const handleClearAll = () => {
    onChange({ q: filters.q });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Price range */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Min Price ($)</label>
          <input
            type="number"
            min={0}
            value={filters.priceMin ?? ''}
            onChange={handlePriceMinChange}
            placeholder="0"
            className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Minimum price"
          />
        </div>
        <span className="text-muted-foreground text-sm mt-5">–</span>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Max Price ($)</label>
          <input
            type="number"
            min={0}
            value={filters.priceMax ?? ''}
            onChange={handlePriceMaxChange}
            placeholder="∞"
            className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Maximum price"
          />
        </div>
      </div>

      {/* Rating filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Min Rating</label>
        <Select.Root
          value={filters.rating !== undefined ? String(filters.rating) : ''}
          onValueChange={handleRatingChange}
        >
          <Select.Trigger
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[140px]"
            aria-label="Minimum rating"
          >
            <Select.Value placeholder="Any Rating" />
            <Select.Icon>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="z-50 overflow-hidden rounded-md border border-border bg-background shadow-md">
              <Select.Viewport className="p-1">
                {RATING_OPTIONS.map((opt) => (
                  <Select.Item
                    key={opt.value}
                    value={opt.value}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-foreground outline-none hover:bg-accent data-[highlighted]:bg-accent"
                  >
                    <Select.ItemText>{opt.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {/* Availability filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium invisible">Available</label>
        <div className="flex items-center gap-2 h-[38px]">
          <Checkbox.Root
            id="availability-filter"
            checked={filters.hasAvailability === true}
            onCheckedChange={handleAvailabilityChange}
            className="flex h-4 w-4 items-center justify-center rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
          >
            <Checkbox.Indicator>
              <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10.28 1.28L3.989 7.575 1.695 5.28A1 1 0 00.28 6.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 1.28z" />
              </svg>
            </Checkbox.Indicator>
          </Checkbox.Root>
          <label htmlFor="availability-filter" className="text-sm text-foreground cursor-pointer">
            Available only
          </label>
        </div>
      </div>

      {/* Clear all */}
      <button
        type="button"
        onClick={handleClearAll}
        className="h-[38px] rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
