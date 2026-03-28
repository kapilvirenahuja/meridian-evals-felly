-- AlterTable
ALTER TABLE "mentor_profiles" ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sessionCount" INTEGER NOT NULL DEFAULT 0;
