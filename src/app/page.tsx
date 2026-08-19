import Link from "next/link";
import {
  Calendar,
  RefreshCw,
  Link2,
  Shield,
  Layers,
  Bot,
  ArrowRight,
  Check,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Calendar className="h-4 w-4" />
          </div>
          OpenCal
        </div>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <a href="#features" className="hover:text-slate-900">
            Features
          </a>
          <a href="#included" className="hover:text-slate-900">
            What&apos;s included
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open app
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          Open source · MIT · Self-hostable
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Sync your calendars.
          <span className="text-indigo-600"> Avoid double-booking.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          OpenCal is open-source multi-calendar tooling: multi-way sync with
          privacy controls, scheduling links, a unified calendar view, ICS
          sharing, and an MCP server for AI assistants.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section id="features" className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: RefreshCw,
              title: "Real-time calendar sync",
              body: "One-way or multi-way sync across Google, Outlook, and iCloud. Clones never re-clone — loop-safe by design.",
            },
            {
              icon: Shield,
              title: "Privacy-first clones",
              body: "Rewrite titles to “Busy”, strip descriptions, locations, attendees, and conference data. Mark private. Exclude by color or RSVP.",
            },
            {
              icon: Link2,
              title: "Scheduling links",
              body: "One-on-one and collective (team) booking pages with buffers, notice periods, custom questions, approvals, and branding.",
            },
            {
              icon: Calendar,
              title: "Unified calendar view",
              body: "Week view across all accounts. Create, edit, delete, join meetings, toggle calendars, hide sync clones.",
            },
            {
              icon: Layers,
              title: "ICS calendar sharing",
              body: "Share busy-only or full-detail feeds compatible with Google, Outlook, and Apple Calendar.",
            },
            {
              icon: Bot,
              title: "MCP server",
              body: "Expose list/create/update/delete events and availability to Claude, ChatGPT, and other MCP clients.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="included" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Everything included</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          Free, self-hosted, and MIT licensed — no seat limits.
        </p>
        <div className="mx-auto mt-10 grid max-w-2xl gap-3">
          {[
            "Google, Outlook, and iCloud calendars",
            "One-way and multi-way calendar sync",
            "Privacy field controls for cloned events",
            "Scheduling links (one-on-one and collective)",
            "Unified calendar interface",
            "ICS / calendar sharing feeds",
            "MCP server for AI assistants",
            "Team availability (anonymized busy blocks)",
            "Self-host with no per-seat fees",
          ].map((label) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              {label}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-900 px-6 py-16 text-center text-white">
        <h2 className="text-2xl font-bold">Run it yourself in minutes</h2>
        <pre className="mx-auto mt-6 max-w-xl overflow-x-auto rounded-xl bg-black/40 p-4 text-left text-sm text-slate-200">
{`cd opencal
npm install
npx prisma migrate dev
npm run seed
npm run dev`}
        </pre>
        <Link
          href="/register"
          className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Create your account
        </Link>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-slate-500">
        <span>OpenCal — open-source multi-calendar platform</span>
        <span>MIT License</span>
      </footer>
    </div>
  );
}
