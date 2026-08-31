// Removes Next's incremental build cache before a production build so compiled
// CSS/JS always regenerate from current source. This exists because a stale
// .next/cache (restored between deploys) served an old stylesheet even though
// the server code was current — the "fix landed in git but not in the app" bug.
// Kept in a file (run via the `prebuild` npm hook) rather than an inline
// `node -e` so there are no shell-quoting pitfalls in the deploy environment.
import { rmSync } from "node:fs";

rmSync(".next/cache", { recursive: true, force: true });
console.log("cleared .next/cache");
