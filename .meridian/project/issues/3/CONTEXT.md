# CONTEXT.md — E2: Mentor Marketplace & Discovery

Epic: E2 — Mentor Marketplace & Discovery
Issue: #3
Project: Felly Club — mentorship marketplace
Execution order: Phase 0 → F2.2 → F2.1 → F2.5 → F2.3 → F2.6 → F2.4
Prerequisite: E1 (User Identity & Profile Foundation) is complete. All E1 patterns are in place.

---

## 1. Scope

### Phase 0 — E2 Infrastructure & Adapter Scaffolding (prerequisite for all features)

1. **Install backend dependencies**: `pnpm --filter @felly/backend-api add @opensearch-project/opensearch@^2.3.0 ioredis@^5.3.2`
2. **Install frontend dependencies**: `pnpm --filter @felly/mentee-web-app add @radix-ui/react-tabs@^1.0.4 @radix-ui/react-select@^2.1.0 @radix-ui/react-checkbox@^1.1.1`
3. **Extend docker-compose.yml** with OpenSearch 2.x service (port 9200) — **optional for local dev** (SEARCH_PROVIDER=prisma is the default; Docker only needed for full-text search fidelity testing)
4. **Document env vars** in `packages/backend-api/.env.local.example`: `SEARCH_PROVIDER=prisma`, `OPENSEARCH_URL=http://localhost:9200`, `OPENSEARCH_INDEX_NAME=mentor_profiles`
5. **Extend shared-types** with all E2 marketplace interfaces (`IPublicMentorProfile`, `IPublicPricingTier`, `IPublicAvailabilitySlot`, `IMarketplaceFilters`, `IMentorSearchResponse`, `IRecommendationResult`, `IMentorCategoryCount`) and `MentorSortOrder` string union type
6. **Scaffold ISearchAdapter**: `SEARCH_ADAPTER_TOKEN` DI token, `ISearchAdapter` interface, `OpenSearchAdapter` (selected when `SEARCH_PROVIDER=opensearch`), `PrismaSearchAdapter` (selected when `SEARCH_PROVIDER=prisma` — the default; all index methods are no-ops)
7. **Prisma migration**: add `sessionCount Int @default(0)` and `averageRating Float @default(0)` to `MentorProfile`; run `npx prisma migrate dev --name add_marketplace_fields && npx prisma generate`

### F2.2 — Category-Based Marketplace Navigation (order 1)

1. **MarketplaceModule scaffold**: `@Module` wiring `PrismaModule`, `AuthModule`, `UserModule`; provides `MarketplaceController`, `MarketplaceService`, `MarketplaceRepository`, `MarketplaceSearchService`, `RedisService`; exports `MarketplaceSearchService` for AdminModule
2. **RedisService**: ioredis wrapper — `get(key)`, `set(key, value, ttlSeconds)`, `del(key)`, `delPattern(pattern)` (SCAN-based); graceful degradation when `REDIS_URL` is unset (cache miss, no errors thrown)
3. **GET /api/v1/marketplace/categories**: returns `IMentorCategoryCount[]` with `'ALL'` aggregate + one entry per `ExpertiseCategory` value; only counts VERIFIED + verifiedBadge=true mentors; cached 300s
4. **Register MarketplaceModule** in `AppModule.imports` after AdminModule
5. **Frontend**: SSR `/mentors` page scaffold; `CategoryTabs` component (`@radix-ui/react-tabs`); `EmptyState` component; `useCategoryCount` TanStack Query hook; add `/mentors` nav link in `layout.tsx`
6. **Tests**: unit tests for `MarketplaceController` categories route (guard status, response shape) and `RedisService` (ioredis mocked)

### F2.1 — Mentor Search & Filtering (order 2, depends on F2.2)

