// "How long did it take?" community reports.

export const MIN_DAYS = 0;
export const MAX_DAYS = 365;
/** A step's community number stays hidden until this many people have reported. */
export const MIN_REPORTS = 3;

export type DaysResult = { ok: true; days: number } | { ok: false; error: string };

/** Checks what someone typed: a whole number of days from 0 to 365. */
export function parseDays(input: string | number): DaysResult {
  const text = String(input).trim();
  if (text === "") return { ok: false, error: "Enter the number of days." };
  if (!/^\d+$/.test(text)) return { ok: false, error: "Use a whole number of days, like 14." };
  const days = Number(text);
  if (days < MIN_DAYS || days > MAX_DAYS) return { ok: false, error: `Enter a number from ${MIN_DAYS} to ${MAX_DAYS}.` };
  return { ok: true, days };
}

/** Middle value (mean of the two middle ones for an even count). Outliers barely move it. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type CommunityStat = { days: number; reports: number };

/** The number to show for a step, or null while there are too few reports. Out-of-range values are ignored. */
export function communityStat(reported: number[]): CommunityStat | null {
  const valid = reported.filter((d) => Number.isInteger(d) && d >= MIN_DAYS && d <= MAX_DAYS);
  if (valid.length < MIN_REPORTS) return null;
  return { days: Math.round(median(valid)), reports: valid.length };
}

export type StatRow = { step_id: string; median_days: number | string; report_count: number | string };

/** One row from the database's step_duration_stats(), with the same 3-report rule applied again. */
function fromRow(row: StatRow): CommunityStat | null {
  const reports = Number(row.report_count);
  const days = Number(row.median_days);
  return reports >= MIN_REPORTS && Number.isFinite(days) ? { days: Math.round(days), reports } : null;
}

export function statsByStep(rows: StatRow[] | null | undefined): Record<string, CommunityStat> {
  const out: Record<string, CommunityStat> = {};
  for (const row of rows ?? []) {
    const stat = fromRow(row);
    if (stat) out[row.step_id] = stat;
  }
  return out;
}

export function formatCommunity(stat: CommunityStat): string {
  return `Community average: ${stat.days} day${stat.days === 1 ? "" : "s"} (from ${stat.reports} report${stat.reports === 1 ? "" : "s"})`;
}
