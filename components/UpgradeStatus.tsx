"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FIRST_CHECK_MS = 300;
const POLL_MS = 2000;
const MAX_TRIES = 10;

// Shown when the buyer comes back from Paystack before their account is marked premium. It asks the server
// to confirm the payment with Paystack (the webhook may also do it first), then reloads the page.
export function UpgradePending({ reference }: { reference: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const [outcome, setOutcome] = useState<"waiting" | "failed" | "mismatch">("waiting");

  useEffect(() => {
    if (outcome !== "waiting" || tries >= MAX_TRIES) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const data = (await res.json().catch(() => null)) as { premium?: boolean; status?: string } | null;
        if (cancelled) return;
        if (res.ok && data?.premium) {
          router.refresh();
          return;
        }
        if (res.ok && data?.status === "failed") return setOutcome("failed");
        if (res.status === 403) return setOutcome("mismatch");
      } catch {
        // Network hiccup: try again on the next tick.
      }
      if (!cancelled) setTries((t) => t + 1);
    }, tries === 0 ? FIRST_CHECK_MS : POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tries, outcome, reference, router]);

  const stuck = outcome === "waiting" && tries >= MAX_TRIES;
  return (
    <div className="mt-6 flex items-start gap-3 rounded-[12px] border border-rule bg-paper-2 px-4 py-3 text-sm text-ink-2" role="status" data-testid="upgrade-pending">
      {outcome === "waiting" && !stuck && <span className="spinner mt-0.5 shrink-0" aria-hidden="true" />}
      <span>
        {outcome === "failed" ? (
          <>
            <strong className="text-ink">That payment wasn&rsquo;t completed.</strong> You haven&rsquo;t been charged for premium. Use Unlock now to try again.
          </>
        ) : outcome === "mismatch" ? (
          <>
            <strong className="text-ink">We couldn&rsquo;t match that payment to your account.</strong> If you were charged, contact support with your payment reference.
          </>
        ) : stuck ? (
          <>
            <strong className="text-ink">Your payment is still being confirmed.</strong> This can take a minute. Refresh the page shortly and your complete guide will appear.
          </>
        ) : (
          <>
            <strong className="text-ink">Thanks! Confirming your payment…</strong> Your complete guide will unlock in a moment.
          </>
        )}
      </span>
    </div>
  );
}

export function UpgradeSuccess() {
  return (
    <div className="mt-6 rounded-[12px] border-l-[3px] border-ok bg-ok-soft px-4 py-3 text-sm" role="status" data-testid="upgrade-success">
      <strong>You&rsquo;re premium.</strong> Here&rsquo;s your complete local permit guide.
    </div>
  );
}