1. **MarketplaceSearchService**: `@opensearch-project/opensearch` client; `onModuleInit` creates `mentor_profiles` index + alias if absent, bulk syncs all VERIFIED profiles if empty; `searchMentors` (bool query: mandatory VERIFIED filter + optional filters + multi_match on firstName^3/lastName^3/headline^2/bio^1/expertiseCategories^1.5); `indexMentor` (validates status===VERIFIED before upsert); `removeMentorFromIndex` (delete, ignore 404); `updateMentorInIndex`; `bulkIndexMentors`
2. **GET /api/v1/marketplace/mentors**: `MentorSearchQueryDto` validates `q?`, `category?`, `priceMin?`, `priceMax?`, `rating?`, `hasAvailability?`; returns `IMentorSearchResponse`; search routes via Redis cache (5-min TTL keyed by SHA256 of query string) → `MarketplaceSearchService`
3. **PublicMentorProfileDto**: `@Expose()` on public fields (id, firstName, lastName, headline, bio, expertiseCategories, yearsOfExperience, linkedinUrl, photoKey, verifiedBadge, pricingTiers, availabilitySlots, sessionCount, averageRating); `@Exclude()` on ALL private fields (status, rejectionReason, verifiedAt, completeness, verificationArtefacts, passwordHash)
4. **Wire AdminService for fire-and-forget index sync**: inject `MarketplaceSearchService` into `AdminModule`/`AdminService`; after `approveMentor()`: `void this.marketplaceSearchService.indexMentor(id).catch(e => this.logger.error(e))`; after `rejectMentor()`: `void this.marketplaceSearchService.removeMentorFromIndex(id).catch(...)`
5. **Wire UserService for fire-and-forget index sync**: inject `MarketplaceSearchService` (use `forwardRef` if circular); after `updateMentorProfile()` success: `void this.marketplaceSearchService.updateMentorInIndex(profile.id).catch(...)`
6. **Frontend**: `SearchBar`, `MentorFilters` (price range number inputs, rating `@radix-ui/react-select`, availability `@radix-ui/react-checkbox`, 'Clear all'), `MentorCard` (photo, name, headline, top-2 category badges, verified badge, min price, availability indicator, rating), `useMentors` TanStack Query hook; update `/mentors` page
7. **Tests**: `MarketplaceService` (search routing, Redis cache hit/miss, privacy enforcement); `MarketplaceSearchService` (OpenSearch client mocked via jest.fn())

### F2.5 — Search Result Pagination & Sorting (order 3, depends on F2.1)

1. **Extend `MentorSearchQueryDto`**: add `@IsEnum(MentorSortOrder) @IsOptional sort?`, `@IsInt @Min(1) @IsOptional page?` (default 1), `@IsInt @Min(1) @Max(50) @IsOptional limit?` (default 12)
2. **Update `MarketplaceSearchService.searchMentors`**: map `MentorSortOrder` to OpenSearch sort array (`relevance`→`_score desc`; `price_asc`→`minPriceInCents asc`; `price_desc`→`minPriceInCents desc`; `rating_desc`→`averageRating desc`); apply `from=(page-1)*limit`, `size=limit`; include `total` hits in response
3. **Update `MarketplaceService.searchMentors`**: thread page/limit/sort through; compute `totalPages=Math.ceil(total/limit)` in returned `IMentorSearchResponse`
4. **Frontend**: `PaginationControls` ('Showing X–Y of Z mentors', prev/next, up to 5 page buttons), `SortControl` (`@radix-ui/react-select` with 4 options); wire into `/mentors` page; reset page to 1 on filter or sort change

### F2.3 — Mentor Public Profile Page (order 4, depends on F2.5)

1. **GET /api/v1/marketplace/mentors/:id**: calls `MarketplaceService.getMentorById(id)`; returns `PublicMentorProfileDto`; throws `NotFoundException` if not found or not VERIFIED
2. **MarketplaceService.getMentorById**: check Redis (key `marketplace:mentor:{id}:profile`, TTL 600s) → `MarketplaceRepository.findVerifiedMentorById` (Prisma, includes `pricingTiers` + `availabilitySlots`) → cache → map to `PublicMentorProfileDto`; `null` → throw `NotFoundException`
3. **MarketplaceRepository.findVerifiedMentorById**: `prisma.mentorProfile.findFirst({ where: { id, status: 'VERIFIED', verifiedBadge: true }, include: { pricingTiers: true, availabilitySlots: true } })`; returns `null` for non-VERIFIED or missing
4. **SSR `/mentors/[id]` page**: Next.js App Router server component; `generateMetadata` builds `'{firstName} {lastName} — {headline} | Felly Club'`; `notFound()` if API returns 404; renders photo (Next.js Image), name, headline, bio, verified badge (CheckCircle2 icon), expertise category chips, years of experience, LinkedIn link (external tab), pricing tiers (duration + price), `sessionCount` ('New mentor' if 0), `averageRating` ('No ratings yet' if 0), 'Coming Soon' CTA button placeholder
5. **Tests**: expand controller (200 verified, 404 unverified, 404 missing) and service (cache hit bypasses Prisma, privacy enforcement)

