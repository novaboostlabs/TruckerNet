# TruckerNet — Project Plan & Work Log

> **Purpose of this file:** This is the single source of truth for the app's
> master plan, the build order, current status, and a running log of work done.
> If we move to a new chat, read this file first to pick up exactly where we
> left off.
>
> **How to use it:** Every time we complete a meaningful piece of work, add an
> entry to the **Work Log** at the bottom (newest first) and update the
> **Build Order Status** table. Keep statuses honest: ✅ done, ◐ partial,
> ✗ not started.

_Last updated: 2026-06-19 — PRD/North Star wired into AGENTS.md_

---

## 0. North Star & PRD (read first — frames every decision)

**The full product vision is the canonical [`PRD.md`](./PRD.md) (TruckerNet PRD
v2.0).** It is also wired into [`AGENTS.md`](./AGENTS.md) so it loads into context
at the start of every session. Read the PRD before making any product, design, or
engineering decision. (Kept as a single source in `PRD.md` to avoid two diverging
copies — this file links it rather than duplicating it.)

**Non-negotiables:**
- **North Star: $50,000 MRR. This is NOT a hobby app.** TruckerNet is a premium,
  subscription-first SaaS built to compete in the same playing field as **Calm,
  Elevate, and YNAB** — best-in-class tools people pay for every month because the
  value is undeniable. Every decision is held to that bar: polish, reliability, and
  a real payoff for the driver.
- **The core feature is "True Net Pay Per Load"** — what a load actually pays after
  every real cost, and whether it clears break-even. Everything else serves this.
- **Quick Eval** is the daily hook; unlimited on free (the primary free→paid
  converter).
- **Fair-market rates: never scrape load boards.** Seeded → opt-in crowdsourced
  (Waze model) → paid API later.
- **IFTA auto-reporting** is a flagship differentiator; always show the
  "estimate, not a tax-filing service" disclaimer.
- **Stack:** Expo + TypeScript, Supabase backend, RevenueCat for payments (never
  Stripe for in-app mobile subs). Dark-mode, numbers-forward design; diesel-amber
  `#E8A020` accent.

MRR ladder: $1K → $5K → $10K → $25K → **$50K** (≈1,200 mixed-tier paying accounts,
just 0.34% of ~350K U.S. owner-operators). Targets: 12–15% free→paid, 85%+ monthly
retention. Pricing: Free / Driver Pro $34.99·mo / Fleet $89.99·mo / Enterprise
$229.99·mo. Full detail in `PRD.md` §2, §27.

---

## 1. Vision

TruckerNet turns a set of individual screens into a **guided, synergistic flow**
that gives owner-operators a real payoff: knowing their true break-even rate and
whether any given load actually makes them money. Built by a former
owner-operator — that authenticity is the #1 asset.

Everything connects:
- Onboarding establishes **monthly expenses + miles → break-even rate (per mile)**.
- **Fuel entries** (with odometer) feed real fuel cost-per-mile and MPG.
- **Loads** capture route, per-state mileage (IFTA), load type (fair-market
  comparison), and live net pay.
- The **Dashboard** reflects all of it live; **IFTA** auto-aggregates from
  loads + fuel; **History** shows real profit per load.

---

## 2. Master Plan — Flows

### Language Selection (built first — affects everything)
- 4 languages from day one: 🇺🇸 English (default), 🇲🇽 Spanish, 🇮🇳 Punjabi
  (Gurmukhi script, custom font), 🇨🇳 Chinese (Simplified, custom font).
- Picker appears on first launch, before sign-in/sign-up. Changeable later in
  Settings.

### Flow 1 — Onboarding
- **Screen 0 — Language** (before sign-up).
- **Screen 1 — Fuel cost:** "How much do you spend on fuel per week?" Single
  dollar input, converted to monthly internally. Live monthly equivalent shown.
- **Screen 2 — Expenses (redesigned):** Pre-labeled rows for the mandatory
  expenses every trucker has (truck/finance payment, insurance, parking,
  maintenance, ELD, load board), each with amount + tap-to-cycle frequency
  (daily → weekly → biweekly → monthly → quarterly → semiannual → annual).
  Below that, a dynamic **"Other"** section: completed custom entries stack up
  as a list while a fresh labeled input row always waits below. Every expense is
  converted to a monthly equivalent for the CPM calculation.
- **Screen 3 — Weekly miles:** Converted to monthly (× 4.333).
- **Screen 4 — Break-even reveal (payoff):** Large green per-mile number with
  the formula explained: `(fuel + fixed costs) ÷ monthly miles = $X.XX/mi`.
  "Accept loads that pay more than this to make a profit." Button: "Start
  Tracking →".

### Flow 2 — Check Load (formerly "Quick Eval")
- Inputs: load pay ($), pickup (city+state OR full address), delivery, load
  type, **backhaul toggle**.
