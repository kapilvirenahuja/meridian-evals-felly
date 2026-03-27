# CONTEXT.md — F1.1 Mentee Registration (includes Phase 0 Scaffolding)

Feature: F1.1 (Mentee Registration) — order 1 in E1 execution_order
Epic: E1 — User Identity & Profile Foundation
Project: Felly Club — mentorship marketplace
Status: GREENFIELD — no existing code; build everything from scratch

---

## 1. Scope

### Phase 0 — Project Scaffolding (prerequisite, complete before F1.1)

1. **Monorepo scaffolding**: pnpm 9.x workspace (`packages/*`), root `tsconfig.base.json`
   (strict mode, experimentalDecorators, emitDecoratorMetadata, `@felly/shared-types` path alias),
   `.nvmrc` (Node 20 LTS), `.gitignore`
2. **Shared-types package** (`packages/shared-types`): TypeScript-only; exports all enums
   (`UserRole`, `UserStatus`, `MentorProfileStatus`, `ExpertiseCategory`, `ArtefactType`,
   `AuditAction`) and interfaces (`IUser`, `IMenteeProfile`, `IAuthTokens`, `IJwtPayload`,
   `IPaginatedResponse`, `IApiError`, etc.)
3. **NestJS backend bootstrap** (`packages/backend-api`): NestJS 10 + Fastify 4 adapter,
   `PrismaModule` (global, exports `PrismaService`), `HealthModule` (`GET /health → 200`),
   global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform), global
   `HttpExceptionFilter`, Pino structured JSON logging
4. **Prisma schema + initial migration**: Full E1 schema (User, MenteeProfile, MentorProfile,
   MentorPricingTier, MentorAvailabilitySlot, VerificationArtefact, AuditLog), apply via
   `npx prisma migrate dev`
5. **Mock auth infrastructure**: `IAuthAdapter` interface, `MockAuthAdapter` class (JWT via
   `jsonwebtoken`, bcrypt passwords), DI token `AUTH_ADAPTER_TOKEN`, `JwtAuthGuard`,
   `RolesGuard`, `@Roles()` decorator, `@CurrentUser()` decorator, `JwtStrategy` (passport-jwt)
6. **Frontend scaffold**: `packages/mentee-web-app` and `packages/admin-portal` — both
   Next.js 15 App Router with Tailwind CSS + shadcn/ui; root layouts, Axios API clients,
   TanStack Query providers, auth token helpers, middleware stubs
7. **Docker Compose**: PostgreSQL 16 on port 5432, Redis 7 on port 6379, both with health checks
8. **CI + code quality**: GitHub Actions (lint → typecheck → test), ESLint 9, Prettier 3,
   Husky pre-commit (lint-staged), Jest + ts-jest config with 80% coverage threshold on
   auth/user modules

### F1.1 — Mentee Registration (build on top of Phase 0)

1. **Registration endpoint** `POST /api/v1/auth/register`:
   - Body: `{ email: string, password: string }`
   - Validates email format + password strength (≥8 chars, letter+number)
   - Creates `User` (role=MENTEE, status=PENDING_EMAIL_VERIFICATION) + `MenteeProfile`
     atomically in a Prisma `$transaction`
   - Generates email verification token (UUID v4, 24h TTL) stored in MockAuthAdapter Map
   - Returns HTTP 201 with `{ userId, email, verificationToken }` (E7 replaces token with SendGrid email)
   - Writes `USER_REGISTERED` AuditLog entry
2. **Email verification endpoint** `POST /api/v1/auth/verify-email`:
   - Body: `{ token: string }`
   - Valid token → set `User.status = ACTIVE`, remove token from Map → HTTP 200
   - Invalid/expired token → HTTP 400
   - Writes `EMAIL_VERIFIED` AuditLog entry
3. **Social login stubs** `GET /api/v1/auth/social/google` and `GET /api/v1/auth/social/apple`:
   - Stub endpoints — MockAuthAdapter creates/finds User with MENTEE role, returns JWTs
   - No real OAuth in E1; stubs only
4. **UserModule**: `UserRepository` with `createUser()` and `createMenteeProfile()` used
   by AuthService during registration; `UserResponseDto` (excludes passwordHash)
5. **Registration page** `/register` in mentee-web-app:
   - `RegisterForm` (react-hook-form + zod: email, password, confirmPassword)
   - `SocialLoginButtons` (redirect browser to backend stub endpoints)
   - Shows "check your email" success message after submit