### F2.6 — Mentor Availability Display (order 5, depends on F2.3)

1. **`AvailabilityDisplay` component**: groups `IPublicAvailabilitySlot[]` by `dayOfWeek` (0=Sunday…6=Saturday); formats as 'DayName: HH:MM AM – HH:MM PM'; shows 'Not accepting sessions' when slots empty
2. **Update `MentorCard`**: add compact availability indicator — green dot + 'Available' when `availabilitySlots.length > 0`; grey dot + 'Schedule not set' when empty
3. **Update `MentorFilters`**: add 'Available only' `@radix-ui/react-checkbox`; when checked sets `hasAvailability: true` in `IMarketplaceFilters`; when unchecked removes the field
4. **Update `/mentors/[id]` page**: render `AvailabilityDisplay` below pricing section
5. **Update `MarketplaceSearchService.indexMentor`**: compute `hasAvailability = availabilitySlots.length > 0` and include as boolean field in every OpenSearch document body before upsert

### F2.4 — Rule-Based Mentor Recommendations (order 6, depends on F2.6)

1. **`RecommendationsService`**: `getRecommendations(menteeUserId)` → fetch mentee interests via `UserService.findById`; if `interests.length === 0` return `[]`; Prisma query: `mentorProfile.findMany({ where: { status: 'VERIFIED', verifiedBadge: true, expertiseCategories: { hasSome: menteeInterests } }, include: { pricingTiers, availabilitySlots }, take: RECOMMENDATIONS_LIMIT * 3 })`; sort by intersection count desc; take first 8 (`RECOMMENDATIONS_LIMIT=8`); map to `IRecommendationResult[]` with `matchingCategories = intersection(mentor.expertiseCategories, menteeInterests)`
2. **Add `RecommendationsService` to `MarketplaceModule.providers`**
3. **GET /api/v1/marketplace/recommendations**: `@UseGuards(JwtAuthGuard, RolesGuard)` `@Roles(UserRole.MENTEE)` at method level; `@CurrentUser()` extracts mentee payload; delegates to `MarketplaceService.getRecommendations(payload.sub)`
4. **`RecommendedMentors` component**: renders 'Recommended for You' heading + up to 8 `MentorCards` with `matchingCategories` prop ('Matches your interest in Sport, Business'); hidden when `recommendations.length === 0`; `useRecommendations` hook (enabled: isAuthenticated); client-side only
5. **`/mentors` page**: render `RecommendedMentors` above search results, client-side only (auth check prevents SSR of auth-sensitive data)
6. **Coverage config**: add `src/marketplace/**/*.ts` to `jest.config.ts collectCoverageFrom` (exclude `*.spec.ts`, `*.module.ts`, `*dto.ts`)
7. **Tests**: `RecommendationsService` (category intersection, overlap sort, empty interests → [], unverified excluded); `MarketplaceController` recommendations route (401 no JWT, 403 MENTOR role, 200 MENTEE role)

---

## 2. Tech Decisions

