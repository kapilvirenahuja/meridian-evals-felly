import { Exclude, Expose, Type } from 'class-transformer';
import { ExpertiseCategory } from '@felly/shared-types';

export class PublicPricingTierDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  description!: string | null;

  @Expose()
  priceInCents!: number;

  @Expose()
  durationMinutes!: number;

  @Expose()
  isActive!: boolean;
}

export class PublicAvailabilitySlotDto {
  @Expose()
  id!: string;

  @Expose()
  dayOfWeek!: number;

  @Expose()
  startTimeUtc!: string;

  @Expose()
  endTimeUtc!: string;

  @Expose()
  isRecurring!: boolean;
}

@Exclude()
export class PublicMentorProfileDto {
  @Expose()
  id!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  headline!: string | null;

  @Expose()
  bio!: string;

  @Expose()
  expertiseCategories!: ExpertiseCategory[];

  @Expose()
  yearsOfExperience!: number | null;

  @Expose()
  linkedinUrl!: string | null;

  @Expose()
  photoKey!: string | null;

  @Expose()
  verifiedBadge!: boolean;

  @Expose()
  @Type(() => PublicPricingTierDto)
  pricingTiers!: PublicPricingTierDto[];

  @Expose()
  @Type(() => PublicAvailabilitySlotDto)
  availabilitySlots!: PublicAvailabilitySlotDto[];

  @Expose()
  sessionCount!: number;

  @Expose()
  averageRating!: number;
}
