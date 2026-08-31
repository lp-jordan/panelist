-- CreateTable
CREATE TABLE "AssetData" (
    "assetId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "AssetData_pkey" PRIMARY KEY ("assetId")
);

-- AddForeignKey
ALTER TABLE "AssetData" ADD CONSTRAINT "AssetData_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

