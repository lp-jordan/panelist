"use client";

import { useState, useTransition, type ReactNode } from "react";
import { moveScript } from "@/app/actions/scripts";

// The MIME the draggable ScriptRow writes, and that a zone accepts.
export const SCRIPT_DND_TYPE = "application/x-panelist-script";

/**
 * Wraps a group's `.list` so scripts can be dropped into it. `projectId` is the
 * destination — null for the Unassigned group. A drop from the same group is a
 * no-op, so the payload carries the script's current project.
 */
export function ScriptDropZone({
  projectId,
  children,
}: {
  projectId: string | null;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [, startTransition] = useTransition();

  const currentOf = (e: React.DragEvent) =>
    e.dataTransfer.getData(`${SCRIPT_DND_TYPE}+project`) || null;

  return (
    <div
      className={`list${over ? " drop-target" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(SCRIPT_DND_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer actually leaves the zone, not when it
        // crosses onto a child row.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes(SCRIPT_DND_TYPE)) return;
        e.preventDefault();
        setOver(false);
        const scriptId = e.dataTransfer.getData(SCRIPT_DND_TYPE);
        const from = currentOf(e);
        if (!scriptId || from === projectId) return;
        startTransition(() => moveScript(scriptId, projectId));
      }}
    >
      {children}
    </div>
  );
}
