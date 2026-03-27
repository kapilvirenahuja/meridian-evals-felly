# F1.2 — User Authentication (order: 2)

## Scope

F1.1 (Mentee Registration) is **already implemented**: register, verify-email, social login endpoints, MockAuthAdapter, JwtAuthGuard, token storage helpers, register page, and tests.

F1.2 adds:

- **Backend**: POST `/auth/login`, POST `/auth/logout`, POST `/auth/refresh`, GET `/auth/me` endpoints
- **Rate limiting**: 10 failed login attempts / 15 min per IP → 429 (in-memory, MockAuthAdapter)
- **Frontend mentee-web-app**: `/login` page + `LoginForm` component; wire up `auth-context.tsx` (React context for auth state)
- **Frontend admin-portal**: `/login` page + `LoginForm` component (email/password only — no social login for admin)
- **Tests**: `login.spec.ts` covering login success/fail, rate limit, refresh, logout

---

## Tech Decisions

| Concern             | Decision                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth adapter        | `IAuthAdapter` interface — add `login()`, `logout()`, `refresh()` methods; `MockAuthAdapter` implements all with in-memory stores                                       |
| JWT                 | Access token 15m (`JWT_ACCESS_EXPIRY`), refresh token 7d (`JWT_REFRESH_EXPIRY`) — constants already in `src/common/constants.ts`                                        |
| Rate limiting       | In-memory `Map<ipHashHex, {count, windowStartMs}>` inside `MockAuthAdapter` — no ioredis/throttler installed; SHA-256 hash IP before storing                            |
| Token refresh       | Client-side: `api-client.ts` in mentee-web-app **already has a full 401 interceptor stub** (labeled `// F1.2 scope`). Backend endpoint is the missing piece.            |
| Logout invalidation | MockAuthAdapter maintains `Set<refreshToken>` invalidated tokens; `refresh()` rejects tokens in this set                                                                |
| Auth context        | `auth-context.tsx` is listed as `modified` in plan but **does not exist yet** — create it fresh. Provides `AuthContext` with `{ user, isAuthenticated, login, logout }` |

---

## Domain Rules

1. Wrong credentials → `401` with **generic** message: `"Invalid credentials"` — never reveal whether email exists
2. Rate limit: after **10 failed logins** from same IP within 15 min → `429 Too Many Requests`. Window resets after 15 min of the first attempt in the window.
3. Token refresh: client should refresh when access token is within 5 min of expiry. Backend `POST /auth/refresh` accepts `{ refreshToken }` and returns `{ accessToken, refreshToken }`.
4. `POST /auth/logout` invalidates the provided refresh token; access token remains valid until natural expiry (stateless).
5. **Unverified users cannot login**: if `User.status === 'PENDING_EMAIL_VERIFICATION'`, login returns `403 Forbidden` with message `"Email not verified"`.
6. `GET /auth/me` requires valid JWT (JwtAuthGuard); returns `{ id, email, role, status }` — no passwordHash.
7. Audit log entries on login (`USER_LOGGED_IN`) and logout (`USER_LOGGED_OUT`) with SHA-256 hashed IP.

---

## Do NOT

- Do **not** modify registration logic (`POST /auth/register`, `POST /auth/verify-email`)
- Do **not** implement password reset (F1.3) or RBAC guards (F1.7) — those are later orders
- Do **not** use `ioredis`, `@nestjs/throttler`, or any package not already in `package.json`
- Do **not** install new npm packages — implement rate limiting in-memory
- Do **not** add social login to admin-portal login page — admin uses email/password only
- Do **not** touch `RegisterForm.tsx`, `SocialLoginButtons.tsx`, or `register/page.tsx`
- Do **not** add auth middleware enforcement to `middleware.ts` yet (that's F1.7)

---

## Files You Own

### backend-api

| File                                          | Action                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/auth/auth.controller.ts`                 | **modified** — add login, logout, refresh, me endpoints                                     |
| `src/auth/auth.service.ts`                    | **modified** — add login(), logout(), refresh(), getMe() methods                            |
| `src/auth/dto/login.dto.ts`                   | **new** — `LoginDto`: @IsEmail() email, @IsString() password                                |
| `src/auth/adapters/auth-adapter.interface.ts` | **modified** — add login/logout/refresh method signatures                                   |
| `src/auth/adapters/mock-auth.adapter.ts`      | **modified** — implement login/logout/refresh, in-memory rate limiting, refresh token store |
| `src/auth/__tests__/login.spec.ts`            | **new** — tests for login success/fail, rate limit (10+), refresh, logout, me               |

### mentee-web-app

| File                                | Action                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(auth)/login/page.tsx`     | **new** — login page (mirrors register page structure)                                                                                   |
| `src/components/auth/LoginForm.tsx` | **new** — react-hook-form + zod, calls `POST /auth/login`, saves tokens, redirects to /dashboard                                         |
| `src/lib/auth-context.tsx`          | **new (create fresh)** — React context: `{ user, isAuthenticated, login, logout }`                                                       |
| `src/lib/api-client.ts`             | **modified** — the 401 interceptor is already fully implemented; verify it imports `getRefreshToken` correctly and wire to real endpoint |

### admin-portal

| File                                 | Action                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `src/app/(auth)/login/page.tsx`      | **new** — admin login page (no social login buttons)                |
| `src/components/auth/login-form.tsx` | **new** — admin login form (email/password, same pattern as mentee) |

---

## Exit Gate

All of the following must pass:

- `POST /api/v1/auth/login` with correct credentials + verified email → `200` with `{ accessToken, refreshToken }`
- `POST /api/v1/auth/login` with wrong credentials → `401` with generic error
- `POST /api/v1/auth/login` with unverified email → `403` with `"Email not verified"`
- 11+ failed logins from same IP within 15 min → `429`
- `POST /api/v1/auth/refresh` with valid refresh token → `200` with new tokens
- `POST /api/v1/auth/logout` invalidates refresh token; subsequent refresh → `401`
- `GET /api/v1/auth/me` with valid JWT → `200` with `{ id, email, role, status }`
- Login pages render and accept form input on both frontends
- All unit tests in `login.spec.ts` pass
