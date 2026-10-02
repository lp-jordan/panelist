"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Portal } from "./Portal";

/**
 * Confirmation for anything irreversible. Replaces `window.confirm`, which
 * couldn't name the object, state the consequence, or colour the dangerous
 * verb differently from the safe one.
 *
 * The action is a server action; `hidden` carries whatever it needs. With
 * `choices`, the sheet offers several outcomes instead of one: each is a
 * submit button that sends `choiceName=value` along with the form.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  action,
  hidden,
  choices,
  choiceName = "choice",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  choices?: { label: string; value: string; danger?: boolean }[];
  choiceName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <Portal>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div className="sheet" data-open={open} role="alertdialog" aria-label={title} inert={!open}>
        <form action={action} className="sheet-card">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="sheet-head">
            <strong>{title}</strong>
            {description && <span>{description}</span>}
          </div>
          {choices ? (
            choices.map((c) => (
              <ConfirmButton key={c.value} label={c.label} name={choiceName} value={c.value} danger={c.danger} />
            ))
          ) : (
            <ConfirmButton label={confirmLabel} />
          )}
        </form>
        <div className="sheet-card sheet-card--cancel">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}

// Server actions give no feedback on their own, so the button reports its own
// pending state rather than sitting there looking unpressed.
function ConfirmButton({
  label,
  name,
  value,
  danger = true,
}: {
  label: string;
  name?: string;
  value?: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={danger ? "danger" : undefined} name={name} value={value} disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}
