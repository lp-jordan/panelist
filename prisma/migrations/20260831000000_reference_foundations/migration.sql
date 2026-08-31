-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('REFERENCE', 'ART');

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_uploadedBy_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "kind" "AssetKind" NOT NULL DEFAULT 'ART',
ADD COLUMN     "mime" TEXT,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "thumbKey" TEXT,
ALTER COLUMN "pageId" DROP NOT NULL,
ALTER COLUMN "uploadedBy" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceInCollection" (
    "referenceId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "ReferenceInCollection_pkey" PRIMARY KEY ("referenceId","collectionId")
);

-- CreateTable
CREATE TABLE "ReferencePlacement" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferencePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reference_assetId_key" ON "Reference"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_projectId_name_key" ON "Collection"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ReferencePlacement_referenceId_panelId_key" ON "ReferencePlacement"("referenceId", "panelId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceInCollection" ADD CONSTRAINT "ReferenceInCollection_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceInCollection" ADD CONSTRAINT "ReferenceInCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePlacement" ADD CONSTRAINT "ReferencePlacement_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePlacement" ADD CONSTRAINT "ReferencePlacement_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