6. **Email verification page** `/verify-email` in mentee-web-app:
   - Reads `?token=` query param, calls verify-email API, shows success/error state
7. **Tests**: Unit tests for `AuthService` (register, duplicate email, weak password,
   verify-email flow) and `AuthController` (request/response shapes via supertest)

---

## 2. Tech Decisions

| Concern           | Choice                                                      | Key Detail                                                                                    |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Package manager   | pnpm 9.x                                                    | `packages/*` workspace; `workspace:*` for internal deps                                       |
| Runtime           | Node.js 20 LTS                                              | Pinned in `.nvmrc`                                                                            |
| Backend framework | NestJS 10.x + **Fastify 4.x**                               | Use `@nestjs/platform-fastify` — NOT Express                                                  |
| ORM               | Prisma 5.x                                                  | `npx prisma migrate dev`; `npx prisma generate` after schema changes                          |
| Database          | PostgreSQL 16                                               | Docker local; `DATABASE_URL` env var                                                          |
| Cache             | Redis 7                                                     | Docker local; needed for Phase 0 infrastructure                                               |
| Auth adapter      | `MockAuthAdapter` via `AUTH_ADAPTER_TOKEN` DI               | Swapped for `KeyCloakAuthAdapter` in E11; zero guard changes                                  |
| JWT               | `jsonwebtoken` in MockAuthAdapter + `passport-jwt` strategy | 15min access, 7d refresh, signed with `JWT_SECRET` env var                                    |
| Validation        | `class-validator` + `class-transformer`                     | Global `ValidationPipe(whitelist: true, forbidNonWhitelisted: true, transform: true)`         |
| Logging           | `nestjs-pino`                                               | Structured JSON; no `console.log` anywhere                                                    |
| Frontend          | Next.js 15 App Router                                       | SSR public pages, CSR authenticated flows                                                     |
| Forms             | react-hook-form + zod + `@hookform/resolvers`               | Zod schemas mirror backend validation rules                                                   |
| UI components     | Tailwind CSS 3 + shadcn/ui                                  | Install via `npx shadcn add` into `src/components/ui/`                                        |
| HTTP client       | Axios                                                       | Interceptor reads access token from localStorage, adds `Bearer` header; 401 → refresh → retry |
| Server state      | TanStack Query 5.x                                          | `QueryProvider` wraps layouts; query key invalidation on mutations                            |
| Shared types      | `@felly/shared-types` (workspace:\*)                        | All enums and API interfaces — import from here, never redefine                               |
| Testing           | Jest + ts-jest + supertest                                  | Unit tests in `src/auth/__tests__/`; 80% coverage on auth module                              |

**JWT payload shape** (matches KeyCloak format — used by guards now and in E11):

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "realm_access": { "roles": ["MENTEE"] },
  "iss": "felly-club-mock",
  "aud": "felly-club-api",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**AUTH_ADAPTER_TOKEN binding** (in `auth.module.ts`):

```typescript
{ provide: AUTH_ADAPTER_TOKEN, useClass: MockAuthAdapter }
// E11: change to: { provide: AUTH_ADAPTER_TOKEN, useClass: KeyCloakAuthAdapter }
```

---

## 3. Domain Rules

**Registration:**

- `User.role` = `UserRole.MENTEE` always on self-registration
- `User.status` = `UserStatus.PENDING_EMAIL_VERIFICATION` at creation
- `User` + `MenteeProfile` created in single `prisma.$transaction([])`
- `MenteeProfile` created with empty defaults: `interests: []`, `completeness: 0`

**Email uniqueness (INV-04):**

- `User.email` has `@@unique` in schema — let DB enforce it
- Catch Prisma error code `P2002` → throw `ConflictException('Email already in use')` → HTTP 409
- Never SELECT-then-INSERT to check uniqueness

**Password strength (B1.1.5):**

- Minimum 8 characters
- Must contain at least one letter AND at least one number
- Regex: `/^(?=.*[a-zA-Z])(?=.*[0-9]).+$/`
- Enforce with `@Matches` in `RegisterDto`; ValidationPipe returns HTTP 400 on failure
- Hash with bcrypt rounds=12 in MockAuthAdapter before storing in `User.passwordHash`

**Email verification flow:**

- MockAuthAdapter stores `emailVerificationTokens: Map<token, userId>` (UUID v4, 24h TTL)
- `POST /api/v1/auth/verify-email` with `{ token }` → sets `User.status = ACTIVE` → HTTP 200
- Invalid or expired token → HTTP 400
- Accounts with `status=PENDING_EMAIL_VERIFICATION` CANNOT login (F1.2 will enforce this;
  be aware that your registration flow must not auto-login the user after registration)

