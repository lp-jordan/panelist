// Removes Next's incremental build cache before a production build so compiled
// CSS/JS always regenerate from current source. This exists because a stale
// .next/cache (restored between deploys) served an old stylesheet even though
// the server code was current — the "fix landed in git but not in the app" bug.
// Kept in a file (run via the `prebuild` npm hook) rather than an inline
// `node -e` so there are no shell-quoting pitfalls in the deploy environment.
//
// We clear the *contents* of .next/cache rather than the directory itself: on
// Railway .next/cache is a persisted cache mount, and rmdir on the mount point
// fails with EBUSY. Removing the entries inside it leaves the mount intact.
// Clearing is also best-effort — a locked entry must never fail the build,
// especially now that stale CSS is defended against at the source too.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = ".next/cache";

let entries;
try {
  entries = readdirSync(CACHE_DIR);
} catch (err) {
  if (err.code === "ENOENT") {
    console.log("no .next/cache to clear");
    process.exit(0);
  }
  console.warn(`could not read ${CACHE_DIR}: ${err.code ?? err.message} — skipping`);
  process.exit(0);
}

let cleared = 0;
for (const entry of entries) {
  try {
    rmSync(join(CACHE_DIR, entry), { recursive: true, force: true });
    cleared += 1;
  } catch (err) {
    console.warn(`could not remove ${entry}: ${err.code ?? err.message} — skipping`);
  }
}

console.log(`cleared ${cleared}/${entries.length} entries from .next/cache`);
