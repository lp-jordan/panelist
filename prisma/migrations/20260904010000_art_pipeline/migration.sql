-- CreateTable
CREATE TABLE "ArtPage" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentVersionId" TEXT,

    CONSTRAINT "ArtPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtVersion" (
    "id" TEXT NOT NULL,
    "artPageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "previewKey" TEXT,
    "bytes" INTEGER,
    "mime" TEXT,
    "originalName" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtComment" (
    "id" TEXT NOT NULL,
    "artPageId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "xPct" DOUBLE PRECISION NOT NULL,
    "yPct" DOUBLE PRECISION NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ArtComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtPage_currentVersionId_key" ON "ArtPage"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtPage_scriptId_pageNumber_key" ON "ArtPage"("scriptId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ArtVersion_artPageId_version_key" ON "ArtVersion"("artPageId", "version");

-- AddForeignKey
ALTER TABLE "ArtPage" ADD CONSTRAINT "ArtPage_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtPage" ADD CONSTRAINT "ArtPage_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ArtVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtVersion" ADD CONSTRAINT "ArtVersion_artPageId_fkey" FOREIGN KEY ("artPageId") REFERENCES "ArtPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtVersion" ADD CONSTRAINT "ArtVersion_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtComment" ADD CONSTRAINT "ArtComment_artPageId_fkey" FOREIGN KEY ("artPageId") REFERENCES "ArtPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtComment" ADD CONSTRAINT "ArtComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

