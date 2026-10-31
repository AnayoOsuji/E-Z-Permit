"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "./Snackbar.tsx";

// Starts Paystack checkout for the premium unlock: asks /api/checkout for a payment link, then sends the
// buyer to Paystack. Whether they have paid is confirmed by the server (webhook / verify), never by this button.
export function UnlockButton({ roadmapId }: { roadmapId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const notify = useSnackbar();

  async function unlock() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId }),
      });
      const data = (await res.json().catch(() => null)) as { url?: unknown; error?: string } | null;
      if (res.ok && typeof data?.url === "string") {
        window.location.assign(data.url);
        return; // leaving the page: keep the button busy
      }
      if (res.status === 409) router.refresh(); // already premium: reload to show the full guide
      notify(data?.error ?? "Checkout isn't available just yet. Please try again soon.", "error");
    } catch {
      notify("We couldn't reach checkout. Check your connection and try again.", "error");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={unlock}
        disabled={busy}
        className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-0 bg-ink px-6 py-3 font-bold text-paper shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-stamp hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp active:translate-y-0 active:scale-[0.98] disabled:cursor-progress disabled:opacity-70 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {busy ? "Opening checkout…" : "Unlock now"}
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">
          →
        </span>
      </button>
    </div>
  );
}
