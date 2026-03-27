'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { apiClient } from '../../../lib/api-client';

type VerificationStatus = 'loading' | 'success' | 'error' | 'missing-token';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('missing-token');
      return;
    }

    apiClient
      .post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      })
      .catch((error: AxiosError) => {
        setStatus('error');
        const message = (error.response?.data as { message?: string })?.message;
        setErrorMessage(message || 'Your verification link is invalid or has expired.');
      });
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
        <p className="mt-4 text-sm text-muted-foreground">Verifying your email...</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center py-4">
        <div className="text-green-600 text-4xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-foreground">Email verified!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your email has been successfully verified. Redirecting you to the dashboard...
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          If you are not redirected automatically,{' '}
          <a href="/dashboard" className="underline hover:text-foreground">
            click here
          </a>
          .
        </p>
      </div>
    );
  }

  if (status === 'missing-token') {
    return (
      <div className="text-center py-4">
        <div className="text-destructive text-4xl mb-4">✕</div>
        <h2 className="text-xl font-semibold text-foreground">Invalid link</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This verification link is missing the required token.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <div className="text-destructive text-4xl mb-4">✕</div>
      <h2 className="text-xl font-semibold text-foreground">Verification failed</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {errorMessage || 'Your verification link is invalid or has expired.'}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Please register again to receive a new verification link.
      </p>
    </div>
  );
}
