-- CreateEnum
CREATE TYPE "ScriptSource" AS ENUM ('EDITOR', 'IMPORTED_PDF');

-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'PDF_PAGE';

-- AlterTable
ALTER TABLE "Script" ADD COLUMN "source" "ScriptSource" NOT NULL DEFAULT 'EDITOR';

-- CreateTable
CREATE TABLE "ImportedPage" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "assetId" TEXT NOT NULL,
    "text" TEXT,

    CONSTRAINT "ImportedPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedPage_assetId_key" ON "ImportedPage"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedPage_scriptId_order_key" ON "ImportedPage"("scriptId", "order");

-- AddForeignKey
ALTER TABLE "ImportedPage" ADD CONSTRAINT "ImportedPage_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedPage" ADD CONSTRAINT "ImportedPage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
