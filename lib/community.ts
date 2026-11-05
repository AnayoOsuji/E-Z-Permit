import type { SupabaseClient } from "@supabase/supabase-js";
import { statsByStep, type CommunityStat } from "./durations.ts";

/** Median days and report count per step for a city, only for steps with enough reports. Empty if the lookup fails. */
export async function fetchCommunityStats(client: SupabaseClient | null, cityKey: string): Promise<Record<string, CommunityStat>> {
  if (!client) return {};
  try {
    const { data, error } = await client.rpc("step_duration_stats", { p_city: cityKey });
    return error ? {} : statsByStep(data);
  } catch {
    return {};
  }
}
