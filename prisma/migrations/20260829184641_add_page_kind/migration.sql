-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SCRIPT',
    CONSTRAINT "Page_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Page" ("id", "order", "scriptId") SELECT "id", "order", "scriptId" FROM "Page";
DROP TABLE "Page";
ALTER TABLE "new_Page" RENAME TO "Page";
CREATE UNIQUE INDEX "Page_scriptId_order_key" ON "Page"("scriptId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