| Concern                 | Choice                                                        | Key Detail                                                                                                      |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Search adapter          | `ISearchAdapter` + `SEARCH_ADAPTER_TOKEN`                     | Mirrors `AUTH_ADAPTER_TOKEN` from E1; swap env var to toggle adapter                                            |
| Default search          | `PrismaSearchAdapter` (ILIKE queries)                         | `SEARCH_PROVIDER=prisma` — default; no Docker needed for basic local dev                                        |
| Production search       | `OpenSearchAdapter` (`@opensearch-project/opensearch@^2.3.0`) | `SEARCH_PROVIDER=opensearch`; `OPENSEARCH_URL` env var                                                          |
| OpenSearch local        | docker-compose optional                                       | `DISABLE_SECURITY_PLUGIN=true`; port 9200; `ES_JAVA_OPTS=-Xms256m -Xmx256m`; `discovery.type=single-node`       |
| Cache layer             | ioredis@^5.3.2                                                | `REDIS_URL` env var (already from E1); graceful degradation when unset                                          |
| Cache TTLs              | Search: 300s; Profile: 600s; Categories: 300s                 | Keys: `marketplace:mentors:search:{sha256}`, `marketplace:mentor:{id}:profile`, `marketplace:categories:counts` |
| Index sync              | Fire-and-forget `void promise.catch(logger.error)`            | Never blocks HTTP response; from AdminService (approve/reject) and UserService (profile update)                 |
| Profile source of truth | Prisma for `/mentors/:id` detail                              | NOT OpenSearch — pricing tiers and availability slots must be authoritative from DB                             |
| SSR pages               | `/mentors` (listing) and `/mentors/[id]` (profile)            | Server components; `generateMetadata` for SEO; `notFound()` for 404s                                            |
| Recommendations engine  | Prisma `hasSome` query (NOT OpenSearch)                       | Direct DB intersection for accuracy; sorted by overlap count desc                                               |
| Frontend tabs           | `@radix-ui/react-tabs@^1.0.4`                                 | `CategoryTabs` — keyboard navigation + ARIA semantics                                                           |
| Frontend select         | `@radix-ui/react-select@^2.1.0`                               | `SortControl` and rating filter in `MentorFilters`                                                              |
| Frontend checkbox       | `@radix-ui/react-checkbox@^1.1.1`                             | 'Available only' filter in `MentorFilters`                                                                      |
| Pagination defaults     | page=1, limit=12, max limit=50                                | Reset page to 1 on sort or filter change                                                                        |
| Index alias             | `mentor_profiles_alias`                                       | Used for all queries; enables zero-downtime reindex via alias swap                                              |
| Privacy enforcement     | `@Exclude()` in `PublicMentorProfileDto`                      | `plainToInstance(PublicMentorProfileDto, result, { excludeExtraneousValues: true })`                            |

**OpenSearch document shape** (fields indexed per mentor):

```typescript
{
  id, firstName, lastName, headline, bio,
  expertiseCategories, yearsOfExperience, verifiedBadge: true, status: 'VERIFIED',
  linkedinUrl, photoKey,
  minPriceInCents,   // min(pricingTiers.priceInCents where isActive=true)
  hasAvailability,   // availabilitySlots.length > 0
  sessionCount, averageRating, updatedAt
}
```

**`IPublicMentorProfile` shape** (from shared-types):

```typescript
{
  id: string; firstName: string; lastName: string; headline: string | null;
  bio: string; expertiseCategories: ExpertiseCategory[];
  yearsOfExperience: number | null; linkedinUrl: string | null;
  photoKey: string | null; verifiedBadge: boolean;
  pricingTiers: IPublicPricingTier[]; availabilitySlots: IPublicAvailabilitySlot[];
  sessionCount: number; averageRating: number;
}
```

**`IMentorSearchResponse` shape**:

```typescript
{ mentors: IPublicMentorProfile[]; total: number; page: number; limit: number; totalPages: number; }
```

**SEARCH_ADAPTER_TOKEN binding** (in `marketplace.module.ts`):

```typescript
{
  provide: SEARCH_ADAPTER_TOKEN,
  useClass: process.env['SEARCH_PROVIDER'] === 'opensearch' ? OpenSearchAdapter : PrismaSearchAdapter,
}
```

---

## 3. Domain Rules

**Verified-only invariant (INV-E2-01):**

- Every Prisma query in `MarketplaceRepository` includes `{ status: 'VERIFIED', verifiedBadge: true }` — no exceptions
- `MarketplaceSearchService.indexMentor()` MUST validate `profile.status === 'VERIFIED'` before calling OpenSearch upsert; throw if not VERIFIED
- OpenSearch index only contains VERIFIED mentors; mandatory bool filter on every search query: `{ term: { verifiedBadge: true } }` + `{ term: { status: 'VERIFIED' } }`
- GET /api/v1/marketplace/mentors/:id returns HTTP 404 for any mentor that is not VERIFIED (pending, rejected, draft, suspended)

