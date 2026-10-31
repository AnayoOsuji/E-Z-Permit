import { LAST_STEP, type WizardValues } from "./wizard.ts";

// The dashboard wizard's draft (answers + current step), kept in the browser so a refresh doesn't lose it.
// Stored per signed-in user so a shared computer never shows someone else's draft.

export type WizardDraft = { step: number; values: WizardValues };

export const draftKey = (userId: string) => `ezpermit:wizard:${userId}`;

export const EMPTY_VALUES: WizardValues = { city: "", state: "", businessType: "" };

export function serializeDraft(draft: WizardDraft): string {
  return JSON.stringify(draft);
}

/** Reads a stored draft defensively: anything malformed gives null instead of throwing. */
export function parseDraft(raw: string | null): WizardDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { step?: unknown; values?: Record<string, unknown> } | null;
    const v = data?.values;
    if (!v || typeof v.city !== "string" || typeof v.state !== "string" || typeof v.businessType !== "string") return null;
    const step = Number.isInteger(data?.step) ? Math.min(Math.max(data!.step as number, 0), LAST_STEP) : 0;
    const values = { city: v.city.slice(0, 80), state: v.state.slice(0, 2), businessType: v.businessType.slice(0, 100) };
    if (!values.city && !values.state && !values.businessType) return null;
    return { step, values };
  } catch {
    return null;
  }
}
