'use client';

import * as Select from '@radix-ui/react-select';
import { MentorSortOrder } from '@felly/shared-types';

interface SortControlProps {
  value: MentorSortOrder;
  onChange: (value: MentorSortOrder) => void;
}

const SORT_OPTIONS: Array<{ value: MentorSortOrder; label: string }> = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating_desc', label: 'Highest Rated' },
];

export function SortControl({ value, onChange }: SortControlProps) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as MentorSortOrder)}>
      <Select.Trigger
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
        aria-label="Sort mentors"
      >
        <Select.Value />
        <Select.Icon className="ml-auto">
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
        <Select.Content className="z-50 overflow-hidden rounded-md border border-border bg-background shadow-md min-w-[180px]">
          <Select.Viewport className="p-1">
            {SORT_OPTIONS.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-foreground outline-none hover:bg-accent data-[highlighted]:bg-accent data-[state=checked]:font-medium"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
