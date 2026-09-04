-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (V2 D1): all existing data belongs to the single current OWNER.
-- Every script gets that owner…
UPDATE "Script"
SET "ownerId" = (SELECT id FROM "User" WHERE role = 'OWNER' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "ownerId" IS NULL;

-- …and that owner becomes an OWNER member of every existing project (so the
-- project-membership access model sees them), unless already a member.
INSERT INTO "ProjectMember" ("id", "projectId", "userId", "role")
SELECT gen_random_uuid()::text, p.id, u.id, 'OWNER'
FROM "Project" p
CROSS JOIN (SELECT id FROM "User" WHERE role = 'OWNER' ORDER BY "createdAt" ASC LIMIT 1) u
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectMember" m WHERE m."projectId" = p.id AND m."userId" = u.id
);

