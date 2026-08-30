import type { TitlePageValues } from "./TitlePageSheet";

// Formats the stored yyyy-mm-dd draft date into a readable "Month D, YYYY"
// without constructing a Date (which would shift the day across time zones).
// Returns "" for a blank or malformed value so the caller can omit the date.
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function formatDraftDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return "";
  return `${monthName} ${Number(day)}, ${year}`;
}

/**
 * The cover as a real sheet in the printed/exported document — the on-screen
 * TitlePageSheet is only an editor, hidden in print, so without this the title
 * page never reached the PDF. Rendered before the script pages and hidden on
 * screen (see `.sx-cover` in script-editor.css); it draws from the same saved
 * title-page fields the editor commits.
 */
export function TitlePagePrint({ title, author, draftLabel, draftDate }: TitlePageValues) {
  const dateText = formatDraftDate(draftDate);
  return (
    <div className="sx-cover" aria-hidden="true">
      <div className="sx-cover-titleblock">
        <div className="sx-cover-title">{title.trim() || "Untitled"}</div>
        {author.trim() && (
          <div className="sx-cover-writtenby">
            <span>Written by</span> <span>{author.trim()}</span>
          </div>
        )}
      </div>
      <div className="sx-cover-draft">
        <span className="sx-cover-draft-label">{draftLabel.trim() || "Draft #1"}</span>
        {dateText && (
          <>
            <span>:&nbsp;</span>
            <span className="sx-cover-draft-date">{dateText}</span>
          </>
        )}
      </div>
    </div>
  );
}
