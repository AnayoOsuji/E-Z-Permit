"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { GuideStep } from "../lib/guides.ts";
import { MAX_DAYS, MIN_DAYS, parseDays, type CommunityStat } from "../lib/durations.ts";
import { summarizeProgress, toggleStep } from "../lib/progress.ts";
import { createClient } from "../lib/supabase/client.ts";
import { CommunityLine } from "./CommunityLine.tsx";
import { useSnackbar } from "./Snackbar.tsx";
import { StepDetails } from "./StepDetails.tsx";

type Props = {
  userId: string;
  guideId: string;
  cityKey: string;
  steps: GuideStep[];
  initialDone: string[];
  /** The signed-in user's own reports: step id -> days. */
  initialReports: Record<string, number>;
  community: Record<string, CommunityStat>;
};

export function TrackedChecklist({ userId, guideId, cityKey, steps, initialDone, initialReports, community }: Props) {
  const router = useRouter();
  const notify = useSnackbar();
  const supabase = useMemo(() => createClient(), []);
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone));
  const [reports, setReports] = useState(initialReports);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  // The step whose "how many days?" box is open.
  const [asking, setAsking] = useState<string | null>(null);

  const progress = summarizeProgress(done, steps.map((s) => s.id));

  async function toggle(stepId: string) {
    if (!supabase || busy.has(stepId)) return;
    const wasDone = done.has(stepId);
    setDone(toggleStep(done, stepId));
    setBusy((b) => new Set(b).add(stepId));

    const { error } = wasDone
      ? await supabase.from("user_progress").delete().match({ user_id: userId, checklist_id: guideId, step_id: stepId })
      : await supabase
          .from("user_progress")
          .upsert({ user_id: userId, checklist_id: guideId, step_id: stepId }, { onConflict: "user_id,checklist_id,step_id", ignoreDuplicates: true });

    setBusy((b) => {
      const next = new Set(b);
      next.delete(stepId);
      return next;
    });
    if (error) {
      setDone((d) => {
        const undo = new Set(d);
        if (wasDone) undo.add(stepId);
        else undo.delete(stepId);
        return undo;
      });
      notify("We couldn't save that. Check your connection and try again.", "error");
    } else if (!wasDone) {
      setAsking(stepId);
    } else if (asking === stepId) {
      setAsking(null);
    }
  }

  async function saveReport(stepId: string, days: number) {
    if (!supabase) return false;
    const { error } = await supabase
      .from("step_duration_reports")
      .upsert(
        { user_id: userId, city: cityKey, step_id: stepId, days, updated_at: new Date().toISOString() },
        { onConflict: "user_id,city,step_id" },
      );
    if (error) {
      notify("We couldn't save your report. Try again.", "error");
      return false;
    }
    setReports((r) => ({ ...r, [stepId]: days }));
    setAsking(null);
    notify("Thanks! Your report helps the next founder.", "success");
    // Re-read the server-rendered community numbers.
    router.refresh();
    return true;
  }

  return (
    <div>
      <div className="stat" role="group" aria-label="Your progress">
        <div className="stat-label">Your progress</div>
        <div className="stat-value" data-testid="progress-label">
          {progress.label}
        </div>
        <div className="bar" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <span style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <ol className="steps mt-6">
        {steps.map((step, i) => {
          const isDone = done.has(step.id);
          const inputId = `step-${step.id}`;
          return (
            <li key={step.id} className={`step${isDone ? " done" : ""}`}>
              <div className="step-check">
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <input
                  type="checkbox"
                  id={inputId}
                  checked={isDone}
                  disabled={busy.has(step.id)}
                  onChange={() => toggle(step.id)}
                  aria-label={`Mark step ${i + 1} done`}
                />
              </div>
              <div>
                <h3>
                  <label htmlFor={inputId}>{step.title}</label>
                </h3>
                <div className="step-meta">
                  <span className={`level level-${step.level}`}>{step.level}</span>
                  <span>{step.agency}</span>
                </div>
              </div>
              <StepDetails step={step}>
                <CommunityLine stat={community[step.id]} />
                {isDone && asking === step.id && (
                  <DurationPrompt initial={reports[step.id]} onSave={(days) => saveReport(step.id, days)} onSkip={() => setAsking(null)} />
                )}
                {isDone && asking !== step.id && reports[step.id] !== undefined && (
                  <p className="community">
                    You reported {reports[step.id]} day{reports[step.id] === 1 ? "" : "s"}.{" "}
                    <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-navy underline" onClick={() => setAsking(step.id)}>
                      Edit
                    </button>
                  </p>
                )}
              </StepDetails>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DurationPrompt({ initial, onSave, onSkip }: { initial: number | undefined; onSave: (days: number) => Promise<boolean>; onSkip: () => void }) {
  const [value, setValue] = useState(initial === undefined ? "" : String(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseDays(value);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    const ok = await onSave(parsed.days);
    if (!ok) setSaving(false);
  }

  return (
    <form onSubmit={submit} noValidate className="fact grid gap-2" aria-label="How long did this take?">
      <label htmlFor="days-input" className="text-sm font-semibold text-ink">
        How many days did this take? <span className="font-normal text-ink-3">(optional)</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="days-input"
          type="number"
          inputMode="numeric"
          min={MIN_DAYS}
          max={MAX_DAYS}
          step={1}
          autoFocus
          className="w-28 rounded-[10px] border border-rule bg-paper px-3 py-2 outline-none focus:border-navy"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? "days-error" : undefined}
        />
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn-ghost" type="button" onClick={onSkip}>
          Skip
        </button>
      </div>
      {error && (
        <span id="days-error" className="text-sm text-stamp" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