- → OSRM calculates miles automatically.
- **Backhaul logic:** reframes a below-break-even load as "saves you $X in
  deadhead vs driving empty — net you come out $X ahead."
- **P&L context banner:** "You're +$2,840 net this week — you can absorb a
  below-break-even backhaul."

### Flow 3 — Add Load
- Location: city+state (fast) OR full address (accurate). **Strongly encourage
  full address.** Address → geocode via OpenStreetMap Nominatim (free, no key)
  → OSRM exact miles → Turf.js splits miles by state (for IFTA).
- **Load types with fair-market rate** (premium vs dry van baseline): reefer,
  flatbed, step deck, intermodal, tanker, hazmat, RGN/lowboy, auto transport,
  power only.
- **Fair market shows TOTAL load value, not just per-mile:**
  e.g. "Your load LA → Phoenix = $1,200 / Fair market ~$1,400." CPM math is
  backend-only. Fair-market data will eventually be calibrated by anonymized
  **user reports**.
- Backhaul toggle here too. **Load status:** Upcoming / In Progress (→ Dashboard
  "active load" card) / Completed / Cancelled.

### Flow 4 — Fuel Entry
- Dollars spent, gallons, state fueled (IFTA), **current odometer reading**.
- App auto-shows miles since last fill-up using stored odometer
  ("Last recorded: 487,234 mi — 658 miles since last fill-up").
- Calculates MPG, cost per mile, price per gallon. Receipt photo → OCR
  auto-fills (later phase).

### Flow 5 — Dashboard
- **Active Load card** when a load is In Progress (route, time logged, miles,
  [Mark Complete] / [View Details]). "Mark Complete" opens the load for final
  details.
- **P&L context banner:** "You're up $2,840 this week" (green) /
  "You're down $440 this week" (red).
- Break-even rate, fuel CPM, fixed CPM, week/month net & gross, recent loads,
  Check Load button.

### Flow 6 — IFTA
- Auto-aggregated from loads (per-state mileage) + fuel (gallons per state),
  editable.
- Export formats: CSV (accountants), PDF (formatted report), share sheet.

---

## 3. Build Order & Status

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | i18n infrastructure + language picker | ✅ Done | `lib/i18n.ts`, 4 translation files, `LanguagePickerScreen.tsx`, custom fonts loaded in `App.tsx` |
| 2 | Expense schema redesign (labeled + frequency) | ✅ Done | `user_expenses` table; `toMonthlyAmount` / `FREQUENCY_TO_MONTHLY` in `utils/marketRates.ts` |
| 3 | Onboarding flow (4 screens) | ✅ Done | Fuel, Expenses, Miles, Result. Expenses screen redesigned (essentials + dynamic Other) — see Work Log 2026-06-19 |
| 4 | Fuel Entry form with odometer | ✅ Done | `FuelEntryScreen.tsx` (OCR receipt scan = later phase) |
| 5 | Live Dashboard (real DB data) | ◐ Partial | UI built but still on `DEMO` placeholder data — **not wired to DB yet** |
| 6 | Check Load modal with backhaul | ✗ Not started | i18n keys (`checkLoad.*`) exist; **no screen file** |
| 7 | Add Load screen (OSRM + Turf.js) | ✗ Not started | i18n keys (`addLoad.*`) exist; **no screen, no OSRM/Turf/Nominatim installed** |
| 8 | History from real DB | ◐ Partial | `HistoryScreen.tsx` exists; verify it reads real loads |
| 9 | IFTA from real DB + exports | ◐ Partial | `IFTAScreen.tsx` UI exists, **not wired**; no CSV/PDF/share exports |

### Fair Market Rate Engine
✅ Built — `utils/marketRates.ts`: 10 load types × 6 distance bands, returns
total $ range + per-mile + verdict (strong/fair/low/very_low). User-report
calibration = future.

---

## 4. Current State (verified against code, 2026-06-19)

**Done & working:**
- 4-language i18n, language picker, custom fonts.
- Auth (email + Google/Apple OAuth, guest/skip mode).
- Onboarding: all 4 screens, with the redesigned expenses screen.
- Fuel entry with odometer + live MPG/CPM.
- Fair market rate engine.
- SQLite schema: `settings`, `user_expenses`, `fuel_entries`, `loads`,
  `state_mileage` (+ legacy `fixed_expenses`).

**Built UI but NOT wired to the database:**
- **Dashboard** — uses a hardcoded `DEMO` object. Needs real queries:
  break-even (`calcBreakEven`), week/month net & gross from `loads`, recent
  loads, active-load card.
- **IFTA** — static UI, no aggregation from `loads`/`fuel_entries`.

**Not started:**
- **Check Load** screen/modal (Flow 2).
- **Add Load** screen (Flow 3) + routing stack (OSRM, Nominatim, Turf.js).
  There is currently **no entry point to add a load** in the tab navigator.
- IFTA exports (CSV/PDF/share).
- Receipt OCR.

