'use client';

import { FormEvent, useState } from 'react';
import { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { setTokens, clearTokens } from '../../lib/auth';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface MeResponse {
  id: string;
  email: string;
  role: string;
  status: string;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    if (!email || !password) {
      setServerError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', { email, password });
      setTokens(response.data.accessToken, response.data.refreshToken);

      // Verify the user has ADMIN role before allowing portal access
      const meResponse = await apiClient.get<MeResponse>('/auth/me');
      if (meResponse.data.role !== 'ADMIN') {
        clearTokens();
        setServerError('Access denied. Admin credentials required.');
        return;
      }

      router.push('/');
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const message = (error.response?.data as { message?: string })?.message;
        if (status === 401) {
          setServerError('Invalid email or password.');
        } else if (status === 403) {
          setServerError('Your account does not have admin access.');
        } else if (status === 429) {
          setServerError('Too many login attempts. Please try again later.');
        } else {
          setServerError(message || 'Login failed. Please try again.');
        }
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder="admin@felly.club"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder="Your password"
          />
        </div>

        {serverError && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </form>
  );
}
