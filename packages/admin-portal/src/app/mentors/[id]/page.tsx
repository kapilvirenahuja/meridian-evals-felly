'use client';

import { useEffect, useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import { VerificationActions } from '../../../components/mentors/verification-actions';

interface VerificationArtefact {
  id: string;
  type: string;
  value: string;
  isVerified: boolean;
  verifiedAt: string | null;
}

interface MentorProfile {
  id: string;
  userId: string;
  status: string;
  bio: string | null;
  headline: string | null;
  expertiseCategories: string[];
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  hourlyRate: number | null;
  completeness: number;
  verifiedBadge: boolean;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  verificationArtefacts?: VerificationArtefact[];
}

export default function MentorDetailPage() {
  const params = useParams();
  const mentorId = params.id as string;
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the verification queue to find the profile, or fetch directly via a future endpoint
      const response = await apiClient.get<MentorProfile[]>('/admin/mentors/verification');
      const found = response.data.find((p) => p.id === mentorId);
      if (!found) {
        setError('Mentor profile not found or not in verification queue');
      } else {
        setProfile(found);
      }
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Failed to load mentor profile'
          : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return (
      <main className="p-8">
        <p className="text-muted-foreground">Loading mentor profile...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="p-8">
        <div className="mb-4">
          <Link href="/mentors/verification" className="text-sm text-primary hover:underline">
            ← Back to Verification Queue
          </Link>
        </div>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-destructive">
          {error || 'Profile not found'}
        </div>
      </main>
    );
  }

  const statusColors: Record<string, string> = {
    PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
    VERIFIED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    DRAFT: 'bg-gray-100 text-gray-800',
  };

  return (
    <main className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/mentors/verification" className="text-sm text-primary hover:underline">
          ← Back to Verification Queue
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {profile.user?.firstName && profile.user?.lastName
              ? `${profile.user.firstName} ${profile.user.lastName}`
              : profile.user?.email || 'Mentor Profile'}
          </h1>
          {profile.user?.email && (
            <p className="mt-1 text-muted-foreground">{profile.user.email}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[profile.status] || 'bg-gray-100 text-gray-800'}`}
        >
          {profile.status}
          {profile.verifiedBadge && ' ✓'}
        </span>
      </div>

      {/* Rejection reason */}
      {profile.rejectionReason && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
          <p className="mt-1 text-sm text-red-700">{profile.rejectionReason}</p>
        </div>
      )}

      {/* Profile details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Profile Details</h2>
          <dl className="space-y-2 text-sm">
            {profile.headline && (
              <div>
                <dt className="text-muted-foreground">Headline</dt>
                <dd className="font-medium">{profile.headline}</dd>
              </div>
            )}
            {profile.bio && (
              <div>
                <dt className="text-muted-foreground">Bio</dt>
                <dd>{profile.bio}</dd>
              </div>
            )}
            {profile.yearsOfExperience && (
              <div>
                <dt className="text-muted-foreground">Experience</dt>
                <dd>{profile.yearsOfExperience} years</dd>
              </div>
            )}
            {profile.hourlyRate && (
              <div>
                <dt className="text-muted-foreground">Hourly Rate</dt>
                <dd>${profile.hourlyRate}/hr</dd>
              </div>
            )}
            {profile.linkedinUrl && (
              <div>
                <dt className="text-muted-foreground">LinkedIn</dt>
                <dd>
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    View Profile
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Expertise</h2>
          <div className="flex flex-wrap gap-2">
            {profile.expertiseCategories.map((cat) => (
              <span key={cat} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                {cat}
              </span>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Profile Completeness:{' '}
              <span className="font-medium text-foreground">{profile.completeness}%</span>
            </p>
            <div className="mt-1 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${profile.completeness}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Verification artefacts */}
      {profile.verificationArtefacts && profile.verificationArtefacts.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Verification Artefacts</h2>
          <ul className="space-y-2">
            {profile.verificationArtefacts.map((art) => (
              <li key={art.id} className="flex items-center gap-2 text-sm">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{art.type}</span>
                <a
                  href={art.value}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {art.value}
                </a>
                {art.isVerified && <span className="text-green-600 text-xs">✓ verified</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Actions</h2>
        <VerificationActions
          mentorProfileId={profile.id}
          currentStatus={profile.status}
          onActionComplete={fetchProfile}
        />
      </div>
    </main>
  );
}