**Privacy invariant (INV-E2-02):**

- Response objects for public marketplace endpoints NEVER contain: `status`, `rejectionReason`, `verifiedAt`, `completeness`, `verificationArtefacts`, `passwordHash`
- Enforced via `@Exclude()` decorators on `PublicMentorProfileDto` + `plainToInstance(..., { excludeExtraneousValues: true })`
- Test this explicitly: assert absence of forbidden fields in every response shape test

**Category enum invariant (INV-E2-03):**

- Categories shown in the UI come from the `ExpertiseCategory` enum only — not free-text user input
- `countVerifiedByCategory` uses raw SQL with `unnest()` since Prisma cannot groupBy on array fields: `prisma.$queryRaw`

**Recommendations privacy invariant (INV-E2-04):**

- `matchingCategories` in `IRecommendationResult` MUST contain ONLY the intersection of `mentee.interests` and `mentor.expertiseCategories` — NOT the mentor's full category list
- No behavioural tracking, no implicit signals — only the mentee's explicitly stated profile interests

**Fire-and-forget sync rule (INV-E2-05):**

- Index sync calls from `AdminService` and `UserService` are ALWAYS fire-and-forget
- Pattern: `void this.marketplaceSearchService.indexMentor(id).catch((e) => this.logger.error(e))`
- NEVER `await` these calls in request handler scope — they must not block or affect HTTP response status

**Prisma field write ownership:**

- `sessionCount` and `averageRating` on `MentorProfile` are read-only from E2's perspective
- E3 (SessionModule) writes `sessionCount`; E5 (RatingsModule) writes `averageRating`
- E2 only reads these fields for display: shows 'New mentor' when `sessionCount === 0`; shows 'No ratings yet' when `averageRating === 0`

**Architecture pattern** (all new modules must follow):

- Controller: HTTP binding only — extract DTO, call service, return `plainToInstance(ResponseDto, result, { excludeExtraneousValues: true })`
- Service: business logic, cache orchestration, invariant enforcement
- Repository: Prisma queries only — injected with `PrismaService`
- No direct Prisma calls in controllers; no business logic in repositories

---

## 4. Do NOT

- **Do NOT** implement session booking, payments, ratings, or any E3/E4/E5 feature — the 'Coming Soon' button is a placeholder only
- **Do NOT** read any `.meridian/` files during implementation — only this CONTEXT.md
- **Do NOT** implement admin portal UI changes — index sync is triggered from backend `AdminService`, not from admin portal frontend
- **Do NOT** await fire-and-forget index sync calls — they must never block the HTTP response
- **Do NOT** use OpenSearch as the source of truth for the `/mentors/:id` detail endpoint — always fetch from Prisma for authoritative full data
- **Do NOT** write to `sessionCount` or `averageRating` fields — those are E3/E5 territory
- **Do NOT** use real OpenSearch in tests — mock the client via `jest.fn()` in `MarketplaceSearchService` tests
- **Do NOT** require Docker/OpenSearch for basic local development — `SEARCH_PROVIDER=prisma` must work without Docker
- **Do NOT** expose any mentor's private data (status, rejectionReason, verifiedAt, completeness, verificationArtefacts) in any marketplace endpoint — not even in error messages
- **Do NOT** include behavioural tracking or implicit signals in recommendations — only `mentee.interests` (explicit profile field) drives matching
- **Do NOT** call Prisma directly from controllers — always controller → service → repository
- **Do NOT** skip the mandatory `{ status: 'VERIFIED', verifiedBadge: true }` filter on any Prisma query in MarketplaceRepository
- **Do NOT** add `console.log` — use `nestjs-pino` logger everywhere
- **Do NOT** implement mobile app push notifications or real email delivery — those are E7 scope

---

## 5. Files You Own

### Phase 0 — Infrastructure & Shared Types

