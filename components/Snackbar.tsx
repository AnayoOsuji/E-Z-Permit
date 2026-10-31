"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// App-wide notification snackbars. Wrap the app in <SnackbarProvider> and call useSnackbar().notify(...)
// instead of rendering ad-hoc error text or using window.alert.
// On phones they sit at the top so they never cover the form's submit button; on larger screens, bottom right.

export type SnackbarKind = "error" | "success" | "info";
type Item = { id: number; kind: SnackbarKind; message: string };

type Notify = (message: string, kind?: SnackbarKind) => void;
const SnackbarContext = createContext<Notify>(() => {});

/** Show a snackbar: `const notify = useSnackbar(); notify("Saved", "success")`. */
export const useSnackbar = () => useContext(SnackbarContext);

const DURATION_MS: Record<SnackbarKind, number> = { error: 8000, info: 6000, success: 5000 };
const MAX_VISIBLE = 3;

const STYLE: Record<SnackbarKind, { bar: string; icon: string }> = {
  error: { bar: "border-stamp", icon: "!" },
  success: { bar: "border-ok", icon: "✓" },
  info: { bar: "border-navy", icon: "i" },
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((i) => i.id !== id)), []);

  const notify = useCallback<Notify>((message, kind = "info") => {
    setItems((all) => {
      // The same message twice in a row would only stack up; keep one.
      const rest = all.filter((i) => !(i.message === message && i.kind === kind));
      return [...rest, { id: nextId.current++, kind, message }].slice(-MAX_VISIBLE);
    });
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-0 top-0 z-[60] grid content-start justify-items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:top-auto sm:bottom-0 sm:content-end sm:justify-items-end sm:px-6 sm:pb-6 sm:pt-0"
        data-testid="snackbar-region"
      >
        {items.map((item) => (
          <SnackbarItem key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

function SnackbarItem({ item, onDismiss }: { item: Item; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const { bar, icon } = STYLE[item.kind];

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id), DURATION_MS[item.kind]);
    return () => clearTimeout(timer);
  }, [paused, item.id, item.kind, onDismiss]);

  return (
    <div
      role={item.kind === "error" ? "alert" : "status"}
      data-testid="snackbar"
      data-kind={item.kind}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`snackbar pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[12px] border border-rule border-l-4 ${bar} bg-card px-4 py-3 text-sm text-ink shadow-xl`}
    >
      <span aria-hidden="true" className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
        {icon}
      </span>
      <p className="m-0 min-w-0 flex-1 break-words">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="-m-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-lg leading-none text-ink-3 hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
