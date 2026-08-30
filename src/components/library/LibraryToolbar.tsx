"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SORTS = [
  { value: "updated", label: "Recent" },
  { value: "title", label: "Title" },
] as const;

/**
 * Search and sort. The old version needed an Apply button; this one filters as
 * you type. It's still a real form, so it degrades to the Apply behaviour if
 * scripting is off.
 */
export function LibraryToolbar({ q, sort }: { q: string; sort: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [active, setActive] = useState(sort);
  const segRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  const push = (nextQuery: string, nextSort: string) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextSort !== "updated") params.set("sort", nextSort);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  // Debounced so a search doesn't fire a request per keystroke.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => push(query, active), 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // The pill is measured rather than positioned by percentage, so segments can
  // be different widths.
  useLayoutEffect(() => {
    const seg = segRef.current;
    const pill = pillRef.current;
    if (!seg || !pill) return;

    const move = () => {
      const current = seg.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!current) return;
      pill.style.width = `${current.offsetWidth}px`;
      pill.style.transform = `translateX(${current.offsetLeft - 2}px)`;
    };

    move();
    const observer = new ResizeObserver(move);
    observer.observe(seg);
    return () => observer.disconnect();
  }, [active]);

  return (
    <form
      className="toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        push(query, active);
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
          placeholder="Search scripts"
          aria-label="Search scripts"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="seg" ref={segRef} role="group" aria-label="Sort by">
        <span className="seg-pill" ref={pillRef} aria-hidden="true" />
        {SORTS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={active === option.value}
            onClick={() => {
              setActive(option.value);
              push(query, option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Only reached without scripting, where the buttons above are inert. */}
      <noscript>
        <input type="hidden" name="sort" value={active} />
        <button type="submit" className="btn-plain">
          Apply
        </button>
      </noscript>
    </form>
  );
}
