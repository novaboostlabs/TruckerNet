# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

# Product North Star — READ BEFORE ANY DECISION

**The full product vision lives in [`PRD.md`](./PRD.md) (TruckerNet PRD v2.0). Read it
and keep it in mind for every product, design, and engineering decision.**

Non-negotiables that frame everything:

- **North Star: $50,000 MRR.** This is **not a hobby app.** TruckerNet is a premium,
  subscription-first SaaS meant to compete in the same playing field as **Calm,
  Elevate, and YNAB** — best-in-class tools people pay for month after month because
  the value is undeniable. Build to that bar: polish, reliability, and payoff.
- **The core is "True Net Pay Per Load"** — tell the driver exactly what a load pays
  after every real cost, and whether it clears their break-even rate. Every other
  feature serves this.
- **Quick Eval is the daily hook** and is unlimited even on free — it's the primary
  free→paid converter.
- **Fair-market rates: never scrape load boards** (DAT/Truckstop ToS). Seeded
  benchmarks → opt-in crowdsourced data (the Waze model) → paid API later.
- **IFTA auto-reporting** is a flagship differentiator; always show the
  "estimate, not a tax-filing service" disclaimer.
- **Mobile-first** (Expo + TypeScript, Supabase backend, RevenueCat for payments —
  never Stripe for in-app mobile subscriptions). Web companion is secondary.
- **Design:** dark-mode, premium, numbers-forward (feel of Linear/Wise/Stripe).
  Diesel-amber accent `#E8A020`. Numbers are the hero.

**Working state & next steps live in [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)** — read it
at the start of a session to see what's done and what's next, and log work into it as
you go.
