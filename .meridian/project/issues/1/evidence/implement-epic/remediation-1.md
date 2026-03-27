# Remediation Instructions — Iteration 1

## Issue 1: Email Verification Page — No Dashboard Navigation

**Category:** email-verification
**What is wrong:** After successful email verification on the /verify-email page, the user sees a static "Email verified!" message with a link to "/" but is NOT redirected to a mentee dashboard.
**Expected behavior:** After successful email verification, the page should navigate the user to a dashboard route (e.g., /dashboard). Create a minimal /dashboard page if it doesn't exist.

## Issue 2: Social Login Stubs — No Dashboard Redirect

**Category:** social-login
**What is wrong:** The social login stub endpoints (GET /api/v1/auth/social/google and /apple) return JSON with tokens but do not redirect the user to a dashboard. The frontend SocialLoginButtons does window.location.href to the backend stub, but the backend returns JSON, not a redirect response.
**Expected behavior:** After successful social login, the user should end up on a mentee dashboard page. The backend stubs should redirect to a frontend dashboard URL with tokens (e.g., as query params or set as cookies), or the flow should be adjusted so the frontend handles the token response and navigates to dashboard.

## Issue 3: Email Case Normalization

**Category:** registration-validation
**What is wrong:** Email addresses are stored as-is without case normalization. Registration with 'User@Example.com' and 'user@example.com' would be treated as different emails by the database unique constraint.
**Expected behavior:** Email addresses should be normalized to lowercase before storage. Add `email.toLowerCase()` in the registration flow (in AuthService or UserRepository) before passing to Prisma. Also normalize in the RegisterDto or before any email-based lookup.
