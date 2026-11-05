/** Where a signed-in user lands to save a guide to their account (and optionally opt in to reminders). */
export function savePath(guideId: string, optIn = false): string {
  return `/my-roadmaps/save?c=${encodeURIComponent(guideId)}${optIn ? "&optin=1" : ""}`;
}
