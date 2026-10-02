"use client";

import { useEffect, useState } from "react";
import { MembersPanel } from "@/components/project/MembersPanel";

type Member = { id: string; name: string; email: string; role: "OWNER" | "COLLABORATOR"; isSelf: boolean };
type Invite = { id: string; email: string; role: "OWNER" | "COLLABORATOR"; token: string };

// The gear in the project nav opens a settings modal; the team/invite management
// lives inside it rather than out on the hub (V2 D3). Reuses the app's shared
// scrim + form-sheet chrome (see ShortcutsSheet).
export function ProjectSettings({
  projectId,
  isOwner,
  members,
  invites,
}: {
  projectId: string;
  isOwner: boolean;
  members: Member[];
  invites: Invite[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Team"
        title="Team"
        onClick={() => setOpen(true)}
      >
        {/* Two people: the team. A single figure would read as the account menu. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 19.5a6 6 0 0112 0" />
          <path d="M15.5 4.9a3.2 3.2 0 010 6.2M17.5 13.6a6 6 0 013.5 5.9" />
        </svg>
      </button>

      <div className="scrim" data-open={open} onClick={() => setOpen(false)} />
      <div
        className="form-sheet"
        data-open={open}
        role="dialog"
        aria-label="Project settings"
        inert={!open}
      >
        <div className="form-sheet-card">
          <div className="form-sheet-head">
            <span />
            <strong>Team</strong>
            <button type="button" onClick={() => setOpen(false)}>Done</button>
          </div>
          <div className="members-body">
            {!isOwner && members.length <= 1 ? (
              <p className="invite-hint">You&apos;re the only person on this book.</p>
            ) : (
              <MembersPanel
                projectId={projectId}
                isOwner={isOwner}
                members={members}
                invites={invites}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
