-- References can be a web link instead of an uploaded image.
ALTER TABLE "Reference" ALTER COLUMN "assetId" DROP NOT NULL;
ALTER TABLE "Reference" ADD COLUMN "url" TEXT;