| File                                                                        | Action   |
| --------------------------------------------------------------------------- | -------- |
| `packages/backend-api/package.json`                                         | modified |
| `packages/mentee-web-app/package.json`                                      | modified |
| `pnpm-lock.yaml`                                                            | modified |
| `docker-compose.yml`                                                        | modified |
| `packages/backend-api/.env.local.example`                                   | modified |
| `packages/shared-types/src/types/marketplace.types.ts`                      | new      |
| `packages/shared-types/src/index.ts`                                        | modified |
| `packages/backend-api/src/marketplace/adapters/search-adapter.interface.ts` | new      |
| `packages/backend-api/src/marketplace/adapters/opensearch.adapter.ts`       | new      |
| `packages/backend-api/src/marketplace/adapters/prisma-search.adapter.ts`    | new      |
| `packages/backend-api/prisma/schema.prisma`                                 | modified |
| `packages/backend-api/prisma/migrations/`                                   | new      |

### F2.2 — Category-Based Marketplace Navigation

| File                                                                            | Action   |
| ------------------------------------------------------------------------------- | -------- |
| `packages/backend-api/src/marketplace/marketplace.module.ts`                    | new      |
| `packages/backend-api/src/marketplace/marketplace.controller.ts`                | new      |
| `packages/backend-api/src/marketplace/marketplace.service.ts`                   | new      |
| `packages/backend-api/src/marketplace/marketplace.repository.ts`                | new      |
| `packages/backend-api/src/marketplace/redis.service.ts`                         | new      |
| `packages/backend-api/src/marketplace/dto/category-count.dto.ts`                | new      |
| `packages/backend-api/src/app.module.ts`                                        | modified |
| `packages/mentee-web-app/src/app/(app)/mentors/page.tsx`                        | new      |
| `packages/mentee-web-app/src/components/marketplace/CategoryTabs.tsx`           | new      |
| `packages/mentee-web-app/src/components/marketplace/EmptyState.tsx`             | new      |
| `packages/mentee-web-app/src/hooks/useCategoryCount.ts`                         | new      |
| `packages/mentee-web-app/src/app/(app)/layout.tsx`                              | modified |
| `packages/backend-api/src/marketplace/__tests__/marketplace.controller.spec.ts` | new      |
| `packages/backend-api/src/marketplace/__tests__/redis.service.spec.ts`          | new      |

### F2.1 — Mentor Search & Filtering

| File                                                                                | Action   |
| ----------------------------------------------------------------------------------- | -------- |
| `packages/backend-api/src/marketplace/marketplace.search.service.ts`                | new      |
| `packages/backend-api/src/marketplace/marketplace.module.ts`                        | modified |
| `packages/backend-api/src/marketplace/marketplace.controller.ts`                    | modified |
| `packages/backend-api/src/marketplace/marketplace.service.ts`                       | modified |
| `packages/backend-api/src/marketplace/marketplace.repository.ts`                    | modified |
| `packages/backend-api/src/marketplace/dto/mentor-search-query.dto.ts`               | new      |
| `packages/backend-api/src/marketplace/dto/public-mentor-profile.dto.ts`             | new      |
| `packages/backend-api/src/admin/admin.module.ts`                                    | modified |
| `packages/backend-api/src/admin/admin.service.ts`                                   | modified |
| `packages/backend-api/src/user/user.service.ts`                                     | modified |
| `packages/mentee-web-app/src/components/marketplace/SearchBar.tsx`                  | new      |
| `packages/mentee-web-app/src/components/marketplace/MentorFilters.tsx`              | new      |
| `packages/mentee-web-app/src/components/marketplace/MentorCard.tsx`                 | new      |
| `packages/mentee-web-app/src/hooks/useMentors.ts`                                   | new      |
| `packages/mentee-web-app/src/app/(app)/mentors/page.tsx`                            | modified |
| `packages/backend-api/src/marketplace/__tests__/marketplace.service.spec.ts`        | new      |
| `packages/backend-api/src/marketplace/__tests__/marketplace.search.service.spec.ts` | new      |

### F2.5 — Search Result Pagination & Sorting

