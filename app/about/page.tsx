import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — E-Z Permit" };

export default function AboutPage() {
  return (
    <main className="wrap py-12">
      <p className="eyebrow">About</p>
      <h1 className="mt-1 max-w-[18ch] text-4xl leading-tight">Opening a business shouldn&rsquo;t start with a scavenger hunt.</h1>
      <div className="mt-6 grid max-w-[62ch] gap-4 text-lg text-ink-2">
        <p className="m-0">
          Every US city splits licensing across federal, state, county and city agencies, each with its own forms, fees
          and order of operations. Founders lose weeks working out which permit comes first.
        </p>
        <p className="m-0">
          E-Z Permit turns your city and a one-line description of your business into an ordered checklist: what to file,
          who issues it, what it costs and a link to the official page.
        </p>
        <p className="m-0 text-base text-ink-3">
          E-Z Permit is a planning aid, not legal advice. Always confirm requirements with the issuing agency.
        </p>
      </div>
    </main>
  );
}
