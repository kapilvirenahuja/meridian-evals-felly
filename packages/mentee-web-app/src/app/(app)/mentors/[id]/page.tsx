import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { IPublicMentorProfile, ExpertiseCategory } from '@felly/shared-types';
import { AvailabilityDisplay } from '../../../../components/marketplace/AvailabilityDisplay';

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';

const CATEGORY_LABELS: Partial<Record<ExpertiseCategory, string>> = {
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

async function getMentor(id: string): Promise<IPublicMentorProfile | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/marketplace/mentors/${id}`, {
      next: { revalidate: 60 },
    });

    if (response.status === 404) return null;
    if (!response.ok) return null;

    return response.json() as Promise<IPublicMentorProfile>;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const mentor = await getMentor(id);
  if (!mentor) {
    return { title: 'Mentor Not Found | Felly Club' };
  }

  return {
    title: `${mentor.firstName} ${mentor.lastName}${mentor.headline ? ` — ${mentor.headline}` : ''} | Felly Club`,
    description: mentor.bio?.slice(0, 160),
  };
}

export default async function MentorProfilePage({ params }: PageProps) {
  const { id } = await params;
  const mentor = await getMentor(id);

  if (!mentor) {
    notFound();
  }

  const activePricingTiers = mentor.pricingTiers.filter((t) => t.isActive);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="relative flex-shrink-0">
          {mentor.photoKey ? (
            <Image
              src={`/api/photos/${mentor.photoKey}`}
              alt={`${mentor.firstName} ${mentor.lastName}`}
              width={120}
              height={120}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted text-4xl font-bold text-muted-foreground">
              {mentor.firstName[0]}
              {mentor.lastName[0]}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {mentor.firstName} {mentor.lastName}
            </h1>
            {mentor.verifiedBadge && (
              <span className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" aria-label="Verified" />
                Verified
              </span>
            )}
          </div>

          {mentor.headline && (
            <p className="mt-1 text-base text-muted-foreground">{mentor.headline}</p>
          )}

          {mentor.yearsOfExperience !== null && mentor.yearsOfExperience !== undefined && (
            <p className="mt-2 text-sm text-muted-foreground">
              {mentor.yearsOfExperience} year{mentor.yearsOfExperience !== 1 ? 's' : ''} of
              experience
            </p>
          )}

          {/* Expertise categories */}
          {mentor.expertiseCategories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {mentor.expertiseCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
            </div>
          )}

          {mentor.linkedinUrl && (
            <a
              href={mentor.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              LinkedIn Profile ↗
            </a>
          )}
        </div>
      </div>

      {/* Bio */}
      {mentor.bio && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {mentor.bio}
          </p>
        </div>
      )}

      {/* Sessions & Rating */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Sessions Completed</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {mentor.sessionCount === 0 ? 'New mentor' : mentor.sessionCount}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Average Rating</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {mentor.averageRating === 0
              ? 'No ratings yet'
              : `${mentor.averageRating.toFixed(1)} / 5`}
          </p>
        </div>
      </div>

      {/* Pricing tiers */}
      {activePricingTiers.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Pricing</h2>
          <div className="space-y-2">
            {activePricingTiers.map((tier) => (
              <div
                key={tier.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium text-foreground text-sm">{tier.name}</p>
                  {tier.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tier.durationMinutes} minutes
                  </p>
                </div>
                <p className="text-lg font-bold text-foreground">
                  ${Math.round(tier.priceInCents / 100)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Availability */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Availability</h2>
        <AvailabilityDisplay slots={mentor.availabilitySlots} />
      </div>

      {/* CTA — Coming Soon */}
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
        <h3 className="text-base font-semibold text-foreground mb-2">Ready to book a session?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Session booking is coming soon. Stay tuned!
        </p>
        <button
          disabled
          className="inline-flex items-center justify-center rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background opacity-50 cursor-not-allowed"
        >
          Coming Soon
        </button>
      </div>
    </div>
  );
}
