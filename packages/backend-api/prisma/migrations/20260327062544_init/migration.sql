-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MENTEE', 'MENTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MentorProfileStatus" AS ENUM ('INCOMPLETE', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpertiseCategory" AS ENUM ('SOFTWARE_ENGINEERING', 'PRODUCT_MANAGEMENT', 'DESIGN', 'DATA_SCIENCE', 'BUSINESS', 'MARKETING', 'OTHER', 'SPORT', 'ENTREPRENEURSHIP', 'ENTERTAINMENT');

-- CreateEnum
CREATE TYPE "ArtefactType" AS ENUM ('RESUME', 'LINKEDIN_URL', 'PORTFOLIO_URL', 'CERTIFICATION', 'GITHUB_URL', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'EMAIL_VERIFIED', 'USER_LOGGED_IN', 'USER_LOGGED_OUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PROFILE_UPDATED', 'MENTOR_APPLICATION_SUBMITTED', 'MENTOR_APPLICATION_APPROVED', 'MENTOR_APPLICATION_REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MENTEE',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentee_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interests" "ExpertiseCategory"[],
    "bio" TEXT,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MentorProfileStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "headline" TEXT,
    "bio" TEXT,
    "expertiseCategories" "ExpertiseCategory"[],
    "yearsOfExperience" INTEGER,
    "linkedinUrl" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "verifiedBadge" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_pricing_tiers" (
    "id" TEXT NOT NULL,
    "mentorProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceInCents" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_availability_slots" (
    "id" TEXT NOT NULL,
    "mentorProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTimeUtc" TEXT NOT NULL,
    "endTimeUtc" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_artefacts" (
    "id" TEXT NOT NULL,
    "mentorProfileId" TEXT NOT NULL,
    "type" "ArtefactType" NOT NULL,
    "value" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_artefacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "metadata" JSONB,
    "ipAddressHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mentee_profiles_userId_key" ON "mentee_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_userId_key" ON "mentor_profiles"("userId");

-- AddForeignKey
ALTER TABLE "mentee_profiles" ADD CONSTRAINT "mentee_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_pricing_tiers" ADD CONSTRAINT "mentor_pricing_tiers_mentorProfileId_fkey" FOREIGN KEY ("mentorProfileId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_availability_slots" ADD CONSTRAINT "mentor_availability_slots_mentorProfileId_fkey" FOREIGN KEY ("mentorProfileId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_artefacts" ADD CONSTRAINT "verification_artefacts_mentorProfileId_fkey" FOREIGN KEY ("mentorProfileId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
