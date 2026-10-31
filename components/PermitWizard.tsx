"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestRoadmap } from "../lib/roadmap-client.ts";
import {
  BUSINESS_EXAMPLES,
  LAST_STEP,
  STATE_OPTIONS,
  WIZARD_STEPS,
  firstInvalidStep,
  validateStep,
  type FieldErrors,
  type WizardValues,
} from "../lib/wizard.ts";
import { STATES } from "../lib/places.ts";
import { EMPTY_VALUES, draftKey, parseDraft, serializeDraft } from "../lib/wizard-storage.ts";
import { ANALYSIS_STAGES, AnalysisOverlay } from "./AnalysisOverlay.tsx";
import { useSnackbar } from "./Snackbar.tsx";

const MS_PER_STAGE = 900;
// Seeded answers return instantly; hold the overlay long enough to read each stage.
const MIN_ANALYSIS_MS = ANALYSIS_STAGES.length * MS_PER_STAGE;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const field =
  "w-full rounded-[10px] border bg-paper px-3.5 py-3 outline-none transition-shadow duration-200 focus:border-navy focus:ring-3 focus:ring-navy/20";
const fieldBorder = (invalid: boolean) => (invalid ? "border-stamp" : "border-rule");

type Phase = "form" | "analyzing";

export function PermitWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const notify = useSnackbar();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(EMPTY_VALUES);
  // False until the saved draft (if any) has been read, so the empty form never overwrites it.
  const [restored, setRestored] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [stage, setStage] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const set = (key: keyof WizardValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Bring back the draft after a refresh. Read in an effect (not during render) so server and client HTML match.
  useEffect(() => {
    try {
      const draft = parseDraft(localStorage.getItem(draftKey(userId)));
      if (draft) {
        setValues(draft.values);
        setStep(draft.step);
      }
    } catch {
      // Storage unavailable (private window, blocked): start fresh.
    }
    setRestored(true);
  }, [userId]);

  useEffect(() => {
    if (!restored) return;
    try {
      const key = draftKey(userId);
      if (values.city || values.state || values.businessType) localStorage.setItem(key, serializeDraft({ step, values }));
      else localStorage.removeItem(key);
    } catch {
      // The draft just won't survive a refresh.
    }
  }, [restored, userId, step, values]);

  // Advance the visible stages on a timer; the last one waits for the real result.
  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, ANALYSIS_STAGES.length - 1)), MS_PER_STAGE);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const goTo = (target: number) => setStep(target);

  const next = () => {
    const found = validateStep(step, values);
    setErrors(found);
    if (Object.keys(found).length === 0) goTo(step + 1);
  };

  async function analyze() {
    const invalid = firstInvalidStep(values);
    if (invalid) {
      setErrors(invalid.errors);
      goTo(invalid.step);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStage(0);
    setPhase("analyzing");

    const startedAt = Date.now();
    try {
      const saved = await requestRoadmap(
        { city: values.city.trim(), state: values.state, business_type: values.businessType.trim() },
        controller.signal,
      );
      await sleep(Math.max(0, MIN_ANALYSIS_MS - (Date.now() - startedAt)));
      if (controller.signal.aborted) return;
      setStage(ANALYSIS_STAGES.length);
      await sleep(500);
      if (controller.signal.aborted) return;
      // The roadmap is saved, so the draft is done with. The overlay stays up while the roadmap page loads.
      try {
        localStorage.removeItem(draftKey(userId));
      } catch {
        // Nothing to clean up.
      }
      router.push(`/dashboard/roadmaps/${saved.id}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      notify(err instanceof Error ? err.message : "Something went wrong. Please try again.", "error");
      setPhase("form");
    }
  }

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("form");
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < LAST_STEP) next();
    else void analyze();
  }

  const place = `${values.city.trim()}, ${values.state}`;

  return (
    <>
      <form
        onSubmit={onSubmit}
        noValidate
        data-testid="permit-wizard"
        className="rounded-[14px] border border-rule bg-card p-4 shadow-sm sm:p-8"
      >
        <ol className="m-0 mb-8 flex list-none items-center p-0" aria-label="Progress">
          {WIZARD_STEPS.map((label, i) => (
            <li key={label} className={`flex items-center ${i < LAST_STEP ? "flex-1" : ""}`} aria-current={i === step ? "step" : undefined}>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-colors duration-300 ${
                  i < step
                    ? "border-ok bg-ok text-paper"
                    : i === step
                      ? "border-stamp text-stamp"
                      : "border-rule text-ink-3"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`ml-2 hidden text-sm font-semibold sm:inline ${i === step ? "text-ink" : "text-ink-3"}`}>{label}</span>
              {i < LAST_STEP && (
                <span className="mx-2 h-0.5 flex-1 sm:mx-3 overflow-hidden rounded bg-rule" aria-hidden="true">
                  <span className={`block h-full bg-ok transition-all duration-500 ${i < step ? "w-full" : "w-0"}`} />
                </span>
              )}
            </li>
          ))}
        </ol>

        <div key={step} className="wizard-step grid gap-5">
          {step === 0 && (
            <>
              <div>
                <h2 className="text-xl sm:text-2xl">Where will you operate?</h2>
                <p className="mt-1 text-ink-2">Permits are issued locally, so we start with your city.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
                <div className="grid gap-1.5">
                  <label htmlFor="wiz-city" className="text-sm font-semibold">
                    City
                  </label>
                  <input
                    id="wiz-city"
                    autoFocus
                    autoComplete="address-level2"
                    placeholder="Austin"
                    className={`${field} ${fieldBorder(!!errors.city)}`}
                    value={values.city}
                    onChange={(e) => set("city", e.target.value)}
                    aria-invalid={!!errors.city}
                    aria-describedby={errors.city ? "wiz-city-error" : undefined}
                  />
                  {errors.city && (
                    <span id="wiz-city-error" role="alert" className="text-sm text-stamp">
                      {errors.city}
                    </span>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="wiz-state" className="text-sm font-semibold">
                    State
                  </label>
                  <div className="relative">
                    <select
                      id="wiz-state"
                      autoComplete="address-level1"
                      className={`${field} ${fieldBorder(!!errors.state)} cursor-pointer appearance-none pr-10 ${values.state ? "" : "text-ink-3"}`}
                      value={values.state}
                      onChange={(e) => set("state", e.target.value)}
                      aria-invalid={!!errors.state}
                      aria-describedby={errors.state ? "wiz-state-error" : undefined}
                    >
                      <option value="" disabled>
                        Select a state
                      </option>
                      {STATE_OPTIONS.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-ink-3" aria-hidden="true">
                      ▾
                    </span>
                  </div>
                  {errors.state && (
                    <span id="wiz-state-error" role="alert" className="text-sm text-stamp">
                      {errors.state}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl sm:text-2xl">What are you starting?</h2>
                <p className="mt-1 text-ink-2">A few words is enough. The type of business decides which licenses apply.</p>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="wiz-business" className="text-sm font-semibold">
                  Business type
                </label>
                <input
                  id="wiz-business"
                  autoFocus
                  placeholder="Food Truck, Home Bakery…"
                  maxLength={100}
                  className={`${field} ${fieldBorder(!!errors.businessType)}`}
                  value={values.businessType}
                  onChange={(e) => set("businessType", e.target.value)}
                  aria-invalid={!!errors.businessType}
                  aria-describedby={errors.businessType ? "wiz-business-error" : undefined}
                />
                {errors.businessType && (
                  <span id="wiz-business-error" role="alert" className="text-sm text-stamp">
                    {errors.businessType}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Examples">
                {BUSINESS_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => set("businessType", example)}
                    className="cursor-pointer rounded-full border border-dashed border-rule bg-transparent px-3.5 py-2 text-sm text-ink-2 transition-colors duration-200 hover:border-stamp hover:text-stamp"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl sm:text-2xl">Check your answers</h2>
                <p className="mt-1 text-ink-2">We&rsquo;ll build a checklist for this business.</p>
              </div>
              <dl className="m-0 grid divide-y divide-rule rounded-[10px] border border-rule bg-paper">
                {[
                  { label: "City", value: values.city.trim(), target: 0 },
                  { label: "State", value: STATES[values.state], target: 0 },
                  { label: "Business type", value: values.businessType.trim(), target: 1 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ink-3">{row.label}</dt>
                      <dd className="m-0 font-semibold">{row.value}</dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => goTo(row.target)}
                      className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-navy underline hover:text-stamp"
                    >
                      Edit<span className="sr-only"> {row.label}</span>
                    </button>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:gap-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="cursor-pointer rounded-[10px] border border-rule bg-transparent px-4 py-3 font-semibold text-ink min-h-11 transition-colors duration-200 hover:border-ink"
            >
              Back
            </button>
          ) : (
            <span className="text-sm text-ink-3">A planning aid, not legal advice.</span>
          )}
          <button
            type="submit"
            className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-0 bg-ink px-6 py-3 font-bold text-paper shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-stamp hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {step < LAST_STEP ? "Continue" : "Build my checklist"}
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">
              →
            </span>
          </button>
        </div>
      </form>

      {phase === "analyzing" && (
        <AnalysisOverlay place={place} businessType={values.businessType.trim()} stage={stage} statusLine={null} onCancel={cancel} />
      )}
    </>
  );
}
