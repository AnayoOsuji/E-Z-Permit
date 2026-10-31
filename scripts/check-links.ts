// Checks that every URL in the seeded database still resolves.
// Usage: npm run check-links
import { EIN_STEP, SEED_CITIES } from "../lib/seed/cities.ts";

const urls = new Set<string>(EIN_STEP.links.map((l) => l.url));
for (const city of SEED_CITIES) {
  city.sources.forEach((l) => urls.add(l.url));
  for (const steps of Object.values(city.steps)) steps?.forEach((s) => s.links.forEach((l) => urls.add(l.url)));
}

const UA = "Mozilla/5.0 (compatible; EZPermitLinkCheck/1.0)";
let failed = 0;
await Promise.all(
  [...urls].map(async (url) => {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      // Many .gov sites block bots with 403; treat only 404/410/5xx as broken.
      const broken = res.status === 404 || res.status === 410 || res.status >= 500;
      if (broken) failed++;
      console.log(`${broken ? "BROKEN" : "ok    "} ${res.status} ${url}`);
    } catch (err) {
      failed++;
      console.log(`ERROR  ${(err as Error).message} ${url}`);
    }
  }),
);
console.log(`\n${urls.size} URLs checked, ${failed} broken`);
process.exitCode = failed ? 1 : 0;
