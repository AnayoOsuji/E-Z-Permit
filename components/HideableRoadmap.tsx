"use client";

import { useState, type ReactNode } from "react";

// Wraps the roadmap timeline (rendered on the server) with a Hide / Show button.
export function HideableRoadmap({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <div>
      <div className="no-print flex justify-end">
        <button type="button" className="btn-ghost" aria-expanded={!hidden} onClick={() => setHidden((h) => !h)}>
          {hidden ? "Show my checklist" : "Hide my checklist"}
        </button>
      </div>
      {!hidden && <div className="mt-6">{children}</div>}
    </div>
  );
}