**Social login stubs (B1.1.3):**

- Endpoints return real JWTs for testing; MockAuthAdapter creates User if not found (email
  from stub callback), assigns `role=MENTEE`, sets `status=ACTIVE` (social login skips email verify)
- Frontend `SocialLoginButtons` does `window.location.href = API_BASE_URL + '/auth/social/google'`

**Passwords never in responses (INV-05):**

- `UserResponseDto` has `@Exclude()` on `passwordHash`
- Use `plainToInstance(UserResponseDto, entity, { excludeExtraneousValues: true })` in all
  controller returns
- Never log passwords or hashes anywhere

**AuditLog:**

- `USER_REGISTERED`: `{ userId, action: 'USER_REGISTERED', metadata: { role: 'MENTEE' }, ipAddressHash }`
- `EMAIL_VERIFIED`: `{ userId, action: 'EMAIL_VERIFIED' }`
- Hash raw IP: `crypto.createHash('sha256').update(clientIp).digest('hex')` — never store raw IP

**Prisma error → HTTP exception mapping (in service try/catch):**

- `P2002` → `ConflictException` (409)
- `P2025` → `NotFoundException` (404)
- All other errors: re-throw (caught by global filter as 500)

**Architecture pattern** (all modules must follow):

- Controller: HTTP binding only — extract DTO, call service method, return `plainToInstance(ResponseDto, result)`
- Service: business logic, invariant enforcement, AuditLog writes
- Repository: Prisma queries only — injected with `PrismaService`
- No direct Prisma calls in controllers or service methods

---

## 4. Do NOT

- **Do NOT** implement F1.2 (login/logout), F1.3 (password reset), F1.4 (mentor onboarding),
  F1.5 (verification), F1.6 (profile management), or F1.7 (RBAC) — those are later features
- **Do NOT** read any `.meridian/` files during implementation — only this CONTEXT.md
- **Do NOT** implement mentor self-registration — mentors are admin-created only (F1.4)
- **Do NOT** implement marketplace features (search, browse, booking, sessions, payments)
- **Do NOT** implement MFA — reserved for E11 KeyCloak integration
- **Do NOT** implement real Google OAuth or Apple Sign In — stubs only in E1
- **Do NOT** call SendGrid or any email service — return verification token in API response body
- **Do NOT** implement admin portal feature pages (mentor onboarding, verification queue,
  user management) — only scaffold the shell (layout, middleware) in Phase 0
- **Do NOT** implement login pages — that is F1.2 scope
- **Do NOT** implement rate limiting on auth endpoints — that is F1.2 scope
- **Do NOT** call Prisma directly from controllers — always service → repository chain
- **Do NOT** store raw IP addresses — always SHA-256 hash before AuditLog
- **Do NOT** put secrets in source code — `.env.local` only (never committed)

---

## 5. Files You Own

All files are `new`. Paths use `src/auth/` (not `src/modules/auth/`) per tech.yaml LLD.

### Root & Config

| File                       | Action |
| -------------------------- | ------ |
| `pnpm-workspace.yaml`      | new    |
| `package.json` (root)      | new    |
| `tsconfig.base.json`       | new    |
| `.nvmrc`                   | new    |
| `.gitignore`               | new    |
| `docker-compose.yml`       | new    |
| `.prettierrc`              | new    |
| `.eslintrc.json`           | new    |
| `.husky/pre-commit`        | new    |
| `.github/workflows/ci.yml` | new    |

### `packages/shared-types`

| File                                                         | Action |
| ------------------------------------------------------------ | ------ |
| `packages/shared-types/package.json`                         | new    |
| `packages/shared-types/tsconfig.json`                        | new    |
| `packages/shared-types/src/index.ts`                         | new    |
| `packages/shared-types/src/enums/user-role.enum.ts`          | new    |
| `packages/shared-types/src/enums/user-status.enum.ts`        | new    |
| `packages/shared-types/src/enums/mentor-status.enum.ts`      | new    |
| `packages/shared-types/src/enums/expertise-category.enum.ts` | new    |
| `packages/shared-types/src/enums/artefact-type.enum.ts`      | new    |
| `packages/shared-types/src/types/user.types.ts`              | new    |
| `packages/shared-types/src/types/auth.types.ts`              | new    |
| `packages/shared-types/src/types/mentor.types.ts`            | new    |
| `packages/shared-types/src/types/api-response.types.ts`      | new    |