---

## 5. Next Steps (recommended order)

The documented build order lists Dashboard (#5) before Add Load (#7), but a live
Dashboard has nothing real to show until loads can be created. Recommended path:

1. **Add Load screen (Flow 3)** — the core missing flow. Install OSRM/Nominatim
   helpers + Turf.js, build the form (address-first), compute miles + per-state
   breakdown, net pay live, fair-market total, save to `loads` + `state_mileage`.
   Add an entry point (e.g. a center "+" action) in the navigator.
2. **Wire the Dashboard (Flow 5)** to real DB data — replace `DEMO` with live
   break-even, week/month P&L, recent loads, active-load card.
3. **Check Load modal (Flow 2)** with backhaul + P&L context banner.
4. **History (Flow 8)** from real `loads`.
5. **IFTA (Flow 9)** aggregation + CSV/PDF/share exports.
6. Later phases: receipt OCR, push notifications, paywall, analytics.

> Open question to confirm before starting Add Load: routing provider details
> (public OSRM demo server vs. self-hosted) and how aggressively to require full
> addresses vs. allow city+state fallback.

---

## 6. Work Log (newest first)

### 2026-06-19 — Onboarding expenses: dropdown, icons, Maintenance, no truncation
- Per user request on the expenses screen: (1) no truncated labels — each
  essential label sits on its own full-width row with an icon + clarifying
  subtitle; (2) **frequency is now a real dropdown** (bottom-sheet modal),
  replacing tap-to-cycle; (3) added a **Maintenance** essential
  ("Tires, oil changes, repairs"); (4) roomier spacing so nothing is cut off.
- Essentials now: Truck/Finance, Insurance, Maintenance, ELD Device, Load Board,
  Truck Parking — each with icon + i18n subtitle.
- Added i18n `fixedLabels`, `fixedSubtitles`, `selectFrequency` across
  en/es/pa/zh.
- Fixed a focus bug: amount/frequency row is rendered via a plain helper
  function (not a nested `<Component/>`) so inputs don't remount per keystroke.
- **Note / open item:** the screenshot the user shared does NOT match any
  committed version in this repo (different single-row layout, per-row icons,
  "ELD Device"/"Load Board" labels, no Maintenance). Confirmed our accent IS
  green (`#00C896` = `Colors.primary`; amber `#E8A020` is `secondary`). That
  build appears to come from outside this repo/branch — need to confirm where
  the user's device build is sourced so changes here actually land.

### 2026-06-19 — Wired the PRD/North Star into always-loaded context
- Confirmed the full **PRD v2.0** already lives canonically in `PRD.md`
  (32 sections, $50K MRR North Star). Did not duplicate it.
- Added a **Product North Star** directive to `AGENTS.md` (auto-injected every
  session via `CLAUDE.md → @AGENTS.md`) pointing to `PRD.md` and stating the
  non-negotiables: $50K MRR, premium tier like Calm/Elevate/YNAB (not a hobby
  app), True Net Pay core, Quick Eval hook, no load-board scraping, IFTA
  disclaimer, stack + design rules.
- Added **Section 0 — North Star & PRD** to this file surfacing the same
  non-negotiables and linking the canonical PRD.

### 2026-06-19 — Onboarding expenses screen redesigned
- Branch: `claude/truckernet-project-files-khoqlv` (commit `7a9afad`).
- Replaced the single freeform expense list + suggestion chips with two groups:
  - **The essentials:** pre-labeled fixed rows (truck/finance payment,
    insurance, parking, maintenance, ELD, load board) — amount + cycle-able
    frequency; blank rows skipped on save.
  - **Other expenses:** completed entries stack as a list; a fresh labeled input
    row always waits below; commit via add button or keyboard "done"; a typed
    but unadded draft is still captured on Next.
- Running monthly total reflects essentials + added others + in-progress draft.
- Saved rows now store their real `category` instead of a flat literal.
- Added i18n keys across en/es/pa/zh (`fixedSection`, `fixedHint`,
  `otherSection`, `otherHint`, `otherPlaceholder`, `addOther`,
  `financePayment`) and refreshed the subtitle.
- Files: `src/screens/onboarding/OnboardingExpensesScreen.tsx`,
  `src/translations/{en,es,pa,zh}.json`.

### (Earlier, prior sessions) — Foundation
- i18n infrastructure + 4-language support + custom fonts.
- Auth: email + Google/Apple OAuth + guest/skip mode; fixed auth loop and
  skip-button navigation; replaced AsyncStorage with SecureStore + SQLite.
- Onboarding flow (4 screens) + break-even reveal.
- Fuel entry form with odometer.
- Fair market rate engine (`utils/marketRates.ts`).
- Database expanded: `settings`, `user_expenses`, odometer/MPG on fuel,
  backhaul/status/full-address fields on loads.
- Design system v2 visual overhaul.
