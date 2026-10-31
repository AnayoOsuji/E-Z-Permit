import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works — E-Z Permit" };

const STEPS = [
  {
    title: "Tell us where and what",
    body: "Enter your city as “City, ST” and describe your business in a sentence, such as “a taco food truck” or “a home bakery”.",
  },
  {
    title: "We research the rules",
    body: "Live research searches official city, county and state sites. The built-in database answers instantly for seven major cities and gives a general guide everywhere else.",
  },
  {
    title: "Get an ordered checklist",
    body: "Each step lists the issuing agency, estimated cost, typical processing time, required forms and official links, in the order you should file them.",
  },
  {
    title: "Track your progress",
    body: "Tick off steps as you finish them. Create an account to keep your roadmaps in one place.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="wrap py-12">
      <p className="eyebrow">How it works</p>
      <h1 className="mt-1 text-4xl leading-tight">From idea to opening day in four steps</h1>
      <ol className="mt-8 grid list-none gap-4 p-0">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[auto_1fr] gap-x-4 rounded-[14px] border border-rule bg-card p-5 shadow-sm">
            <span className="font-serif text-2xl font-bold text-stamp">{i + 1}</span>
            <div>
              <h2 className="text-xl">{s.title}</h2>
              <p className="mb-0 mt-1 text-ink-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/" className="btn mt-8 inline-block no-underline hover:text-paper">
        Build my checklist →
      </Link>
    </main>
  );
}
