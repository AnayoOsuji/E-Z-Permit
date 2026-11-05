"use client";

import { useState } from "react";
import { savePath } from "../lib/save-link.ts";
import { MagicLinkForm } from "./MagicLinkForm.tsx";
import { useUser } from "./useUser.ts";

/** "Save my progress": signed-in people save with one click; everyone else gets a magic link by email. */
export function SaveProgress({ guideId }: { guideId: string }) {
  const user = useUser();
  const [open, setOpen] = useState(false);

  if (user) {
    // A plain link, not <Link>, so prefetching never saves anything.
    return (
      <a className="btn inline-block no-underline" href={savePath(guideId)}>
        Save to my roadmaps
      </a>
    );
  }

  return (
    <div className="no-print grid gap-3">
      <div>
        <button type="button" className="btn" disabled={user === undefined} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Save my progress
        </button>
      </div>
      {open && (
        <div className="max-w-md rounded-[14px] border border-rule bg-card p-4 shadow-sm">
          <p className="m-0 mb-3 text-sm text-ink-2">
            No password needed. We&rsquo;ll email you a link that saves this checklist so you can tick off steps and come back later.
          </p>
          <MagicLinkForm guideId={guideId} showConsent submitLabel="Email me a link" />
        </div>
      )}
    </div>
  );
}
