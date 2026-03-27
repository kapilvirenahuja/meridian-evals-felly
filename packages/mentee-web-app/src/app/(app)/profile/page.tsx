'use client';

import { useEffect, useState, useCallback } from 'react';
import { AxiosError } from 'axios';

import { apiClient } from '../../../lib/api-client';
import { CompletenessIndicator } from '../../../components/profile/completeness-indicator';
import { ProfileForm } from '../../../components/profile/profile-form';

interface MenteeProfileData {
  id: string;
  userId: string;
  bio: string | null;
  interests: string[];
  completeness: number;
}

interface UserWithProfile {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  profile: MenteeProfileData | null;
}

export default function ProfilePage() {
  const [userData, setUserData] = useState<UserWithProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<UserWithProfile>('/users/me');
      setUserData(response.data);
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Failed to load profile'
          : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const handleProfileSaved = (updatedUser: Record<string, unknown>) => {
    setUserData(updatedUser as unknown as UserWithProfile);
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-4 text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <div className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-destructive">
          {error || 'Failed to load profile data'}
        </div>
      </div>
    );
  }

  const profile = userData.profile;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">{userData.email}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Completeness indicator */}
        <div className="lg:col-span-1">
          <CompletenessIndicator completeness={profile?.completeness ?? 0} />

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Account Info</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{userData.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium">{userData.role}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{userData.status.replace(/_/g, ' ')}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Profile edit form */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Edit Profile</h2>
            <ProfileForm
              initialProfile={{
                bio: profile?.bio ?? null,
                interests: profile?.interests ?? [],
              }}
              firstName={userData.firstName}
              lastName={userData.lastName}
              onSaved={handleProfileSaved}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
