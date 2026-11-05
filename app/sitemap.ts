import type { MetadataRoute } from "next";
import { listGuideRefs } from "../lib/guides.ts";
import { SEED_COMPILED } from "../lib/seed/cities.ts";
import { SITE_URL } from "../lib/site.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  // Guide fees and steps are compiled by hand, so "last modified" is when the data was last reviewed.
  const lastModified = new Date(`${SEED_COMPILED} 1`);
  const guides = listGuideRefs().map((g) => ({
    url: `${SITE_URL}/permits/${g.state}/${g.city}/${g.business}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/permits`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "yearly", priority: 0.3 },
    ...guides,
  ];
}
