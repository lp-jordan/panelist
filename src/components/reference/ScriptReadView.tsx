import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LockToggle } from "@/components/reference/LockToggle";
import { ScriptSheets, type TitlePageMeta } from "@/components/print/ScriptSheets";
import type { JSONNode } from "@/lib/editor/serialize";

/**
 * The locked, read-only view of a script (V2 C). Renders the same fixed-
 * geometry sheets as the print/export path, on a desk, with the mode switch
 * to unlock back into the editor. Reference pins overlay these pages in a
 * later slice — each `.px-page` is position:relative, so a pin sits at an
 * x/y percentage of its page.
 */
export function ScriptReadView({
  scriptId,
  projectId,
  projectName,
  doc,
  meta,
}: {
  scriptId: string;
  projectId: string | null;
  projectName: string | null;
  doc: JSONNode;
  meta: TitlePageMeta;
}) {
  const backHref = projectId ? `/projects/${projectId}` : "/";
  const backLabel = projectName ?? "Library";

  return (
    <div className="shell rv-shell">
      <nav className="nav">
        <Link href={backHref} className="nav-back" aria-label={`Back to ${backLabel}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="nav-back-label">{backLabel}</span>
        </Link>
        <span className="nav-spacer" />
        <span className="nav-title">{meta.title}</span>
        <span className="nav-spacer" />
        <ThemeToggle />
        <LockToggle id={scriptId} locked />
      </nav>

      <div className="rv-stage">
        <ScriptSheets doc={doc} meta={meta} />
      </div>
    </div>
  );
}
