import Link from 'next/link';
import { IPublicMentorProfile, ExpertiseCategory } from '@felly/shared-types';

interface MentorCardProps {
  mentor: IPublicMentorProfile;
  matchingCategories?: ExpertiseCategory[];
}

const CATEGORY_LABELS: Partial<Record<ExpertiseCategory, string>> = {
  SOFTWARE_ENGINEERING: 'Software Eng.',
  PRODUCT_MANAGEMENT: 'Product Mgmt.',
  DESIGN: 'Design',
  DATA_SCIENCE: 'Data Science',
  BUSINESS: 'Business',
  MARKETING: 'Marketing',
  OTHER: 'Other',
  SPORT: 'Sport',
  ENTREPRENEURSHIP: 'Entrepreneurship',
  ENTERTAINMENT: 'Entertainment',
};

export function MentorCard({ mentor, matchingCategories }: MentorCardProps) {
  const topCategories = mentor.expertiseCategories.slice(0, 2);
  const minPrice = mentor.pricingTiers
    .filter((t) => t.isActive)
    .reduce((min, t) => Math.min(min, t.priceInCents), Infinity);

  const hasAvailability = mentor.availabilitySlots.length > 0;

  return (
    <Link
      href={`/mentors/${mentor.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header: photo + name + headline */}
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 flex-shrink-0">
          {mentor.photoKey ? (
            <img
              src={`/api/photos/${mentor.photoKey}`}
              alt={`${mentor.firstName} ${mentor.lastName}`}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground text-xl font-bold">
              {mentor.firstName[0]}
              {mentor.lastName[0]}
            </div>
          )}
          {mentor.verifiedBadge && (
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500"
              title="Verified Mentor"
            >
              <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors">
            {mentor.firstName} {mentor.lastName}
          </h3>
          {mentor.headline && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mentor.headline}</p>
          )}
        </div>
      </div>

      {/* Category badges */}
      {topCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          ))}
        </div>
      )}

      {/* Matching categories for recommendations */}
      {matchingCategories && matchingCategories.length > 0 && (
        <p className="mt-2 text-xs text-blue-600 font-medium">
          Matches your interest in{' '}
          {matchingCategories.map((c) => CATEGORY_LABELS[c] ?? c).join(', ')}
        </p>
      )}

      {/* Footer: price + availability + rating */}
      <div className="mt-auto pt-3 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">
          {isFinite(minPrice)
            ? `From $${Math.round(minPrice / 100)}/session`
            : 'Pricing on request'}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {/* Availability indicator */}
          <span className="flex items-center gap-1">
            <span
              className={`h-2 w-2 rounded-full ${hasAvailability ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            <span className={hasAvailability ? 'text-green-700' : 'text-muted-foreground'}>
              {hasAvailability ? 'Available' : 'Schedule not set'}
            </span>
          </span>
        </div>
      </div>

      {/* Rating */}
      {mentor.averageRating > 0 && (
        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <svg className="h-3 w-3 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {mentor.averageRating.toFixed(1)}
        </div>
      )}
    </Link>
  );
}
