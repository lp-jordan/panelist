-- CreateEnum
CREATE TYPE "PreviewStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "ArtVersion" ADD COLUMN     "note" TEXT,
ADD COLUMN     "previewStatus" "PreviewStatus" NOT NULL DEFAULT 'READY';

-- CreateIndex
CREATE INDEX "ArtVersion_previewStatus_idx" ON "ArtVersion"("previewStatus");

