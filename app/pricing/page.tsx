import Link from "next/link";
import { Check } from "lucide-react";

const inclusions = [
  {
    title: "weekly texts only",
    copy: "one summary each week with balances, top categories, and what changed.",
  },
  {
    title: "unlimited accounts",
    copy: "connect every bank and card via plaid; households and side accounts included.",
  },
  {
    title: "balances + recent charges",
    copy: "ask for balances or a quick merchant lookup anytime, right in the thread.",
  },
  {
    title: "reply for breakdowns",
    copy: "ask for more on groceries, merchants, or trends - answers land right in the thread.",
  },
  {
    title: "categories that adapt",
    copy: "custom labels that learn how you spend, no spreadsheets to babysit.",
  },
  {
    title: "priority support",
    copy: "real help when you need it, not a maze of bots.",
  },
];

const moments = [
  {
    title: "weekly snapshot",
    copy: "top categories, biggest merchants, and how your balance shifted that week.",
  },
  {
    title: "ask and get answers",
    copy: "text back for balances or a category breakdown. replies stay in the same thread.",
  },
  {
    title: "always-on clarity",
    copy: "skip dashboards; you get the essentials in one weekly text and on-demand follow ups.",
  },
];

const faq = [
  {
    q: "is there a free trial?",
    a: "yes - 14 days. cancel anytime before it ends and you won't be charged.",
  },
  {
    q: "what happens after the trial?",
    a: "$12/month billed monthly. pause or cancel anytime; access continues through the period you paid for.",
  },
  {
    q: "which banks work?",
    a: "all major U.S. banks via plaid. if yours isn't available, we'll tell you before you're charged.",
  },
  {
    q: "how do i cancel?",
    a: "from settings or by replying STOP in the thread. no phone calls. no hidden hoops.",
  },
  {
    q: "is my data safe?",
    a: "built by microsoft security engineers. plaid handles bank authentication; everything is encrypted in transit and at rest.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold lowercase tracking-tight text-gray-900 hover:opacity-80">
            trilogy
          </Link>

          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href="/pricing" className="text-gray-900 lowercase">
              pricing
            </Link>
            <Link href="/signin" className="text-gray-600 lowercase hover:text-blue-600 transition-colors">
              sign in
            </Link>
            <a
              href="https://shorturl.at/KGbiL"
              className="hidden sm:inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-white lowercase font-semibold tracking-tight hover:bg-gray-800 transition-colors"
            >
              start trial
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="pt-16 sm:pt-24 pb-12 sm:pb-16 space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">pricing</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight lowercase">
              one simple plan. 14-day free trial.
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl">
              weekly money clarity over text. unlimited accounts, no setup drag, cancel anytime.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 lowercase">
                built by microsoft security engineers
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 lowercase">
                plaid for bank auth
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 lowercase">
                vercel + neon infrastructure
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://shorturl.at/KGbiL"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm sm:text-base font-semibold text-white lowercase tracking-tight hover:bg-blue-700 transition-colors"
            >
              start 14-day trial
            </a>
            <Link href="/signin" className="text-sm sm:text-base font-medium text-gray-700 lowercase hover:text-blue-600 transition-colors">
              sign in
            </Link>
            <span className="text-sm text-gray-500 lowercase">no hidden fees. cancel anytime.</span>
          </div>

          <div className="rounded-3xl border border-gray-200 shadow-sm bg-white">
            <div className="flex flex-col md:flex-row gap-10 p-8 sm:p-10">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium lowercase text-gray-700">
                  trilogy plan
                  <span className="text-gray-400">-</span>
                  all-in access
                </div>

                <p className="text-xl text-gray-800 leading-relaxed">
                  texts that keep you aware without another dashboard to check. we do the sorting; you see what
                  changed.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {inclusions.map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Check className="h-4 w-4" />
                      </span>
                      <div className="space-y-1">
                        <p className="font-semibold text-gray-900 lowercase">{item.title}</p>
                        <p className="text-sm text-gray-600">{item.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span className="rounded-full bg-gray-50 px-3 py-1">built by microsoft security engineers</span>
                  <span className="rounded-full bg-gray-50 px-3 py-1">plaid handles bank authentication</span>
                  <span className="rounded-full bg-gray-50 px-3 py-1">no contracts, cancel anytime</span>
                </div>
              </div>

              <div className="w-full md:w-72 space-y-4 rounded-2xl border border-gray-200/80 bg-gray-50 px-6 py-7">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 lowercase">14-day free trial</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-gray-500">cancel anytime</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-semibold tracking-tight">$12</span>
                  <span className="text-gray-600 text-base">/mo</span>
                </div>
                <p className="text-sm text-gray-600">
                  billed monthly after your trial. cancel whenever - no proration surprises.
                </p>
                <a
                  href="https://shorturl.at/KGbiL"
                  className="inline-flex w-full items-center justify-center rounded-full bg-gray-900 px-4 py-3 text-sm font-semibold text-white lowercase tracking-tight hover:bg-gray-800 transition-colors"
                >
                  start trial
                </a>
                <p className="text-xs text-gray-500">
                  already joined?{" "}
                  <Link href="/signin" className="underline decoration-gray-300 underline-offset-4 hover:text-blue-600">
                    sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 border-t border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight lowercase">what shows up in your texts</h2>
            <span className="hidden sm:block text-sm text-gray-500 lowercase">designed to feel calm, not busy</span>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {moments.map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.25)]">
                <p className="text-sm font-semibold text-gray-700 lowercase">{item.title}</p>
                <p className="mt-3 text-base text-gray-700 leading-relaxed">{item.copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              no templates - the copy reads like a person, not a bot.
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              skips bloaty charts; highlights the one or two moves that changed.
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              no daily pings by default; you get weekly unless you ask for more.
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">faq</p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight lowercase">the practical stuff</h2>
            </div>
            <span className="text-sm text-gray-500 lowercase">straight answers, no fine print</span>
          </div>

          <div className="divide-y divide-gray-200 border border-gray-200 rounded-2xl bg-white">
            {faq.map((item) => (
              <div key={item.q} className="p-6 sm:p-8 space-y-2">
                <p className="text-lg font-semibold text-gray-900 lowercase">{item.q}</p>
                <p className="text-base text-gray-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-gray-900 lowercase tracking-tight">trilogy</span>
            <span className="text-sm text-gray-400">finance, via text</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600 lowercase">
            <Link href="/pricing" className="hover:text-blue-600 transition-colors">
              pricing
            </Link>
            <Link href="/privacy" className="hover:text-blue-600 transition-colors">
              privacy
            </Link>
            <Link href="/signin" className="hover:text-blue-600 transition-colors">
              sign in
            </Link>
          </div>
          <p className="text-sm text-gray-400 lowercase">(c) 2025 trilogy</p>
        </div>
      </footer>
    </div>
  );
}