| File                                                                        | Action   |
| --------------------------------------------------------------------------- | -------- |
| `packages/backend-api/src/marketplace/dto/mentor-search-query.dto.ts`       | modified |
| `packages/backend-api/src/marketplace/marketplace.search.service.ts`        | modified |
| `packages/backend-api/src/marketplace/marketplace.service.ts`               | modified |
| `packages/mentee-web-app/src/components/marketplace/PaginationControls.tsx` | new      |
| `packages/mentee-web-app/src/components/marketplace/SortControl.tsx`        | new      |
| `packages/mentee-web-app/src/app/(app)/mentors/page.tsx`                    | modified |

### F2.3 — Mentor Public Profile Page

| File                                                                            | Action   |
| ------------------------------------------------------------------------------- | -------- |
| `packages/backend-api/src/marketplace/marketplace.controller.ts`                | modified |
| `packages/backend-api/src/marketplace/marketplace.service.ts`                   | modified |
| `packages/backend-api/src/marketplace/marketplace.repository.ts`                | modified |
| `packages/mentee-web-app/src/app/(app)/mentors/[id]/page.tsx`                   | new      |
| `packages/mentee-web-app/src/hooks/useMentorDetail.ts`                          | new      |
| `packages/backend-api/src/marketplace/__tests__/marketplace.controller.spec.ts` | modified |
| `packages/backend-api/src/marketplace/__tests__/marketplace.service.spec.ts`    | modified |

### F2.6 — Mentor Availability Display

| File                                                                         | Action   |
| ---------------------------------------------------------------------------- | -------- |
| `packages/mentee-web-app/src/components/marketplace/AvailabilityDisplay.tsx` | new      |
| `packages/mentee-web-app/src/components/marketplace/MentorCard.tsx`          | modified |
| `packages/mentee-web-app/src/components/marketplace/MentorFilters.tsx`       | modified |
| `packages/mentee-web-app/src/app/(app)/mentors/[id]/page.tsx`                | modified |
| `packages/backend-api/src/marketplace/marketplace.search.service.ts`         | modified |

### F2.4 — Rule-Based Mentor Recommendations

| File                                                                             | Action   |
| -------------------------------------------------------------------------------- | -------- |
| `packages/backend-api/src/marketplace/recommendations.service.ts`                | new      |
| `packages/backend-api/src/marketplace/dto/recommendation-result.dto.ts`          | new      |
| `packages/backend-api/src/marketplace/marketplace.module.ts`                     | modified |
| `packages/backend-api/src/marketplace/marketplace.controller.ts`                 | modified |
| `packages/backend-api/src/marketplace/marketplace.service.ts`                    | modified |
| `packages/mentee-web-app/src/components/marketplace/RecommendedMentors.tsx`      | new      |
| `packages/mentee-web-app/src/hooks/useRecommendations.ts`                        | new      |
| `packages/mentee-web-app/src/app/(app)/mentors/page.tsx`                         | modified |
| `packages/backend-api/jest.config.ts`                                            | modified |
| `packages/backend-api/src/marketplace/__tests__/recommendations.service.spec.ts` | new      |
| `packages/backend-api/src/marketplace/__tests__/marketplace.controller.spec.ts`  | modified |

---

## 6. Exit Gate

### Phase 0

- `pnpm install` succeeds with `@opensearch-project/opensearch@^2.3.0` and `ioredis@^5.3.2` in backend-api; `@radix-ui/react-tabs`, `@radix-ui/react-select`, `@radix-ui/react-checkbox` in mentee-web-app
- `npx prisma migrate dev --name add_marketplace_fields` applies; `session_count INTEGER DEFAULT 0` and `average_rating DOUBLE PRECISION DEFAULT 0` columns exist in `mentor_profiles` table
- `SEARCH_PROVIDER=prisma` documented in `.env.local.example`; `pnpm typecheck` passes with new shared-types interfaces; `pnpm build` succeeds across all packages

### F2.2

- `GET /api/v1/marketplace/categories` returns HTTP 200 with `{ category: ExpertiseCategory | 'ALL', count: number }[]` covering every ExpertiseCategory enum value plus the 'ALL' aggregate
- Counts reflect only VERIFIED + verifiedBadge=true mentors — draft, pending, rejected, suspended excluded
- `/mentors` page renders at `http://localhost:3001/mentors` with 'All' tab selected and category tabs with count badges; empty category shows `EmptyState`
- All unit tests pass: `pnpm test --filter @felly/backend-api`

