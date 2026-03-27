'use client';

import { FormEvent, useState } from 'react';
import { AxiosError } from 'axios';
import { apiClient } from '../../lib/api-client';

const EXPERTISE_CATEGORIES = [
  'SOFTWARE_ENGINEERING',
  'PRODUCT_MANAGEMENT',
  'DESIGN',
  'DATA_SCIENCE',
  'BUSINESS',
  'MARKETING',
  'OTHER',
  'SPORT',
  'ENTREPRENEURSHIP',
  'ENTERTAINMENT',
] as const;

interface MenteeProfile {
  bio: string | null;
  interests: string[];
}

interface ProfileFormProps {
  initialProfile: MenteeProfile;
  firstName: string | null;
  lastName: string | null;
  onSaved: (updatedUser: Record<string, unknown>) => void;
}

export function ProfileForm({ initialProfile, firstName, lastName, onSaved }: ProfileFormProps) {
  const [bio, setBio] = useState(initialProfile.bio || '');
  const [interests, setInterests] = useState<string[]>(initialProfile.interests || []);
  const [firstNameVal, setFirstNameVal] = useState(firstName || '');
  const [lastNameVal, setLastNameVal] = useState(lastName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleInterest = (cat: string) => {
    setInterests((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.patch<Record<string, unknown>>('/users/me/profile', {
        bio: bio || undefined,
        interests,
        firstName: firstNameVal || undefined,
        lastName: lastNameVal || undefined,
      });
      setSuccessMessage('Profile updated successfully!');
      onSaved(response.data);
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Failed to update profile'
          : 'An unexpected error occurred';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* Name fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstNameVal}
            onChange={(e) => setFirstNameVal(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your first name"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastNameVal}
            onChange={(e) => setLastNameVal(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your last name"
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1">
          Bio
        </label>
        <textarea
          id="bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Tell your future mentor a bit about yourself..."
        />
      </div>

      {/* Interests */}
      <div>
        <p className="block text-sm font-medium text-foreground mb-2">Interests</p>
        <div className="flex flex-wrap gap-2">
          {EXPERTISE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleInterest(cat)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                interests.includes(cat)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}
