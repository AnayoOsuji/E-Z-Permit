/** Calls /api/generate-roadmap and resolves with the id of the saved roadmap. */
export async function requestRoadmap(
  body: { city: string; state: string; business_type: string },
  signal: AbortSignal,
): Promise<{ id: string }> {
  const res = await fetch("/api/generate-roadmap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => null)) as { id?: unknown; error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
  if (typeof data?.id !== "string") throw new Error("We couldn't open your roadmap. Please try again.");
  return { id: data.id };
}
