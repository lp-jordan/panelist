-- References move from tags (collections) to one level of folders. Tags are
-- dropped outright; every reference starts at the root.
DROP TABLE "ReferenceInCollection";
DROP TABLE "Collection";

CREATE TABLE "ReferenceFolder" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferenceFolder_scriptId_name_key" ON "ReferenceFolder"("scriptId", "name");

ALTER TABLE "ReferenceFolder" ADD CONSTRAINT "ReferenceFolder_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reference" ADD COLUMN "folderId" TEXT;

ALTER TABLE "Reference" ADD CONSTRAINT "Reference_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ReferenceFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
