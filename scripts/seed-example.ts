// Seeds the "Food Truck in Austin, TX" example with community duration reports, so the
// "Community average" lines show up on /permits/tx/austin/food-truck and in a tracked checklist.
//
//   npm run seed:example             add (or refresh) the demo reports
//   npm run seed:example -- --remove delete the demo users and everything they reported
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, and the progress/reports
// migration already run. The demo accounts use made-up example.com addresses and random passwords.
import { randomUUID } from "node:crypto";
import { buildGuide, parseTimeline } from "../lib/guides.ts";
import { createAdminClient } from "../lib/supabase/admin.ts";

const GUIDE = ["tx", "austin", "food-truck"] as const;
const DEMO_USERS = [1, 2, 3, 4].map((n) => `demo.reporter${n}@example.com`);
// Each demo user reports this share of the step's typical time, so the numbers differ a little.
const SPREAD = [0.6, 0.9, 1.1, 1.5];
// The last step only gets two reports, to show that a number stays hidden below three.
const REPORTERS_PER_STEP = (index: number, total: number) => (index === total - 1 ? 2 : index % 2 ? 3 : 4);

const admin = createAdminClient();
if (!admin) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, a Supabase anon key and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

async function findDemoUsers() {
  const found = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin!.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email && DEMO_USERS.includes(u.email)) found.set(u.email, u.id);
    if (data.users.length < 200) return found;
  }
}

const existing = await findDemoUsers();

if (process.argv.includes("--remove")) {
  for (const id of existing.values()) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  console.log(`Removed ${existing.size} demo user(s) and their reports.`);
  process.exit(0);
}

const userIds: string[] = [];
for (const email of DEMO_USERS) {
  let id = existing.get(email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: randomUUID(), email_confirm: true });
    if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
    id = data.user.id;
  }
  userIds.push(id);
}

const guide = buildGuide(...GUIDE)!;
const rows = guide.steps.flatMap((step, i) => {
  const typical = parseTimeline(step.timeline);
  const mid = typical ? (typical.min + typical.max) / 2 : 7;
  return userIds.slice(0, REPORTERS_PER_STEP(i, guide.steps.length)).map((user_id, u) => ({
    user_id,
    city: guide.cityKey,
    step_id: step.id,
    days: Math.min(365, Math.max(0, Math.round(mid * SPREAD[u]))),
  }));
});

const { error } = await admin.from("step_duration_reports").upsert(rows, { onConflict: "user_id,city,step_id" });
if (error) throw error;
console.log(`Seeded ${rows.length} reports across ${guide.steps.length} steps for ${guide.heading}.`);
console.log(`Open /permits/${guide.id} to see the community numbers.`);
