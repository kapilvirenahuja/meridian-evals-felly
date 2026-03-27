'use client';

import { useEffect, useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import Link from 'next/link';
import { apiClient } from '../../../lib/api-client';
import { VerificationActions } from '../../../components/mentors/verification-actions';

interface MentorProfile {
  id: string;
  userId: string;
  status: string;
  bio: string | null;
  headline: string | null;
  expertiseCategories: string[];
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  completeness: number;
  verifiedBadge: boolean;
  rejectionReason: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function VerificationQueuePage() {
  const [profiles, setProfiles] = useState<MentorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<MentorProfile[]>('/admin/mentors/verification');
      setProfiles(response.data);
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message ||
            'Failed to load verification queue'
          : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  if (isLoading) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold text-foreground">Mentor Verification Queue</h1>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold text-foreground">Mentor Verification Queue</h1>
        <div className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-destructive">{error}</div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Mentor Verification Queue</h1>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {profiles.length} pending
        </span>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No mentor profiles pending verification.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {profile.user?.firstName && profile.user?.lastName
                        ? `${profile.user.firstName} ${profile.user.lastName}`
                        : profile.user?.email || 'Unknown'}
                    </h2>
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {profile.status}
                    </span>
                  </div>
                  {profile.user?.email && (
                    <p className="mt-1 text-sm text-muted-foreground">{profile.user.email}</p>
                  )}
                  {profile.headline && (
                    <p className="mt-1 text-sm font-medium text-foreground">{profile.headline}</p>
                  )}
                  {profile.bio && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {profile.expertiseCategories.map((cat) => (
                      <span
                        key={cat}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Completeness: {profile.completeness}%</span>
                    {profile.yearsOfExperience && (
                      <span>{profile.yearsOfExperience} years exp.</span>
                    )}
                    <span>Submitted: {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Link
                  href={`/mentors/${profile.id}`}
                  className="ml-4 text-sm text-primary hover:underline"
                >
                  View Details →
                </Link>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <VerificationActions
                  mentorProfileId={profile.id}
                  currentStatus={profile.status}
                  onActionComplete={fetchQueue}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
