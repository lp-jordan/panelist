import { setScriptLock } from "@/app/actions/scripts";

/**
 * The mode switch in a script's nav bar. Unlocked → editor; locked → the
 * reference read view. A plain server-action form so it works whether it's
 * rendered by the (server) read view or the (client) editor nav.
 */
export function LockToggle({ id, locked }: { id: string; locked: boolean }) {
  return (
    <form action={setScriptLock} className="lock-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locked" value={locked ? "false" : "true"} />
      <button
        type="submit"
        className={`lock-toggle${locked ? " lock-toggle--on" : ""}`}
        aria-label={locked ? "Unlock to edit the script" : "Lock the script to place references"}
      >
        {locked ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 017.9-1" />
          </svg>
        )}
        {locked ? "Locked" : "Lock"}
      </button>
    </form>
  );
}
