"use client";

import { useEffect, useState } from "react";
import { totalCost, type ChecklistResult, type Step } from "../lib/checklist.ts";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function costRange(min: number, max: number): string {
  if (max === 0) return "Free";
  if (min === max) return usd(min);
  return `${usd(min)} – ${usd(max)}`;
}

function storageKey(c: ChecklistResult) {
  return `ezpermit:done:${c.city}|${c.state}|${c.businessType}|${c.generatedAt}`;
}

export function ChecklistView({ checklist }: { checklist: ChecklistResult }) {
  const [done, setDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(checklist));
      setDone(new Set(saved ? (JSON.parse(saved) as number[]) : []));
    } catch {
      setDone(new Set());
    }
  }, [checklist]);

  const toggle = (i: number) => {
    const next = new Set(done);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDone(next);
    try {
      localStorage.setItem(storageKey(checklist), JSON.stringify([...next]));
    } catch {
      // Progress just won't persist.
    }
  };

  const total = totalCost(checklist.steps);
  const pct = checklist.steps.length ? Math.round((done.size / checklist.steps.length) * 100) : 0;

  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result-head">
        <div>
          <div className="eyebrow">
            {checklist.city}, {checklist.state} · {checklist.businessType}
          </div>
          <h2 id="result-title">Your permit roadmap</h2>
          <p className="summary">{checklist.summary}</p>
        </div>
        <div className="no-print" style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          {checklist.source === "live" ? (
            <span className="badge badge-live">● AI draft</span>
          ) : (
            <span className="badge badge-seed">Built-in database</span>
          )}
          <button className="btn-ghost" onClick={() => window.print()}>
            Print / save PDF
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Steps</div>
          <div className="stat-value">{checklist.steps.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Estimated government fees</div>
          <div className="stat-value">{costRange(total.min, total.max)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Your progress</div>
          <div className="stat-value">
            {done.size} / {checklist.steps.length}
          </div>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <ol className="steps">
        {checklist.steps.map((step, i) => (
          <StepCard key={i} index={i} step={step} done={done.has(i)} onToggle={() => toggle(i)} />
        ))}
      </ol>

      <div className="notes">
        {checklist.caveats.length > 0 && (
          <div className="note warn">
            <h3>Watch out for</h3>
            <ul>
              {checklist.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {checklist.sources.length > 0 && (
          <div className="note">
            <h3>Sources</h3>
            <ul>
              {checklist.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="disclaimer">
        E-Z Permit is a planning aid, not legal advice. Requirements and fees change often—confirm each step with
        the issuing agency before you pay or file. Generated {new Date(checklist.generatedAt).toLocaleDateString()}.
      </p>
    </section>
  );
}

function StepCard({ index, step, done, onToggle }: { index: number; step: Step; done: boolean; onToggle: () => void }) {
  const id = `step-${index}`;
  return (
    <li className={`step${done ? " done" : ""}`}>
      <div className="step-check">
        <span className="step-num">{String(index + 1).padStart(2, "0")}</span>
        <input type="checkbox" id={id} checked={done} onChange={onToggle} aria-label={`Mark step ${index + 1} done`} />
      </div>
      <div>
        <h3>
          <label htmlFor={id}>{step.title}</label>
        </h3>
        <div className="step-meta">
          <span className={`level level-${step.level}`}>{step.level}</span>
          <span>{step.agency}</span>
        </div>
      </div>
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
      </div>
    </li>
  );
}
