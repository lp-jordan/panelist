-- DropForeignKey
ALTER TABLE "Reference" DROP CONSTRAINT "Reference_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_projectId_fkey";

-- DropIndex
DROP INDEX "Collection_projectId_name_key";

-- AlterTable
ALTER TABLE "Reference" DROP COLUMN "projectId",
ADD COLUMN     "scriptId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "projectId",
ADD COLUMN     "scriptId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Collection_scriptId_name_key" ON "Collection"("scriptId", "name");

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