### `packages/backend-api` — Scaffold

| File                                                                  | Action |
| --------------------------------------------------------------------- | ------ |
| `packages/backend-api/package.json`                                   | new    |
| `packages/backend-api/tsconfig.json`                                  | new    |
| `packages/backend-api/nest-cli.json`                                  | new    |
| `packages/backend-api/jest.config.ts`                                 | new    |
| `packages/backend-api/.env.example`                                   | new    |
| `packages/backend-api/src/main.ts`                                    | new    |
| `packages/backend-api/src/app.module.ts`                              | new    |
| `packages/backend-api/src/common/constants.ts`                        | new    |
| `packages/backend-api/src/common/filters/http-exception.filter.ts`    | new    |
| `packages/backend-api/src/common/interceptors/logging.interceptor.ts` | new    |
| `packages/backend-api/src/prisma/prisma.module.ts`                    | new    |
| `packages/backend-api/src/prisma/prisma.service.ts`                   | new    |
| `packages/backend-api/src/health/health.controller.ts`                | new    |
| `packages/backend-api/prisma/schema.prisma`                           | new    |
| `packages/backend-api/prisma/migrations/`                             | new    |

### `packages/backend-api` — Mock Auth Infrastructure (Phase 0)

| File                                                                 | Action |
| -------------------------------------------------------------------- | ------ |
| `packages/backend-api/src/auth/adapters/auth-adapter.interface.ts`   | new    |
| `packages/backend-api/src/auth/adapters/mock-auth.adapter.ts`        | new    |
| `packages/backend-api/src/auth/auth.module.ts`                       | new    |
| `packages/backend-api/src/auth/interfaces/jwt-payload.interface.ts`  | new    |
| `packages/backend-api/src/auth/strategies/jwt.strategy.ts`           | new    |
| `packages/backend-api/src/auth/guards/jwt-auth.guard.ts`             | new    |
| `packages/backend-api/src/auth/guards/roles.guard.ts`                | new    |
| `packages/backend-api/src/auth/decorators/roles.decorator.ts`        | new    |
| `packages/backend-api/src/auth/decorators/current-user.decorator.ts` | new    |

### `packages/backend-api` — F1.1 Feature Files

| File                                                              | Action |
| ----------------------------------------------------------------- | ------ |
| `packages/backend-api/src/auth/auth.controller.ts`                | new    |
| `packages/backend-api/src/auth/auth.service.ts`                   | new    |
| `packages/backend-api/src/auth/dto/register.dto.ts`               | new    |
| `packages/backend-api/src/auth/dto/verify-email.dto.ts`           | new    |
| `packages/backend-api/src/user/user.module.ts`                    | new    |
| `packages/backend-api/src/user/user.service.ts`                   | new    |
| `packages/backend-api/src/user/user.repository.ts`                | new    |
| `packages/backend-api/src/user/dto/user-response.dto.ts`          | new    |
| `packages/backend-api/src/auth/__tests__/auth.service.spec.ts`    | new    |
| `packages/backend-api/src/auth/__tests__/auth.controller.spec.ts` | new    |

### `packages/mentee-web-app` — Scaffold + F1.1

| File                                                                 | Action |
| -------------------------------------------------------------------- | ------ |
| `packages/mentee-web-app/package.json`                               | new    |
| `packages/mentee-web-app/tsconfig.json`                              | new    |
| `packages/mentee-web-app/next.config.ts`                             | new    |
| `packages/mentee-web-app/tailwind.config.ts`                         | new    |
| `packages/mentee-web-app/postcss.config.mjs`                         | new    |
| `packages/mentee-web-app/.env.example`                               | new    |
| `packages/mentee-web-app/src/app/layout.tsx`                         | new    |
| `packages/mentee-web-app/src/app/page.tsx`                           | new    |
| `packages/mentee-web-app/src/app/error.tsx`                          | new    |
| `packages/mentee-web-app/src/app/not-found.tsx`                      | new    |
| `packages/mentee-web-app/src/lib/api-client.ts`                      | new    |
| `packages/mentee-web-app/src/lib/auth.ts`                            | new    |
| `packages/mentee-web-app/src/lib/query-client.ts`                    | new    |
| `packages/mentee-web-app/src/providers/QueryProvider.tsx`            | new    |
| `packages/mentee-web-app/src/middleware.ts`                          | new    |
| `packages/mentee-web-app/src/app/(auth)/layout.tsx`                  | new    |
| `packages/mentee-web-app/src/app/(auth)/register/page.tsx`           | new    |
| `packages/mentee-web-app/src/app/(auth)/verify-email/page.tsx`       | new    |
| `packages/mentee-web-app/src/components/auth/RegisterForm.tsx`       | new    |
| `packages/mentee-web-app/src/components/auth/SocialLoginButtons.tsx` | new    |
| `packages/mentee-web-app/src/components/ui/` (shadcn primitives)     | new    |

