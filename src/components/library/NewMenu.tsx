"use client";

import { useState } from "react";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { createScript } from "@/app/actions/scripts";
import { createProject } from "@/app/actions/projects";

/** The `+` in the nav bar — the one way to add anything. */
export function NewMenu({ projects }: { projects: { id: string; name: string }[] }) {
  const [sheet, setSheet] = useState<"script" | "project" | null>(null);

  return (
    <>
      <Menu
        label="New"
        triggerClassName="icon-btn"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        }
      >
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                setSheet("script");
              }}
            >
              New script
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h11l5 5v11H4z" />
                <path d="M15 4v5h5" />
              </svg>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                setSheet("project");
              }}
            >
              New project
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7h6l2 2h10v10H3z" />
              </svg>
            </button>
          </>
        )}
      </Menu>

      <FormSheet
        open={sheet === "script"}
        onClose={() => setSheet(null)}
        title="New script"
        submitLabel="Create"
        action={createScript}
      >
        <input className="field" name="title" placeholder="Script title" aria-label="Script title" required />
        <select className="field" name="projectId" defaultValue="" aria-label="Project">
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </FormSheet>

      <FormSheet
        open={sheet === "project"}
        onClose={() => setSheet(null)}
        title="New project"
        submitLabel="Create"
        action={createProject}
      >
        <input className="field" name="name" placeholder="Project name" aria-label="Project name" required />
      </FormSheet>
    </>
  );
}
