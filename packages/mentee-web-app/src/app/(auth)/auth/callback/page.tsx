'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { setTokens } from '../../../../lib/auth';

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError('Missing authentication tokens. Please try signing in again.');
      return;
    }

    setTokens(accessToken, refreshToken);
    router.push('/dashboard');
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="text-center py-4">
        <div className="text-destructive text-4xl mb-4">✕</div>
        <h2 className="text-xl font-semibold text-foreground">Sign in failed</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <a
          href="/register"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
      <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
