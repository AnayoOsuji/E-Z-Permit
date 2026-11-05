"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "../../lib/supabase/server.ts";

/** Turns reminder emails on or off for the signed-in user, recording when they agreed. */
export async function setReminderConsent(formData: FormData) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return;

  const optedIn = formData.get("opted_in") === "1";
  const now = new Date().toISOString();
  await supabase
    .from("email_consents")
    .upsert({ user_id: user.id, opted_in: optedIn, consented_at: optedIn ? now : null, updated_at: now }, { onConflict: "user_id" });
  revalidatePath("/my-roadmaps");
}
