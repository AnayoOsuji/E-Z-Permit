// Tick-off progress for a saved checklist. A step is done when its id is in the set.

export type ProgressSummary = { done: number; total: number; percent: number; label: string };

/** Counts only ids that are real steps, so stale rows (a step renamed since) can't push the bar past 100%. */
export function summarizeProgress(doneIds: Iterable<string>, stepIds: string[]): ProgressSummary {
  const valid = new Set(stepIds);
  const done = new Set([...doneIds].filter((id) => valid.has(id))).size;
  const total = valid.size;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    label: `${done} of ${total} step${total === 1 ? "" : "s"} done`,
  };
}

/** A new set with the step flipped. Never changes the one passed in. */
export function toggleStep(done: ReadonlySet<string>, stepId: string): Set<string> {
  const next = new Set(done);
  if (!next.delete(stepId)) next.add(stepId);
  return next;
}
