-- Art notes belong to the version they were left on.
ALTER TABLE "ArtComment" ADD COLUMN "versionId" TEXT;

-- Existing notes were made against whatever was current; attach them there.
UPDATE "ArtComment" c
SET "versionId" = p."currentVersionId"
FROM "ArtPage" p
WHERE c."artPageId" = p."id";

ALTER TABLE "ArtComment" ADD CONSTRAINT "ArtComment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
