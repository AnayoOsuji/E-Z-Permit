"use client";

import { useEffect, useRef } from "react";

export const ANALYSIS_STAGES = [
  "Locating city, county and state agencies",
  "Classifying your business type",
  "Matching required permits and licenses",
  "Estimating fees and processing times",
  "Ordering your checklist",
];

type Props = {
  place: string;
  businessType: string;
  /** Index of the stage in progress; ANALYSIS_STAGES.length means every stage is done. */
  stage: number;
  statusLine: string | null;
  onCancel: () => void;
};

const bar = "rounded bg-rule motion-safe:animate-pulse";

export function AnalysisOverlay({ place, businessType, stage, statusLine, onCancel }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = stage >= ANALYSIS_STAGES.length;

  // Lock page scroll behind the overlay, move focus into it, and let Escape cancel.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-title"
      aria-busy={!done}
      data-testid="analysis-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-paper/95 backdrop-blur-sm"
    >
      <div className="mx-auto grid min-h-full max-w-5xl content-center gap-8 px-5 py-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
        <div>
          <p className="eyebrow">Analyzing</p>
          <h2 id="analysis-title" ref={headingRef} tabIndex={-1} className="mt-1 text-3xl leading-tight outline-none">
            Building your permit roadmap
          </h2>
          <p className="mt-2 text-ink-2">
            <strong className="text-ink">{businessType}</strong> in <strong className="text-ink">{place}</strong>
          </p>

          <div
            className="mt-6 h-1.5 overflow-hidden rounded-full bg-paper-2"
            role="progressbar"
            aria-label="Analysis progress"
            aria-valuemin={0}
            aria-valuemax={ANALYSIS_STAGES.length}
            aria-valuenow={Math.min(stage, ANALYSIS_STAGES.length)}
          >
            <div
              className="h-full rounded-full bg-stamp transition-[width] duration-700 ease-out"
              style={{ width: `${(Math.min(stage + 0.5, ANALYSIS_STAGES.length) / ANALYSIS_STAGES.length) * 100}%` }}
            />
          </div>

          <ol className="m-0 mt-5 grid list-none gap-3 p-0" aria-live="polite">
            {ANALYSIS_STAGES.map((label, i) => {
              const state = i < stage ? "done" : i === stage ? "active" : "pending";
              return (
                <li
                  key={label}
                  data-state={state}
                  className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                    state === "pending" ? "text-ink-3" : state === "active" ? "font-semibold text-ink" : "text-ok"
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center" aria-hidden="true">
                    {state === "done" ? (
                      <span className="font-bold">✓</span>
                    ) : state === "active" ? (
                      <span className="spinner" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-rule" />
                    )}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>

          <p className="mt-5 min-h-6 text-sm text-ink-3" data-testid="analysis-status">
            {statusLine ?? " "}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost mt-2 transition-colors duration-200"
          >
            Cancel
          </button>
        </div>

        {/* Placeholder cards shaped like the checklist that is about to appear. */}
        <div className="grid content-start gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[14px] border border-rule bg-card p-5 shadow-sm"
              style={{ opacity: 1 - i * 0.2 }}
            >
              <div className="flex items-center gap-4">
                <div className={`${bar} h-8 w-8 shrink-0 rounded-full`} style={{ animationDelay: `${i * 150}ms` }} />
                <div className="grid flex-1 gap-2">
                  <div className={`${bar} h-4 w-2/3`} style={{ animationDelay: `${i * 150}ms` }} />
                  <div className={`${bar} h-3 w-1/3`} style={{ animationDelay: `${i * 150}ms` }} />
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <div className={`${bar} h-3 w-full`} />
                <div className={`${bar} h-3 w-5/6`} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className={`${bar} h-10`} />
                <div className={`${bar} h-10`} />
                <div className={`${bar} h-10`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
