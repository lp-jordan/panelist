export interface Cue {
  /** Cue type, e.g. CHARACTER, SFX, NARRATION, CAPTION */
  type: string;
  /** Displayed cue label */
  label: string;
  /** Text content associated with the cue */
  content: string;
}

export interface Panel {
  /** Sequential panel number starting at 1 */
  panel_number: number;
  /** Panel heading followed by optional description */
  header: string;
  /** Ordered list of cues within the panel */
  cues: Cue[];
  /** Optional notes for the panel */
  notes?: string;
}

export interface ScriptPage {
  /** Page number */
  page: number;
  /** Number of panels on the page */
  panel_count: number;
  /** Panels contained in the page */
  panels: Panel[];
}
