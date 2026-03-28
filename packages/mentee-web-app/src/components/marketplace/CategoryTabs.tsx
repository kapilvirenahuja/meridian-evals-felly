'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { ExpertiseCategory, IMentorCategoryCount } from '@felly/shared-types';

interface CategoryTabsProps {
  categories: IMentorCategoryCount[];
  activeCategory: ExpertiseCategory | 'ALL';
  onCategoryChange: (category: ExpertiseCategory | 'ALL') => void;
}

const CATEGORY_LABELS: Record<ExpertiseCategory | 'ALL', string> = {
  ALL: 'All',
  SOFTWARE_ENGINEERING: 'Software Engineering',
  PRODUCT_MANAGEMENT: 'Product Management',
  DESIGN: 'Design',
  DATA_SCIENCE: 'Data Science',
  BUSINESS: 'Business',
  MARKETING: 'Marketing',
  OTHER: 'Other',
  SPORT: 'Sport',
  ENTREPRENEURSHIP: 'Entrepreneurship',
  ENTERTAINMENT: 'Entertainment',
};

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <Tabs.Root
      value={activeCategory}
      onValueChange={(value) => onCategoryChange(value as ExpertiseCategory | 'ALL')}
    >
      <Tabs.List
        className="flex overflow-x-auto gap-1 border-b border-border pb-0"
        aria-label="Mentor categories"
      >
        {categories.map((cat) => (
          <Tabs.Trigger
            key={cat.category}
            value={cat.category}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CATEGORY_LABELS[cat.category as ExpertiseCategory | 'ALL']}
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {cat.count}
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
