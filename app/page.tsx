"use client";

import { useEffect, useRef, useState } from "react";
import { ChecklistView } from "../components/ChecklistView.tsx";
import type { ChecklistResult, StreamEvent } from "../lib/checklist.ts";
import { MAJOR_CITIES, parsePlace, placeFromSentence } from "../lib/places.ts";
import { useSnackbar } from "../components/Snackbar.tsx";

const EXAMPLES = [
  { place: "Austin, TX", text: "Starting a coffee cart" },
  { place: "Los Angeles, CA", text: "Selling cakes and cookies I bake at home" },
  { place: "Chicago, IL", text: "Opening a hair salon in my home" },
  { place: "Seattle, WA", text: "Launching a taco food truck" },
];

type Mode = "live" | "seed";

export default function Home() {
  const notify = useSnackbar();
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("seed");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [checklistHidden, setChecklistHidden] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/checklist")
      .then((r) => r.json())
      .then((d: { liveAvailable: boolean }) => {
        // Stay on the free built-in database by default; AI research is opt-in.
        setLiveAvailable(d.liveAvailable);
      })
      .catch(() => {});
  }, []);

  // "Starting a coffee cart in Austin, Texas" fills the city field for you.
  const onDescriptionChange = (value: string) => {
    setDescription(value);
    if (!place.trim()) {
      const found = placeFromSentence(value);
      if (found) setPlace(`${found.city}, ${found.state}`);
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePlace(place);
    if (!parsed) {
      notify('Enter your city as "City, ST" — for example "Austin, TX".', "error");
      return;
    }
    if (description.trim().length < 3) {
      notify("Describe the business you want to start.", "error");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setChecklist(null);
    setChecklistHidden(false);
    setLog([]);

    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, description, mode }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "status") setLog((l) => [...l, event.message]);
          else if (event.type === "error") notify(event.message, "error");
          else if (event.type === "result") {
            setChecklist(event.checklist);
            requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) notify(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }

  const cancel = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return (
    <main className="wrap">
      <section className="hero">
        <h1>
          Open your business, <em>not</em> a maze of paperwork.
        </h1>
        <p className="lede">
          Tell us your city and what you&rsquo;re starting. We&rsquo;ll lay out every permit and license you need—in the
          order to get them—with estimated costs and links to the official forms.
        </p>

        <form className="form-card" onSubmit={submit}>
          <div className="row">
            <div className="field">
              <label htmlFor="place">Your city</label>
              <input
                id="place"
                className="input"
                list="cities"
                placeholder="Austin, TX"
                autoComplete="address-level2"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
              <datalist id="cities">
                {MAJOR_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <span className="hint">Any US city — use “City, ST”.</span>
            </div>
            <div className="field">
              <label>Research mode</label>
              <div className="mode" role="group" aria-label="Research mode">
                <button
                  type="button"
                  aria-pressed={mode === "live"}
                  disabled={!liveAvailable}
                  title={liveAvailable ? undefined : "Add OPENROUTER_API_KEY on the server to enable"}
                  onClick={() => setMode("live")}
                >
                  AI research (free)
                </button>
                <button type="button" aria-pressed={mode === "seed"} onClick={() => setMode("seed")}>
                  Built-in database
                </button>
              </div>
              <span className="hint">
                {mode === "live"
                  ? "A free AI model drafts your checklist from what it knows (no web search, no links). Takes up to a minute."
                  : "Instant. Detailed for Austin, Houston, NYC, LA, Chicago, Seattle and Denver; general guide elsewhere."}
              </span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="desc">What are you starting?</label>
            <textarea
              id="desc"
              className="textarea"
              placeholder="Starting a coffee cart in Austin, Texas"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              maxLength={500}
            />
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.text}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setPlace(ex.place);
                    setDescription(ex.text);
                  }}
                >
                  {ex.text} · {ex.place}
                </button>
              ))}
            </div>
          </div>

          <div className="actions">
            <span className="hint" style={{ color: "var(--ink-3)", fontSize: "0.82rem" }}>
              A planning aid, not legal advice.
            </span>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Building your checklist…" : "Build my checklist →"}
            </button>
          </div>
        </form>
      </section>

      {loading && (
        <section className="progress no-print" aria-live="polite">
          <h2>
            <span className="spinner" aria-hidden="true" /> {mode === "live" ? "Drafting with AI" : "Building your checklist"}
          </h2>
          {log.length > 0 && (
            <ol>
              {log.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>
          )}
          <div style={{ marginTop: 14 }}>
            <button className="btn-ghost" onClick={cancel}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <div ref={resultRef}>
        {checklist && (
          <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              className="btn-ghost"
              aria-expanded={!checklistHidden}
              onClick={() => setChecklistHidden((h) => !h)}
            >
              {checklistHidden ? "Show my checklist" : "Hide my checklist"}
            </button>
          </div>
        )}
        {checklist && !checklistHidden && <ChecklistView checklist={checklist} />}
      </div>
    </main>
  );
}
