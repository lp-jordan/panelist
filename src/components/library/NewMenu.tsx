"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { createScript } from "@/app/actions/scripts";
import { createProject } from "@/app/actions/projects";

const PLUS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The `+` in the nav bar. From the Library it makes a project. From inside a
 * project it offers two ways to add an issue: write a new one in the editor, or
 * import a finished script as a PDF (image-backed pages).
 */
export function NewMenu({ mode, projectId }: { mode: "project" | "script"; projectId?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (mode === "project") {
    return (
      <>
        <button type="button" className="icon-btn" aria-label="New project" onClick={() => setOpen(true)}>
          {PLUS}
        </button>
        <FormSheet open={open} onClose={() => setOpen(false)} title="New project" submitLabel="Create" action={createProject}>
          <input className="field" name="name" placeholder="Project name" aria-label="Project name" required />
        </FormSheet>
      </>
    );
  }

  return (
    <>
      <Menu label="Add an issue" triggerClassName="icon-btn" icon={PLUS}>
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                setOpen(true);
              }}
            >
              New script
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9M4 20h1L18 7l-3-3L3 16v4z" />
              </svg>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                router.push(`/projects/${projectId}/import`);
              }}
            >
              Import PDF
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 3v5h5" />
                <path d="M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" />
              </svg>
            </button>
          </>
        )}
      </Menu>

      <FormSheet open={open} onClose={() => setOpen(false)} title="New script" submitLabel="Create" action={createScript}>
        <input type="hidden" name="projectId" value={projectId ?? ""} />
        <input className="field" name="title" placeholder="Script title" aria-label="Script title" required />
      </FormSheet>
    </>
  );
}
