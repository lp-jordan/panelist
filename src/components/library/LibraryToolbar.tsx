"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Search for the project index. Filters as you type; still a real form, so it
 * degrades to submit-to-search without scripting. (Sorting went away with the
 * flat script list — projects are a short, name-ordered set.)
 */
export function LibraryToolbar({ q }: { q: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const first = useRef(true);

  const push = (nextQuery: string) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  // Debounced so a search doesn't fire a request per keystroke.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => push(query), 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <form
      className="toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        push(query);
      }}
    >
      <label className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          value={query}
          placeholder="Search projects"
          aria-label="Search projects"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
    </form>
  );
}
