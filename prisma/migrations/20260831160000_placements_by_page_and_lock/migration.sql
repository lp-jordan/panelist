-- DropForeignKey
ALTER TABLE "ReferencePlacement" DROP CONSTRAINT "ReferencePlacement_panelId_fkey";

-- DropIndex
DROP INDEX "ReferencePlacement_referenceId_panelId_key";

-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReferencePlacement" DROP COLUMN "panelId",
ADD COLUMN     "pageNumber" INTEGER NOT NULL,
ADD COLUMN     "xPct" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "yPct" DOUBLE PRECISION NOT NULL;

