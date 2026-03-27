import { MentorProfileStatus, ExpertiseCategory, ArtefactType } from '../enums';

export interface IMentorProfile {
  id: string;
  userId: string;
  status: MentorProfileStatus;
  headline: string | null;
  bio: string | null;
  expertiseCategories: ExpertiseCategory[];
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  hourlyRate: number | null;
  completeness: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMentorPricingTier {
  id: string;
  mentorProfileId: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVerificationArtefact {
  id: string;
  mentorProfileId: string;
  type: ArtefactType;
  value: string;
  isVerified: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