### F2.1

- `GET /api/v1/marketplace/mentors` (no params) → HTTP 200 `{ mentors: IPublicMentorProfile[], total, page, limit, totalPages }`
- `GET /api/v1/marketplace/mentors?q=sport` → HTTP 200, only VERIFIED mentors matching 'sport'
- `GET /api/v1/marketplace/mentors?category=SPORT` → only mentors with SPORT in expertiseCategories
- `GET /api/v1/marketplace/mentors?priceMin=50&priceMax=100` → mentors with min pricing tier between $50–$100
- `GET /api/v1/marketplace/mentors?rating=4` → mentors with averageRating >= 4.0
- PENDING/REJECTED mentor never appears in results
- Response JSON NEVER contains: `status`, `rejectionReason`, `verificationArtefacts`, `completeness`, `passwordHash`
- `SearchBar`, `MentorFilters`, `MentorCard` grid render on `/mentors`
- All unit tests pass: `pnpm test --filter @felly/backend-api`

### F2.5

- `GET /api/v1/marketplace/mentors?page=1&limit=2` → at most 2 mentors + `{ page: 1, limit: 2, totalPages }`
- `GET /api/v1/marketplace/mentors?page=2&limit=2` → next 2 mentors; no ID from page=1 appears
- `GET /api/v1/marketplace/mentors?sort=price_asc` → ordered by minPriceInCents ascending
- `GET /api/v1/marketplace/mentors?sort=rating_desc` → ordered by averageRating descending
- `/mentors` renders `PaginationControls` ('Showing X–Y of Z mentors') and `SortControl` dropdown with 4 options
- Sort or filter change while on page 2 resets to page 1

### F2.3

- `GET /api/v1/marketplace/mentors/{verified-id}` → HTTP 200 with full `IPublicMentorProfile` including `pricingTiers` and `availabilitySlots`
- `GET /api/v1/marketplace/mentors/{pending-id}` → HTTP 404
- `GET /api/v1/marketplace/mentors/{non-existent-uuid}` → HTTP 404
- Response NEVER contains: `status`, `rejectionReason`, `verificationArtefacts`, `completeness`, `passwordHash`
- `http://localhost:3001/mentors/{verified-id}` renders full profile with 'Coming Soon' CTA button
- Browser tab title: `'{firstName} {lastName} — {headline} | Felly Club'`
- Navigate to `/mentors/{pending-id}` → renders Next.js 404 page

### F2.6

- `MentorCard` on `/mentors` shows green 'Available' indicator for mentor with slots; grey 'Schedule not set' for mentor with none
- `/mentors/{id}` renders `AvailabilityDisplay` showing weekly schedule grouped by day (e.g., 'Monday: 10:00 AM – 2:00 PM')
- `/mentors/{id}` shows 'Not accepting sessions' for mentor with no slots
- `GET /api/v1/marketplace/mentors?hasAvailability=true` → only mentors with `availabilitySlots.length > 0`
- `GET /api/v1/marketplace/mentors?hasAvailability=true` with no available mentors → HTTP 200 `{ mentors: [], total: 0 }`

### F2.4

- `GET /api/v1/marketplace/recommendations` (no Authorization) → HTTP 401
- `GET /api/v1/marketplace/recommendations` (MENTOR JWT) → HTTP 403
- `GET /api/v1/marketplace/recommendations` (MENTEE JWT, interests=[SPORT, BUSINESS]) → HTTP 200 `IRecommendationResult[]` where every mentor is VERIFIED; `matchingCategories` is the intersection only (not full mentor category list)
- `GET /api/v1/marketplace/recommendations` (MENTEE JWT, no interests) → HTTP 200 `[]`
- Results never exceed 8 items
- `/mentors` shows 'Recommended for You' section for authenticated mentee with interests; section absent for unauthenticated visitor
- `pnpm test --filter @felly/backend-api` passes with ≥70% branch coverage, ≥80% function/line/statement coverage on marketplace service files
- `pnpm lint` passes (zero ESLint errors on marketplace files)
- `pnpm typecheck` passes across all packages
- `pnpm build` passes (Next.js + backend-api TypeScript compile)
