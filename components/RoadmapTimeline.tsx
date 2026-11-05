import { UNLOCK_MESSAGE, type DisplayStep } from "../lib/roadmap-view.ts";
import { UnlockButton } from "./UnlockButton.tsx";

const DIFFICULTY_STYLE = {
  Low: "bg-ok-soft text-ok",
  Medium: "bg-[color-mix(in_srgb,var(--county)_18%,transparent)] text-[color:var(--county)]",
  High: "bg-stamp-soft text-stamp",
} as const;

function StepItem({ step }: { step: DisplayStep }) {
  return (
    <li className="relative" data-testid="roadmap-step" data-locked={step.locked}>
      <span
        className="absolute -left-12 top-5 grid h-8 w-8 place-items-center sm:-left-[3.4rem] sm:h-9 sm:w-9 rounded-full border-2 border-stamp bg-paper font-serif text-base font-bold text-stamp"
        aria-hidden="true"
      >
        {step.step_number}
      </span>
      <article className="rounded-[14px] border border-rule bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h3 className="min-w-0 break-words text-lg leading-snug sm:text-xl">
            <span className="sr-only">Step {step.step_number}: </span>
            {step.title}
          </h3>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${DIFFICULTY_STYLE[step.difficulty]}`}>{step.difficulty} difficulty</span>
        </div>
        <p className="mb-0 mt-3 text-ink-2">{step.description}</p>
        <dl className="m-0 mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[10px] bg-paper px-3.5 py-2.5">
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-3">Department</dt>
            <dd className="m-0 mt-0.5 font-semibold">{step.department}</dd>
          </div>
          <div className="rounded-[10px] bg-paper px-3.5 py-2.5">
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-3">Estimated cost</dt>
            <dd className="m-0 mt-0.5 font-semibold tabular-nums">{step.estimated_cost}</dd>
          </div>
        </dl>
        {!step.locked && step.links && step.links.length > 0 && (
          <div className="mt-4" data-testid="step-links">
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-ink-3">Helpful links</p>
            <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
              {step.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold">
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </li>
  );
}

const listClass = "relative m-0 ml-3 grid list-none gap-6 border-l-2 border-rule p-0 pl-8 sm:ml-4 sm:pl-9";

export function RoadmapTimeline({ steps, isPremium, roadmapId }: { steps: DisplayStep[]; isPremium: boolean; roadmapId?: string }) {
  const open = steps.filter((s) => !s.locked);
  const locked = steps.filter((s) => s.locked);

  return (
    <div data-testid="roadmap-timeline">
      <ol className={listClass} aria-label="Permit steps">
        {open.map((step) => (
          <StepItem key={step.step_number} step={step} />
        ))}
      </ol>

      {locked.length > 0 && (
        <div className="relative mt-6 min-h-[28rem]" data-testid="locked-section">
          {/* Placeholder text only: the real steps never leave the server. Blurred and inert so it can't be read or used. */}
          <ol
            className={`${listClass} select-none blur-sm pointer-events-none`}
            data-testid="locked-steps"
            aria-hidden="true"
            inert
          >
            {locked.map((step) => (
              <StepItem key={step.step_number} step={step} />
            ))}
          </ol>

          <div className="absolute inset-0 flex justify-center px-2 pt-6">
            <aside
              className="sticky top-4 h-fit w-full max-w-md rounded-[18px] border border-rule bg-card p-5 sm:top-24 sm:p-6 text-center shadow-xl"
              aria-labelledby="unlock-title"
              data-testid="upgrade-card"
            >
              <span
                className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stamp-soft text-xl text-stamp"
                aria-hidden="true"
              >
                🔒
              </span>
              <p className="eyebrow mt-4">
                {locked.length} more step{locked.length === 1 ? "" : "s"} locked
              </p>
              <h2 id="unlock-title" className="mt-1 text-2xl leading-snug">
                {UNLOCK_MESSAGE}
              </h2>
              <p className="mb-5 mt-2 text-sm text-ink-2">See every permit, cost and department for your business, plus what to do next at each step.</p>
              <UnlockButton roadmapId={roadmapId} />
            </aside>
          </div>
        </div>
      )}

      {isPremium && (
        <p className="mt-6 text-center text-sm text-ink-3" data-testid="premium-note">
          Premium: you&rsquo;re seeing the complete guide.
        </p>
      )}
    </div>
  );
}
