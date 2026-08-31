"use client";

import { useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { createScript } from "@/app/actions/scripts";
import { createProject } from "@/app/actions/projects";

/**
 * The `+` in the nav bar. Its one action follows the hierarchy: from the
 * Library you make a project, from inside a project you make a script (an
 * issue) that lands in that project. A single action, so `+` opens its sheet
 * directly rather than a menu.
 */
export function NewMenu({ mode, projectId }: { mode: "project" | "script"; projectId?: string }) {
  const [open, setOpen] = useState(false);
  const label = mode === "project" ? "New project" : "New script";

  return (
    <>
      <button type="button" className="icon-btn" aria-label={label} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {mode === "project" ? (
        <FormSheet open={open} onClose={() => setOpen(false)} title="New project" submitLabel="Create" action={createProject}>
          <input className="field" name="name" placeholder="Project name" aria-label="Project name" required />
        </FormSheet>
      ) : (
        <FormSheet open={open} onClose={() => setOpen(false)} title="New script" submitLabel="Create" action={createScript}>
          <input type="hidden" name="projectId" value={projectId ?? ""} />
          <input className="field" name="title" placeholder="Script title" aria-label="Script title" required />
        </FormSheet>
      )}
    </>
  );
}
