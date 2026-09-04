"use client";

import { useActionState, useState } from "react";
import { createInvite, revokeInvite, removeMember, type InviteResult } from "@/app/actions/invites";

type Member = { id: string; name: string; email: string; role: "OWNER" | "COLLABORATOR"; isSelf: boolean };
type Invite = { id: string; email: string; role: "OWNER" | "COLLABORATOR"; token: string };

function roleLabel(role: "OWNER" | "COLLABORATOR") {
  return role === "OWNER" ? "Owner" : "Collaborator";
}

function inviteLink(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(inviteLink(token));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — the link is still shown below */
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function MembersPanel({
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
  const [state, action] = useActionState<InviteResult, FormData>(createInvite, undefined);

  return (
    <section className="group" aria-labelledby="members-heading">
      <h2 id="members-heading" className="group-title">Team</h2>

      <ul className="member-list">
        {members.map((m) => (
          <li key={m.id} className="member-row">
            <div className="member-id">
              <span className="member-name">{m.name}{m.isSelf ? " (you)" : ""}</span>
              <span className="member-email">{m.email}</span>
            </div>
            <span className="member-role">{roleLabel(m.role)}</span>
            {isOwner && !m.isSelf && m.role !== "OWNER" && (
              <form action={removeMember}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="userId" value={m.id} />
                <button type="submit" className="btn-danger-quiet" aria-label={`Remove ${m.name}`}>
                  Remove
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <>
          <form action={action} className="invite-form">
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="email"
              name="email"
              required
              placeholder="teammate@email.com"
              className="field"
              aria-label="Invite by email"
            />
            <select name="role" className="field" defaultValue="COLLABORATOR" aria-label="Role">
              <option value="COLLABORATOR">Collaborator</option>
              <option value="OWNER">Owner</option>
            </select>
            <button type="submit" className="btn-primary">Invite</button>
          </form>
          {state?.error && <p className="form-error">{state.error}</p>}
          {state?.token && (
            <p className="invite-hint">
              Invite ready — share this link:{" "}
              <code className="invite-code">{inviteLink(state.token)}</code>
            </p>
          )}

          {invites.length > 0 && (
            <ul className="member-list">
              {invites.map((inv) => (
                <li key={inv.id} className="member-row">
                  <div className="member-id">
                    <span className="member-name">{inv.email}</span>
                    <span className="member-email">Pending · {roleLabel(inv.role)}</span>
                  </div>
                  <CopyLink token={inv.token} />
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button type="submit" className="btn-danger-quiet">Revoke</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
