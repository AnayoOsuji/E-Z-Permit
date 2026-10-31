import type { ChecklistResult, StreamEvent } from "./checklist.ts";

type Request = { city: string; state: string; description: string };

/** Calls /api/checklist and reads its NDJSON stream, resolving with the finished checklist. */
export async function fetchChecklist(
  request: Request,
  signal: AbortSignal,
  onStatus: (message: string) => void = () => {},
): Promise<ChecklistResult> {
  const res = await fetch("/api/checklist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, mode: "auto" }),
    signal,
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
      if (event.type === "status") onStatus(event.message);
      else if (event.type === "error") throw new Error(event.message);
      else return event.checklist;
    }
  }
  throw new Error("The connection closed before your checklist was ready. Please try again.");
}