### `packages/admin-portal` — Scaffold Only

| File                                                    | Action |
| ------------------------------------------------------- | ------ |
| `packages/admin-portal/package.json`                    | new    |
| `packages/admin-portal/tsconfig.json`                   | new    |
| `packages/admin-portal/next.config.ts`                  | new    |
| `packages/admin-portal/tailwind.config.ts`              | new    |
| `packages/admin-portal/postcss.config.mjs`              | new    |
| `packages/admin-portal/.env.example`                    | new    |
| `packages/admin-portal/src/app/layout.tsx`              | new    |
| `packages/admin-portal/src/app/page.tsx`                | new    |
| `packages/admin-portal/src/lib/api-client.ts`           | new    |
| `packages/admin-portal/src/lib/auth.ts`                 | new    |
| `packages/admin-portal/src/lib/query-client.ts`         | new    |
| `packages/admin-portal/src/providers/QueryProvider.tsx` | new    |
| `packages/admin-portal/src/middleware.ts`               | new    |

---

## 6. Exit Gate

All of the following must pass before F1.1 is considered done:

### Phase 0 checks

- [ ] `pnpm install` completes without errors
- [ ] `docker-compose up -d` starts both services; `docker-compose ps` shows both `healthy`
- [ ] `GET http://localhost:3000/health` returns HTTP 200 `{ "status": "ok", "timestamp": "...", "version": "..." }`
- [ ] `npx prisma migrate dev` applies without errors; all 7 E1 tables created in PostgreSQL
- [ ] `cd packages/mentee-web-app && next dev -p 3001` starts without errors; page loads at `http://localhost:3001`
- [ ] `cd packages/admin-portal && next dev -p 3002` starts without errors; page loads at `http://localhost:3002`
- [ ] `pnpm lint` passes (ESLint + Prettier — zero errors)
- [ ] `pnpm typecheck` passes (tsc --noEmit across all packages)
- [ ] GitHub Actions CI pipeline passes all stages on PR push

### F1.1 checks

- [ ] `POST /api/v1/auth/register` `{ "email": "test@example.com", "password": "Password1" }` → HTTP 201 with `{ userId, email, verificationToken }`
- [ ] `POST /api/v1/auth/register` same email again → HTTP 409 `{ "message": "Email already in use" }`
- [ ] `POST /api/v1/auth/register` `{ "password": "weak" }` → HTTP 400 (too short)
- [ ] `POST /api/v1/auth/register` `{ "password": "allletter" }` (no number) → HTTP 400
- [ ] `POST /api/v1/auth/register` `{ "password": "12345678" }` (no letter) → HTTP 400
- [ ] `POST /api/v1/auth/verify-email` `{ "token": "<verificationToken from above>" }` → HTTP 200
- [ ] `POST /api/v1/auth/verify-email` `{ "token": "invalid-token" }` → HTTP 400
- [ ] Registration page renders at `/register` with email, password, confirm-password fields and Google/Apple buttons
- [ ] `pnpm test` in `packages/backend-api` — all unit tests pass, coverage ≥80% on auth module

---

## TDD Approach

For each scope item, follow **Red → Green → Verify**:

1. **Red**: Write the failing test first describing the expected behaviour
2. **Green**: Write the minimal implementation to make the test pass
3. **Verify**: Run `pnpm test` — all tests must pass before moving to the next item

**Implementation order:**

1. Phase 0 scaffolding (no unit tests — verify by running services and `pnpm lint`)
2. Prisma schema + migration (verify: `prisma migrate dev` succeeds, all 7 tables created)
3. Mock auth adapter + JWT guards (unit tests: `MockAuthAdapter.register()`, `validateToken()`, `verifyEmail()`)
4. `auth.service.spec.ts` first → then implement `AuthService.register()` + `AuthService.verifyEmail()`
5. `auth.controller.spec.ts` first → then implement `AuthController` endpoints
6. Frontend registration + verify-email pages (smoke: renders, form submits, shows success state)
7. Run full exit gate checklist
