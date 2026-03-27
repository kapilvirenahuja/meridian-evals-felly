const ACCESS_TOKEN_KEY = 'felly_access_token';
const REFRESH_TOKEN_KEY = 'felly_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  // Presence flag for Next.js Edge Middleware (cannot access localStorage)
  document.cookie = 'felly_at=1; path=/; max-age=900; SameSite=Strict';
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  document.cookie = 'felly_at=; path=/; max-age=0; SameSite=Strict';
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
