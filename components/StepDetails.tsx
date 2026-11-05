import type { ReactNode } from "react";
import type { Step } from "../lib/checklist.ts";
import { costRange } from "../lib/format.ts";

/** The body of a checklist step: what it is, cost, timeline, forms and official links. `children` goes at the end (community numbers, report prompts). */
export function StepDetails({ step, children }: { step: Step; children?: ReactNode }) {
  return (
    <div className="step-body">
      <p>{step.description}</p>
      <div className="facts">
        <div className="fact">
          <strong>Estimated cost</strong>
          <span className="money">{costRange(step.costMin, step.costMax)}</span>
          {step.costNote && <div>{step.costNote}</div>}
        </div>
        <div className="fact">
          <strong>Timeline</strong>
          {step.timeline}
        </div>
      </div>
      {step.forms.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Forms to file
          </div>
          <ul className="forms">
            {step.forms.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {step.links.length > 0 && (
        <div className="links">
          {step.links.map((l, i) => (
            <a key={i} className="link-pill" href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
