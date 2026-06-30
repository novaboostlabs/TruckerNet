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
>
> **⚙️ Branch workflow (IMPORTANT):** Development happens on
> `claude/truckernet-project-files-khoqlv`, but the user's Expo app builds from
> **`main`**. After each chunk of work, **fast-forward `main` to the feature
> branch and push `main`** so the user's build always reflects the latest.
> (Decided 2026-06-19 after changes weren't appearing because `main` was stale.)

_Last updated: 2026-06-29 — MASSIVE session. Full Freight Terminal aesthetic redesign (entire app, light+dark theme system), fair-market formula complete (#1–4), haptics, PostHog full funnel instrumentation, broker scorecard, re-engagement notifications (smart weekly + streak + idle), tax set-aside, value-based paywall conversion, standalone one-off expenses, personal nearby-lane history (50mi radius), category-aware expense aging, dynamic break-even (all 3 components), dashboard layout overhaul. RevenueCat live SDK key wired. All 8 Supabase migrations applied by user. See §6 Work Log below for full details._

> **Backend sync state:** Sync is **local-first** — SQLite is source of truth;
> push on save, pull on sign-in. All 3 slices wired: expenses + fuel + loads.
> All 3 Supabase migrations applied 2026-06-20. Schema is in sync.

---

## 0a. Long-Term Business Vision (2026-06-23)

**The $50K MRR North Star is step 1 of a much larger business.**
Full strategic detail in memory file `enterprise-strategy.md`. Key points:

**Tier roadmap:**
- **Driver Pro** ($34.99/mo) → $5–10M ARR — individual owner-operators. Building now.
- **Fleet** ($89.99–149.99/mo, 2–10 trucks) → $25–50M ARR. Adds fleet dashboard,
  combined IFTA, dispatcher view, per-driver break-even.
- **Enterprise** ($199–699/mo, 11–100+ trucks) → $50–100M ARR. Adds accounting
  exports, API access, role-based access, SLA, account manager.
- **Mega-carrier B2B** (custom annual $150–500K/yr per carrier) → $100M+ ARR.

**The real enterprise play — selling to C-suite at carriers like Schneider/Swift:**
This is NOT a driver app distributed through carriers. It is a pure B2B platform
sold to the CFO/VP of Operations. Three value props, each worth paying for alone:
1. **Fleet IFTA automation** — eliminates entire compliance teams, saves $30–50K/yr
2. **Competitive rate intelligence** — real driver-reported lane rates (not broker
   estimates), a data product no competitor can replicate, licensable to carriers
   and brokers. THE crowdsourced rate database is the long-term moat.
3. **Driver & lane profitability analytics** — per-driver, per-lane true net P&L;
   which drivers make money, which lanes are actually profitable, which brokers
   underpay. Impacts operational decisions worth tens of millions.

**Founder advantage:** Direct experience at Swift and Schneider. Authentic insight
into carrier operations that no tech competitor can fake.

**Sequencing:** Consumer product first → fleet case studies → mid-size carrier deals
→ mega-carrier data licensing. Each stage funds the next. Do NOT build enterprise
features before consumer is solid.

**Exit path:** Strategic acquisition by TMS provider (McLeod, Oracle Transportation)
or PE roll-up wanting the data asset, OR raise Series A at $3–5M ARR.

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

## 0.5 🚨 RELEASE BLOCKERS — do NOT ship the app without these

- [x] **Expenses tab redesign / unification.** ✅ RESOLVED 2026-06-19. The Settings
  "Expenses" tab now reads/writes `user_expenses` (the same table the break-even
  engine sums) using the onboarding UI pattern — essentials with frequency
  dropdowns + dynamic "Other" rows. Was previously writing to the dead
  `fixed_expenses` table, so editing expenses had NO effect on break-even; that bug
  is fixed. Monthly-miles field now persists via `weekly_miles` (the real source of
  truth) so it actually drives Fixed CPM. Note: legacy screen's Supabase sync to
  `fixed_expenses` was dropped to match onboarding (which is local-only); revisit
  when wiring full Supabase sync.

_(Add any other launch-gating items here as they come up.)_

---

## 0.6 📋 PHASE 1 BACKLOG — recorded, fix later (do NOT action yet)

User-reported items. Captured so nothing is forgotten; **explicitly deferred** —
do not start these until the user calls for them. Newest batch first.

### Added 2026-06-23

17. **Pre-onboarding: app walkthrough + driver profile setup.** Before the language
    picker (or immediately after it), new users should see: (a) a 3–4 screen
    illustrated walkthrough showing what TruckerNet does — "Know your true net pay,"
    "Auto-build your IFTA report," "See if a load is worth it before you accept it"
    — with a Skip option; then (b) a profile setup screen where the driver enters
    their name, equipment type (dry van, reefer, flatbed, etc.), truck number, home
    base city/state, and optionally their MC/DOT number. This data personalizes the
    app (e.g. "Welcome back, Carlos" on the Dashboard, pre-fills equipment type on
    Add Load) and makes the experience feel like a real professional tool, not a
    generic calculator. Profile data stored in SQLite + synced to Supabase `profiles`
    table. Walkthrough shown once on fresh install; profile editable in Settings.

11. **Load-attached expenses + net profit per load.** Drivers should be able to log
    an expense (e.g. a scale ticket, toll, lumper fee) and attach it directly to the
    load they're currently running. That expense reduces the net pay on that specific
    load, and ripples through to the "This Week" / "This Month" dashboard cards so
    gross vs. net is always accurate. Bonus: a calendar view of expenses by date for
    accounting purposes. Implementation: add `load_id` FK on a new `load_expenses`
    table (or reuse `user_expenses` with a nullable `load_id`), wire through to
    `net_pay` calculation in `saveLoad` and dashboard queries.

12. **Splash screen + app icon: use teal (#00C896), not amber.** The animated splash
    screen and any icon assets should use the primary teal green (`Colors.primary =
    #00C896`) as the accent, not amber (`Colors.secondary = #E8A020`). Amber is used
    sparingly in-app; the splash should lead with the brand's primary color. Also
    update the `expo-notifications` color in `app.json` (currently `#E8A020`).

13. **Paywall/funnel full screens.** The current "Upgrade to Pro to see…" triggers
    open `PaywallScreen` as a modal. Each trigger point (Fair Market in CheckLoad,
    Fair Market in AddLoad, IFTA tab, History past-periods, load limit) should have
    a tailored headline and value prop that speaks to what the driver just tried to
    do. Review `PaywallScreen.tsx` — the `reason` prop already tailors the subtitle,
    but the screen may need a stronger visual treatment to convert at $34.99/mo.
    Also ensure the paywall is shown correctly from all 5 trigger points.

14. **Blur state mileage in Add Load for free users.** The per-state mileage breakdown
    section in `AddLoadScreen` (IFTA data) is currently visible to all users. Free
    users should see the state rows blurred with an "Upgrade to Pro — auto state
    mileage for IFTA" overlay, matching the IFTA tab blur-teaser pattern. Pro users
    see it unblurred as today.

15. **Fuel fill-up notification reminder.** Add a local notification that fires daily
    at a time that makes sense for drivers (e.g. 8pm) reminding them to log their
    latest fuel fill-up if they haven't logged one today. Should only fire if the
    user hasn't already logged a fill-up that day (check last entry date). Controlled
    by the existing Notifications toggle in Settings.

16. **Add Load status default: change from "completed" to "upcoming".** When a driver
    opens Add Load, the status defaults to "completed" which makes no sense — they're
    in the process of adding a load they're about to run or are currently on. Change
    default to "upcoming" (or "in_progress" if they're actively on a load). Consider
    smart defaulting: if there's already an in-progress load, default to "completed"
    (they're probably logging a finished run); otherwise default to "upcoming".

1. ✅ **Per-session data congruency / one source of truth** — done 2026-06-26 (B4).
   Root cause was cross-account contamination on reconcile: a session ending via expiry
   (not explicit sign-out) left local data that could be pushed into a different account's
   empty cloud. Fixed with explicit `data_owner_id` ownership (`claimDataOwnership`) — the
   Uber/Partiful model. See Work Log 2026-06-26 "B4 fix".
2. ✅ **Auto per-state mileage on Add Load** — done 2026-06-20. Mapbox now returns
   full route geometry (`overview=full&geometries=geojson`). `src/lib/stateSplit.ts`
   converts `us-atlas/states-10m.json` TopoJSON → GeoJSON at startup (via
   `topojson-client`), then walks each route coordinate pair, bounding-box
   pre-filters to candidate states, runs `turf.booleanPointInPolygon` on the
   midpoint, and accumulates great-circle distance per state. State mileage rows
   in AddLoadScreen are auto-populated from the split; user can still edit them.
   Falls back to address-based 50/50 split if geometry is unavailable.
3. **Onboarding break-even reveal formula is wrong/incomplete.** The final
   onboarding page (break-even reveal) shows the calculation as if only fuel was
   used — it omits the other expenses (ELD, insurance, etc.). The shown formula must
   include all fixed expenses.
4. ✅ **Min/max bounds on all inputs** — done 2026-06-20. Caps enforced on every
   numeric field: fuel weekly $ (≤$5K), expenses (≤$50K), load pay (≤$100K), miles
   (≤15K), weight (≤80K lbs), gallons (≤500), odometer (≤2M). Fuel entry caps
   validated on save with descriptive alerts. Onboarding miles screen now requires
   a value — no more skip.
5. ✅ **Image processing** — done 2026-06-22. Fuel receipt OCR (Claude vision via
   Supabase Edge Function `ocr-fuel-receipt` — key stays server-side; auto-fills
   $/gallons/state, image discarded) + BOL photo attach (Supabase Storage bucket
   `bol-photos`, public URL on `loads.bol_photo_url`, shown in Load Detail with
   full-screen viewer). All Expo Go compatible. **USER must deploy:** the edge
   function + `ANTHROPIC_API_KEY` secret, and run the BOL migration — see
   `PHOTO_SETUP.md`.
6. ✅ **Onboarding back buttons + Settings screen** — done 2026-06-20.
   - Back buttons on screens 2/3/4 wired through RootNavigator.
   - Full Settings screen built (`src/screens/SettingsScreen.tsx`): profile card
     with avatar + account status, Break-Even section (Monthly Expenses → Expenses
     tab, Weekly Miles inline edit, Replay Setup), Language picker (4 options,
     inline), About (version), Sign Out (amber button), Delete Account (danger link).
   - Dashboard gear icon now opens Settings Modal (replaced the old Alert).
   - "Replay setup" removed from ExpensesScreen header (lives in Settings now).
7. ✅ **Fair-market price accuracy** — rebuilt 2026-06-22.
   Deep research done (Scale Funding, Nuvocargo, O Trucking, FreightWaves, driver
   forums, BTS/FRED public data). New formula-based model in `utils/marketRates.ts`:
   - **Minimum floors per equipment type** — core fix. Formula is now
     `max(floor, miles × per_mile_rate)`. 10-mile dry van floor = $500-$550
     regardless of per-mile math. Floor is binding under ~200 miles. Matches
     industry practice of flat "job pricing" for short hauls.
   - **Baseline updated** to $2.50/mi dry van (2026 national spot avg; was
     modeled too conservatively).
   - **7 distance bands** (was 6): added 'micro' (≤50mi, 1.85x mult) and 'local'
     (51-100mi, 1.58x); renamed bands to reflect research breakpoints. Under-100mi
     rates now 1.55-1.85x the standard rate per mile — not the flat ~$2.50 it was.
   - **Equipment multipliers** vs dry van baseline: reefer +20%, flatbed +18%,
     step deck +40%, hazmat +38%, RGN +80%, power only −15%, intermodal −12%.
   - **Seasonal index** applied automatically from current month: Oct peak (+20%),
     Jan trough (−18%). Quarterly updates to BASELINE_DRY_VAN from Scale Funding
     free rate page keep model current without any paid subscription.
   - **Verdict logic** fixed — compares total $ to range (not $/mi to $/mi) so
     floor-bound short haul loads are scored correctly.
   - **`floorApplied` field** added to result for optional UI annotation.
   - **Not yet implemented** (future enhancements): lane balance by origin market
     (headhaul/backhaul premium ±10-30%), user-submitted rate crowdsourcing.
8. **Demo data flashes on first view of each tab.** Sample data shows on the first
   render of each tab until a button is pressed, which then activates real data. The
   real/empty state should be correct on first paint.
9. ✅ **Translation accuracy across all languages** — done 2026-06-21.
   - Structural audit (script-based key diff vs `en.json`): es was missing 25 keys,
     pa 71, zh 37. All filled with natural (not literal) translations; all 4 langs
     now at 100% key parity (0 missing, 0 extra).
   - Root cause of "pages stayed in English": `LoadDetailScreen` used **zero** i18n
     and `SettingsScreen` only used i18n for the language switcher — both were fully
     hardcoded English. Added a `loadDetail` namespace + expanded `settings` across
     all 4 languages and wired both screens to `t()`. LoadDetail reuses
     `addLoad.loadTypes.*` / `addLoad.statuses.*`; Settings language list now shows
     each language's name in the active UI language via `language.<code>`.
   - **Date locale fixed (2026-06-21):** added `getDateLocale()` in `lib/i18n.ts`
     mapping en→en-US, es→es-MX, pa→pa-IN, zh→zh-CN. Replaced all 7
     `toLocaleDateString('en-US', …)` calls (History ×4, AddLoad, Fuel, LoadDetail)
     so month/weekday names render in the active language. **Number/money**
     formatting (`toLocaleString('en-US', …)`) deliberately left as en-US — USD
     amounts stay US-grouped app-wide. Note: Punjabi (pa-IN) month-name support
     depends on the JS engine (Hermes); falls back to en-US if unsupported.
10. ✅ **Dashboard period cards → History; richer History** — done 2026-06-21 (extended 2026-06-21).
    - "This Week" and "This Month" cards on Dashboard are now tappable — navigate
      to History tab with `{ filter: 'week' | 'month' }` param, pre-selecting the
      right filter and resetting to the current period.
    - History screen now has `< Jun 16 – Jun 22 >` / `< June 2026 >` period
      navigator (back/forward arrows) for Week and Month views — browse any past
      period. Forward arrow disabled when already on the current period.
    - Filter chips renamed to "Week" / "Month" / "All Time" (cleaner since you can
      now view any week/month, not just "this" one).
    - Section label shows period context: "3 LOADS · Jun 16 – Jun 22".
    - Empty state copy updates based on context (suggests using arrows if no loads).
    - New DB helpers: `getHistoryLoadsDateRange` + `getHistoryTotalsDateRange`.
    - **Weekly calendar** — `src/components/WeekCalendar.tsx`: horizontal 7-day
      strip (Mo–Su), same dot/count/selection/today-ring pattern as monthly.
      Tap a day → filter list + totals to that day; tap again or tap X to clear.
    - **Cross-view linking** — switching Week↔Month preserves the period:
      week of May 21 → tap Month = May 2026; May with Jun 7 selected → tap Week =
      week containing Jun 7; All Time → Week/Month resets to today.
      `changeFilter` no longer blindly resets `periodDate` to today.
    - **Monthly calendar** — `src/components/MonthCalendar.tsx`: 7-column grid,
      green dot on days with loads, count badge if >1, green circle on selected day,
      today outline ring. Tap day → filters list to that day + updates totals card.
      Tap again (or tap X) → deselect and show all month loads.
    - **Load Detail screen** — `src/screens/LoadDetailScreen.tsx`: opens as
      `pageSheet` Modal when tapping any load row. Shows route card, full P&L
      (gross/net/fuel/fixed/RPM/fair-market), load info (type, weight, BOL, broker,
      notes, backhaul), state mileage table, status + verdict badges.
    - **Load date field on Add Load** — `< Sat, Jun 21, 2026 >` navigator at the
      bottom of the form. Default = today; left arrow goes back one day (for
      backlogs); right arrow disabled on today. "Back to today" link appears when
      on a past date. `LoadInsert.date` field added; `saveLoad` uses it.

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
| 5 | Live Dashboard (real DB data) | ✅ Done | Break-even always real; P&L + recent loads from DB when loads exist, DEMO fallback when empty. Active load card shows when status = in_progress. Refreshes on AddLoad save. |
| 6 | Check Load modal with backhaul | ✅ Done | `CheckLoadScreen.tsx` opens from the Dashboard CTA; live verdict + net pay + rate/mi vs break-even + fair-market range + backhaul reframe. **Mapbox address autocomplete + auto-mileage wired** (see below). Pending: per-state mileage breakdown, and "Accept & Log" → Add Load |
| 7 | Add Load screen (Mapbox routing) | ✅ Done | `AddLoadScreen.tsx` — full form with Mapbox autocomplete + auto-mileage, state mileage breakdown (pre-filled from address states, user-editable), live net pay preview, load type + status dropdowns, backhaul toggle, optional details (weight/BOL/broker/notes). FAB on Dashboard opens it; "Accept & Log" in Check Load pre-fills and opens it. Saves to `loads` + `state_mileage`. Per-state auto-split via Turf.js deferred — current approach pre-fills pickup/delivery states and lets user adjust (good enough for MVP). |
| 8 | History from real DB | ✅ Done | Reads real loads filtered by week/month/all. Totals (gross/net/miles/avg RPM) computed from DB. DEMO fallback when no loads. Empty state shown when filter returns zero results. |
| 9 | IFTA from real DB + exports | ✅ Done | Aggregates `state_mileage` (from loads) + `fuel_entries` per quarter. Year nav (back/forward). Export CSV via native Share sheet. DEMO fallback when no loads. Empty state per quarter when real data exists but quarter is empty. |

### Fair Market Rate Engine
✅ Built — `utils/marketRates.ts`: 10 load types × 6 distance bands, returns
total $ range + per-mile + verdict (strong/fair/low/very_low). User-report
calibration = future.

---

## 4. Current State (verified against code, 2026-06-20)

**All core screens built and wired to real DB:**
- 4-language i18n, language picker, custom fonts.
- Auth: email + Google/Apple OAuth, guest/explore mode, sign-out (gear icon on Dashboard).
- Onboarding: 4 screens (fuel estimate, expenses, miles, break-even reveal).
  Expenses screen: essentials (truck, insurance, maintenance, ELD, load board, parking)
  with per-row frequency dropdowns + dynamic "Other" rows.
- Fuel entry with odometer + live MPG/CPM. FuelScreen reads real DB (CPM hero, monthly
  stats, trend chart, history list). Refreshes on save + tab focus.
- Add Load: full form — Mapbox autocomplete, auto-mileage, state mileage breakdown
  (pre-filled from addresses, user-editable), live net pay, load type/status dropdowns,
  backhaul toggle, optional details. FAB + Check Load "Accept & Log" both open it.
- Check Load: Mapbox autocomplete, auto-mileage, load type dropdown, backhaul toggle,
  verdict, fair-market range. Pre-fills Add Load on "Accept & Log."
- Dashboard: real break-even, week/month P&L, recent loads, active-load card.
  Gear icon → sign-out. Refreshes on load save.
- History: real loads, week/month/all filters, totals card. Refreshes on tab focus.
- IFTA: aggregates state_mileage + fuel_entries per quarter. Year nav. CSV export.
  Refreshes on tab focus.
- Expenses (Settings tab): reads/writes `user_expenses` (same table as break-even
  engine). Frequency dropdowns, "Other" rows, monthly miles, live Fixed CPM hero.

**Data / session model:**
- Guest (explore without account): clean slate on every cold start. No data persists
  across restarts. Tapping "Explore without account" always wipes DB first.
- Real account: data persists, syncs to Supabase (local-first). Sign-out clears local
  data; sign-in pulls cloud data back.
- `has_real_account` flag protects real-account data if session temporarily expires
  (offline, token expiry) — data is preserved and user is sent to sign-in to re-auth.

**Backend sync (local-first, all 3 slices done):**
- Expenses + weekly miles + weekly fuel cost → `user_expenses` + `profiles`
- Fuel entries → `fuel_entries`
- Loads + state mileage → `loads` + `state_mileage`
- Push on every save, pull + reconcile on sign-in, clear on sign-out.
- **All 3 migrations applied** to Supabase 2026-06-20. Files in `supabase/migrations/`.

**Provider / config notes:**
- **Mapbox** — geocoding + routing (REST, Expo Go safe). `EXPO_PUBLIC_MAPBOX_TOKEN`
  (pk. token) in `.env`. Public tokens include Directions by default.
- **Supabase** — auth + cloud sync. `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- SecureStore uses `AFTER_FIRST_UNLOCK` so background token refresh doesn't error.

**Known bugs / deferred (§0.6 backlog):** 10 items documented. Highlights:
- Break-even formula display on result screen shows `—` for FIXED/MO (monthlyFixed
  never set — UI bug, not backend).
- "See All" on Dashboard does nothing (should navigate to History tab).
- Onboarding has no back buttons.
- Settings gear button on Dashboard now opens sign-out — full settings screen is Phase 2.
- Fair-market price model is rough (flat CPM-based). Needs richer model.
- Auto per-state mileage split (Turf.js) deferred — user edits manually for now.
- Translation completeness: some pages in English when non-English language selected.

---

## 5. Next Steps (Phase 1 remaining bugs → then Phase 2)

**Active bug list (working through in order):**
1. ✅ SecureStore / auto-refresh error — fixed (AFTER_FIRST_UNLOCK + try-catch)
2. ✅ History/IFTA data not showing on first tab visit — fixed (useFocusEffect)
3. ✅ Break-even formula display — fixed (`monthlyFixed` wired; `weekly_fuel_cost` now
   synced to Supabase `profiles.weekly_fuel_cost`; formula shows all components).
4. ✅ "See All" on Dashboard → navigates to History tab (fixed in prior session).
5. ✅ **Fuel tab — rolling CPM + state picker + refresh** — fixed 2026-06-20:
   - `getLatestFuelCPM()` already used weighted rolling avg of last 10 fill-ups.
   - `getFuelStats()` now returns `rollingCount` + uses rolling avg for hero (was
     showing single fill-up CPM; now shows `SUM($)/SUM(miles)` over last 10).
   - FuelScreen hero subtitle updated: "Avg of your last N fill-ups · Updated {date}".
   - State picker replaced: chip grid → scrollable bottom-sheet Modal with full
     state names (e.g. "Texas / TX"), matching the load-type dropdown pattern.
   - Refresh on save already wired via `onSaved → refresh()` in FuelScreen.

**🔧 USER ACTION ITEMS — do these outside the app:**
- [ ] **Add DNS subdomain:** in novaboostlabs.co DNS settings, create a CNAME record:
  `truckernet` → your hosting provider (Vercel, Netlify, etc.). This makes
  `truckernet.novaboostlabs.co` live.
- [ ] **Create Terms & Conditions page** at `truckernet.novaboostlabs.co/terms`
  (Notion public page, Vercel deploy, or simple hosted HTML — all work).
- [ ] **Create Privacy Policy page** at `truckernet.novaboostlabs.co/privacy`
  (same hosting as T&C).
- [ ] **Add email alias** in Google Workspace admin: add `truckernet@novaboostlabs.co`
  as an alias on your existing account. All emails land in your normal inbox.
- [ ] **Update App Store listing** (when ready): use `truckernet.novaboostlabs.co`
  as the Support URL and Privacy Policy URL — Apple and Google both require these.
- [x] **Supabase migrations applied (2026-06-25):** `2026-06-22_loads_bol_photo.sql`, `2026-06-23_rate_reports.sql`, `2026-06-24_load_expenses.sql`
- [x] **Edge functions deployed (2026-06-25):** `ocr-fuel-receipt`, `ocr-bol` — `ANTHROPIC_API_KEY` secret set.

**Phase 2 (after all Phase 1 bugs cleared):**
- Aesthetic redesign (Partiful/Wise/Calm-tier polish)
- **RevenueCat paywall** — IN PROGRESS (strategy finalized 2026-06-22). Build Free↔Pro
  only now (Fleet/Enterprise deferred until multi-truck features exist).
  - **Pricing:** Driver Pro = $34.99/mo OR $297.99/yr (~29% off, "Save $122").
    7-day free trial on both. RevenueCat entitlement id = `pro`.
  - **Free tier:** Check Load unlimited (the hook — NEVER gate) showing break-even
    VERDICT only, break-even, onboarding, fuel tracking + CPM, **15 loads/month**,
    dashboard current-week only.
  - **Pro tier:** **fair-market price/comparison** (see below), unlimited loads,
    full History (calendars/past periods/load detail), full IFTA + export,
    cross-device sync, analytics, full dashboard P&L.
  - **Fair-market = Pro:** in BOTH Check Load and Add Load, where the fair-market
    $ range would render, free users see "Upgrade to Pro to see what you should be
    getting paid" instead. NUANCE: Check Load stays free + unlimited; the break-even
    verdict (worth-it vs my costs) stays free; only the fair-market benchmark (what
    the load SHOULD pay) is gated. This is a strong "am I being lowballed?" hook.
  - **IFTA gating = teaser:** free users see top row/two of REAL data, rest BLURRED
    with upgrade overlay (feel the value, can't use it).
  - **Paywall triggers:** 16th load/month, History past-periods, IFTA tab open,
    any export tap, fair-market range area in Check Load + Add Load.
  - **Build approach:** mock `isPro` toggle first (full UI + gating + blur work for
    testing), swap real RevenueCat calls once store products live.
  - **Build order:** (1) RevenueCat account+products [USER action — needs guide doc],
    (2) SubscriptionContext (isPro + purchase/restore), (3) Paywall screen,
    (4) gating helpers + 4 triggers, (5) IFTA blur-teaser, (6) Restore + manage sub
    in Settings.
  - **USER still needs:** create RevenueCat account + products in App Store Connect /
    Google Play. Full plan in memory `monetization-paywall-plan.md`.
- **Push notifications** — load reminders, IFTA quarter-end alerts, weekly P&L
  summary. Expo Notifications + Supabase Edge Function triggers.
- Splash screen + app icons
- ✅ Full settings screen — built 2026-06-20
- ✅ Receipt OCR (BOL + fuel receipt photo → auto-fill) — built 2026-06-22
- Supabase Realtime for multi-device live sync
- **Geocoding result cache** — at ~500+ users, add in-memory LRU cache for recent
  geocoding queries (same pattern as `routeCache` in `mapbox.ts`). Low priority.

---

## 5.5 V1 Launch Checklist & V2 Backlog (2026-06-25)

> **Context:** As of 2026-06-25, the core loop is fully built — load logging, net
> pay, IFTA, fuel tracking, fair-market rates, paywall, RevenueCat, push
> notifications, crowdsourced rates, full load editing, expenses-on-loads. The gap
> audit below is what remains between "working app" and "app people pay $34.99/month
> for and tell other drivers about."
>
> **V1 bar:** not MVP — a premium, subscription-first tool that competes with YNAB
> and Calm. A driver who tries it must feel it's worth the money. Every V1 item
> below either makes the core loop feel incomplete or directly drives conversion and
> retention.

---

### V1 — Must ship before public launch

#### Bugs (make the app look unfinished)

| # | Issue | Why V1 |
|---|-------|--------|
| B1 | **Add Load status defaults to "completed"** — every new load starts with the wrong status | Immediate UX confusion on the single most-used flow |
| B2 | **Demo data flashes on first paint of each tab** before real data loads | Looks buggy; undermines trust |
| B3 | **Onboarding break-even result screen** shows `—` for fixed-cost component of the formula | The payoff moment of onboarding looks broken |
| B4 | ✅ Done 2026-06-26 — **Per-session data congruency** fixed via `data_owner_id` ownership (cross-account contamination on expiry-reconcile). See Work Log. | Corrupts the driver's break-even number silently |

#### Features that complete the core loop

**History search**
Drivers need to find "that Memphis load from March" by BOL number, city, or broker
name. Once a driver has 20+ loads, the date-only browsing in History becomes
inadequate. This is table-stakes for a $34.99/month bookkeeping tool.

**Income goal tracker**
User sets a weekly or monthly net pay target in Settings. Dashboard shows a progress
bar toward it. Push notification fires at 75% and 100%. This is the difference between
an app that *records* and an app that *motivates*. Without it, there is no reason to
open the app on days you aren't logging a load — the primary retention lever identified
in the PRD.

**Analytics charts** ✅ Done 2026-06-25
Two charts on Dashboard, both Pro-gated with a paywall overlay for free users:
1. Net Pay Trend — 12-week SVG bar chart (green/red per week, zero baseline)
2. Cost Breakdown — stacked horizontal bar (fuel/fixed/expenses/net) + legend with % of gross
Used `react-native-svg` (installed). New DB functions: `getWeeklyNetTrend()`, `getCostBreakdown()`.
Added `'analytics'` PaywallReason and translations in all 4 languages.

**IFTA PDF export** ✅ Done 2026-06-25
`expo-print` + `expo-sharing`. Export button now opens an action sheet (iOS) / Alert (Android)
with "Export PDF" and "Export CSV" options. PDF is a professional HTML-rendered document:
TRUCKERNET header with amber accent, Q/year + date range, 4-stat summary (miles, gallons,
MPG, states), per-state table, totals row, disclaimer. File shared via native share sheet.

**Pre-onboarding walkthrough** ◐ Walkthrough done 2026-06-26 (profile + auth reorder pending)
4-screen swipeable walkthrough before sign-in, using mock product UI (not illustrations)
so drivers see the real app before committing:
1. **How it works** — the mechanic shown as a 3-step flow: costs → break-even ($2.18/mi)
   → verdict (TAKE IT ✓). Primes the onboarding questions that come right after.
2. **Check Load** — mock result card: $1,247 net · $2.97/mi · above break-even.
3. **Fair Market Price** — $1,800 offered vs $2,050–$2,300 fair market → "below market" pill.
4. **IFTA files itself** — mini state table + "ready to export." Footer becomes the
   primary CTA: Get Started / I already have an account / Explore without an account.
Files: `src/screens/walkthrough/WalkthroughScreen.tsx`. Wired into `RootNavigator` as a
new `'walkthrough'` step between language and sign-in; shown once (flag `walkthrough_seen`
in settings, survives sign-out, resets only on reinstall). All 4 languages.

✅ DONE 2026-06-26 (see Work Log 2026-06-26 §A):
- **Auth flow reorder** ✅ — sign-up/login now runs AFTER onboarding + break-even result,
  before the dashboard. RootNavigator session effect handles post-auth onboarding-flag +
  expense push.
- **Driver profile setup** ✅ — `ProfileSetupScreen` (name, equipment type incl. Intermodal
  Container + Car Transport, truck number, home base). Runs after the break-even result.
  (Not yet wired to personalize Add Load defaults / Dashboard greeting — profile data is
  stored but not yet consumed. Follow-up.)
- **Welcome page** ✅ — language picker became a real welcome screen with live language switching.

STILL PENDING:
- Guest mode ("Explore without an account") to be REMOVED before launch (kept now for review).
- Consume profile data: ✅ greet by name on Dashboard + ✅ pre-fill equipment type on Add
  Load (done 2026-06-26). STILL OPEN: sync profile fields to Supabase `profiles`.
- Dashboard goal-hero "Monday-zero" empty-state framing: ✅ done 2026-06-26.

#### Growth infrastructure

**Referral program**
"Give a driver 30 days free, get $10 off yours." The PRD identifies this as the
primary organic growth engine. It must exist before any marketing spend so every
early user who tells a friend compounds growth. Implementation: unique link per user
(Supabase), extended 30-day trial for referred user (RevenueCat), $10 credit for
referrer, entry point in onboarding + Settings. Keep it simple for V1 — no leaderboard.

**PostHog product analytics**
Not user-facing, but a hard V1 requirement. You cannot improve a funnel you cannot
see. Before launch you need: where in onboarding do drivers drop off, which paywall
trigger converts best, what % of free users hit the load limit, DAU/WAU, free→paid
conversion rate. Two days of instrumentation gives leverage over the next year.

**Sentry error tracking**
One crash-on-launch for a new user is a lost driver. The free tier covers the volume
at launch. This is infrastructure, not a feature, but it is not optional in production.

---

### V1 Summary Table

| Item | Effort | Rationale |
|------|--------|-----------|
| Bug: status default (B1) | XS | Polish — wrong on every new load |
| Bug: demo data flash (B2) | XS | Looks broken |
| Bug: onboarding formula (B3) | XS | Payoff moment looks broken |
| Bug: session data congruency (B4) | S | ✅ Done 2026-06-26 — data_owner_id ownership fix |
| History search | S–M | ✅ Done 2026-06-25 |
| ~~Income goal tracker~~ | ~~M~~ | ✅ Done 2026-06-25 |
| Analytics charts | M | ✅ Done 2026-06-25 |
| IFTA PDF export | M | ✅ Done 2026-06-25 |
| Pre-onboarding walkthrough | M | ✅ Done 2026-06-26 — walkthrough + welcome page + profile setup + auth-after-onboarding all shipped |
| Monetization completion (usage meter, dynamic pricing, trial eligibility) | M | ✅ Done 2026-06-26 — needs store config (§5.6) + real-build verification |
| Referral program | M | Organic growth from day one |
| PostHog | S | ✅ Done 2026-06-25 |
| Sentry | S | ✅ Done 2026-06-25 |

---

### V2 — Post-launch, meaningful but can wait

Build these after launch, once you have real user data showing what drivers actually
use and ask for.

**Maintenance tracking** (PRD §19)
Log oil changes, tire rotations, brake jobs, DOT inspections. Track by odometer; alert
when service is due. Maintenance cost feeds the monthly expense average automatically.
Rounds out the "financial OS for owner-operators" story significantly. Great V2 anchor.

**Broker scorecard** (PRD §20)
Broker name and MC are already stored on every load. The missing piece is a rating
screen (payment speed, reliability, communication) and a history view — "this broker
was slow 3 of the last 5 loads." Data hook exists; the feature screen does not.

**Voice input** (PRD §11)
Microphone on every text/number field; device-native speech recognition (free, offline,
fast). High-value UX for hands-free logging at a dock, but requires careful
implementation to feel right. Better to do it properly in V2 than rush it.

**Lane profitability analytics**
"Which routes make you the most money?" A per-driver heat map of origin→destination
pairs ranked by average net pay. Requires a meaningful load history to be useful;
build it once drivers have that history.

**History: filter by equipment/state + sort options**
Currently only date-period filtering. Adding "show only reefer loads" or "sort by net
pay" is a power-user feature most drivers won't need until they have 50+ loads.
V1 search covers the most urgent case.

**Full load history CSV export**
A complete accounting dump with all load fields. Useful for accountants, but most
early-stage drivers won't have one asking for this yet. IFTA CSV export covers the
near-term accountant need.

**Email reports** (PRD §16)
Weekly net pay summary, monthly P&L, quarterly IFTA reminder via Resend. Push
notifications (already built) cover the same retention intent for V1. Resend is low
effort but email reporting is a V2 polish item.

**Supabase Realtime**
Multi-device live sync. Current push-on-save + pull-on-sign-in is solid enough for V1.
Most owner-operators use one device. Realtime becomes important once fleet features
(multiple users on one account) exist.

**Editable route on Load Detail**
If a driver logged the wrong origin/destination or total miles, they currently must
delete and re-add. All other fields are editable. Route editing is the remaining gap,
but it's an edge case — most drivers don't enter a city wrong.

**Fuel CPM trend: expand to 20 entries**
The current chart shows the last 5 fill-ups. PRD calls for 20. The data is there;
it's a display limit. Low priority.

**Web companion**
Desktop-optimized for bookkeeping and IFTA review. Blocked anyway until the native
app has proven product-market fit.

---

### V2 Summary Table

| Item | Notes |
|------|-------|
| Maintenance tracking | Completes "financial OS" story; strong V2 anchor |
| Broker scorecard | Data hook exists; feature screen does not |
| Voice input | High value; do properly, not rushed |
| Lane profitability analytics | Needs 50+ loads of history to be meaningful |
| History: equipment/state filters + sort | Power user; V1 search covers urgent case |
| Full load history CSV export | IFTA CSV covers near-term accountant need |
| Email reports (Resend) | Push notifications cover V1 retention intent |
| Supabase Realtime | Needed for fleet features; V1 push-on-save is fine |
| Editable route on Load Detail | Edge case; delete-and-re-add is workable |
| Fuel CPM trend: 20-entry chart | Minor display limit; data is already there |
| Web companion | Post product-market fit |

---

## 5.6 🔑 RevenueCat + App Store Connect Setup (USER action — gates all revenue)

> The monetization **code is done** (Work Log 2026-06-26 §C). Nothing earns money until
> the store products + RevenueCat are configured and tested on a **real build** (Expo Go
> cannot process purchases). This is the only thing between the app and live revenue.
> Do the steps in order — each depends on the previous.

**Reference values (code + RevenueCat dashboard now agree — confirmed 2026-06-26):**
- Entitlement identifier: **`pro`** (display name "TruckerNet Pro")
  (`SubscriptionContext.tsx` → `ENTITLEMENT_ID = 'pro'`; app reads `entitlements.active['pro']`).
- Products attached to the entitlement: **`truckernet_pro_monthly`**, **`truckernet_pro_annual`**.
- Package lookups: monthly resolves via `current.monthly` (RC "Monthly" package) or a
  package whose identifier is `monthly`; annual via `current.annual` or identifier `yearly`.
- Target prices (set these as the product prices): **$34.99/mo**, **$297.99/yr** (~29% off).
- Free trial: **7-day** intro offer on **both** products (the paywall promises it).
- iOS API key placeholder in code is a `test_` key — **replace with the live key** before
  submission (`IOS_API_KEY`). `ANDROID_API_KEY` is empty — fill when Android is set up.

### Step 1 — App Store Connect (iOS)
- [ ] In **Apps → TruckerNet → Subscriptions**, create a **Subscription Group**
  (e.g. "Driver Pro").
- [ ] Add **two auto-renewable subscriptions** in that group:
  - [ ] **Monthly** — Product ID **`truckernet_pro_monthly`**, price **$34.99/mo**.
  - [ ] **Annual** — Product ID **`truckernet_pro_annual`**, price **$297.99/yr**.
- [ ] On **each** product add an **Introductory Offer → Free Trial → 7 days** (new
  subscribers). This is what makes "Start 7-Day Free Trial" real; without it the trial
  copy auto-hides (trial-eligibility check returns ineligible/no-offer).
- [ ] Fill required localizations, review screenshot, and the subscription
  **Privacy/Terms** — Apple blocks the product as "Missing Metadata" otherwise.
- [ ] Complete **Agreements, Tax, and Banking** (Paid Apps agreement active) — products
  won't return from the store until this is signed.

### Step 2 — RevenueCat dashboard  ✅ entitlement already created (2026-06-26)
- [ ] Create the **iOS app** in RevenueCat; upload the **App Store Connect API key**
  (In-App Purchase key) so RC can validate receipts.
- [x] Entitlement created — identifier **`pro`**, display name **TruckerNet Pro**.
- [x] Products **`truckernet_pro_monthly`** + **`truckernet_pro_annual`** attached to `pro`.
  (After Step 1 creates them in App Store Connect, confirm RC imports the same Product IDs.)
- [ ] Create an **Offering** (mark it **current**) with two **Packages**:
  - [ ] **Monthly** package → monthly product.
  - [ ] **Annual** package → annual product.
  (Use RC's standard Monthly/Annual package types so `current.monthly` / `current.annual`
  resolve; otherwise the identifier fallbacks `monthly` / `yearly` must match.)
- [ ] Copy the **Public SDK key (iOS)** → paste into `SubscriptionContext.tsx`
  `IOS_API_KEY`, replacing the `test_…` value.

### Step 3 — Build & verify (real device, NOT Expo Go)
- [ ] Add a **Sandbox tester** in App Store Connect (Users and Access → Sandbox).
- [ ] Make a **dev/TestFlight build** (`eas build` — `react-native-purchases` is native and
  absent from Expo Go; the app auto-runs mock mode there).
- [ ] On device, open any paywall and confirm:
  - [ ] Real **localized prices** render (not the `$34.99/$297.99` fallbacks) — proves the
    offering loaded.
  - [ ] **Savings badge** computes from real prices.
  - [ ] **"Start 7-Day Free Trial"** shows for a fresh sandbox account; after using it,
    the CTA becomes **"Subscribe"** and the gift note disappears.
  - [ ] Purchase completes → `isPro` flips → gated features unlock (load limit, IFTA
    export, fair-market, History past periods, analytics).
  - [ ] **Restore Purchases** works on a reinstall.
- [ ] Confirm the legal links resolve: `…/terms` and `…/privacy` must be live (see the DNS
  /Terms/Privacy USER action items in §5) — Apple rejects subscriptions without them.

### Step 4 (later) — Android
- [ ] Create the same two subscriptions in **Google Play Console** with 7-day trials.
- [ ] Add the **Android app** in RevenueCat, attach products to the same entitlement.
- [ ] Paste the **Android public SDK key** into `ANDROID_API_KEY`.

---

## 5.7 📌 YOUR PERSONAL TODO — updated 2026-06-29 (EAS build fixed)

> Status as of this session. ✅ = done, [ ] = still needed.

**A. Monetization — RevenueCat + App Store**
- [x] Agreements, Tax & Banking in App Store Connect ✅
- [x] `truckernet_pro_monthly` ($34.99/mo) + `truckernet_pro_annual` ($297.99/yr) created in App Store Connect ✅
- [x] 7-day free trial intro offer on both products ✅
- [x] RevenueCat: entitlement `pro`, products attached, iOS app connected (Subscription Key uploaded), Offering built ✅
- [x] Live iOS SDK key `appl_JvoQxWtuPHFOIitrxyHEVEmGuve` pasted into `SubscriptionContext.tsx` ✅
- [x] iOS Sandbox tester added ✅
- [x] **EAS build boots** ✅ — `eas build --platform ios --profile preview` now builds AND launches.
      Was stuck on the splash screen because EAS had **no env vars** (the local `.env` is
      gitignored, so it never reached EAS servers → empty Supabase URL → `createClient` threw
      at import → app never mounted). Fixed by pushing env vars to EAS:
      `eas env:push preview --path .env` (also pushed to production + development). **Any future
      env-var change must be re-pushed to EAS** — editing `.env` alone does NOT update builds.
      Also hardened the loading gate (i18n try/catch + 8s failsafe) so a single init failure
      can't freeze the splash again.
- [x] **RevenueCat Offering complete** ✅ — `default` offering marked Current with monthly + annual packages.
- [x] **Subscriptions "Ready to Submit"** ✅ — cleared "Missing Metadata" by adding the
      subscription-GROUP localization (the field most often missed — it's at the group level, not
      the individual product) + availability (North America). First-subscription metadata is now complete.
- [x] **Home-screen app name → "TruckerNet"** ✅ — `app.json` `expo.name` changed from
      "TruckerNet: Driver Finance" to "TruckerNet" (the long name compacted badly under the icon).
      App Store *listing* name stays "TruckerNet: Driver Finance" in ASC — the two are independent
      (icon name is `CFBundleDisplayName`, set from `expo.name`). Takes effect on next build.
- [ ] **Test purchase via TestFlight** (do this at home — not a quick phone task).
      WHY TestFlight, not the preview build: the `preview` profile is `distribution: internal`
      (ad-hoc), and ad-hoc builds use the **production** StoreKit environment — so the purchase
      sheet jumps to the real Apple ID, never prompts for sandbox, and the "Sandbox Apple Account"
      row never appears in Settings → Developer. **TestFlight builds use the sandbox environment
      automatically** (purchases free, real Apple ID is fine, no sandbox account needed).
      Steps:
      1. `eas build --platform ios --profile production` (env vars already pushed to production env;
         production profile now pinned to the same Xcode image + Sentry-disable as preview).
      2. `eas submit --platform ios --latest` — provide Apple / ASC API key creds when prompted.
      3. App Store Connect → TestFlight: wait for processing (~5–30 min), answer **Export
         Compliance** (standard HTTPS only → "No" to proprietary encryption).
      4. Install via the **TestFlight app** on the iPhone.
      5. Verify: real localized prices, "Start 7-Day Free Trial", purchase → Pro unlock
         (fair-market, full IFTA, full History), Restore Purchases after a reinstall.
      ⚠️ Pre-check: both subscription products in App Store Connect must be at least
      **"Ready to Submit"** (NOT "Missing Metadata") or the purchase fails even in TestFlight.
      ("Prepare for Submission" is the app-version status — that's fine; check the *product* status.)
- [ ] Android: create matching subscriptions in Google Play Console, add Android app in RevenueCat, paste Android SDK key into `ANDROID_API_KEY` in `SubscriptionContext.tsx`.

**A2. Supabase migrations — ALL APPLIED ✅ (2026-06-29)**
- [x] `2026-06-26_rate_reports_type_band_idx.sql`
- [x] `2026-06-26_rate_reports_integrity.sql`
- [x] `2026-06-26_sync_schema_parity.sql`
- [x] `2026-06-27_market_config.sql`
- [x] `2026-06-28_profiles_driver_fields.sql`
- [x] `2026-06-28_general_expenses.sql`
- [x] `2026-06-28_loads_coordinates.sql`
- [x] `2026-06-29_broker_reports.sql`

**B. Web presence + legal — required for App Store approval**
- [x] **Website built + live** ✅ — new standalone domain **`truckernet.app`** (replaces the old
      `truckernet.novaboostlabs.co` subdomain plan). Strong hero ("Stop guessing what a load
      really pays"), How It Works, features, pricing ($34.99/$297.99), Support + Data Deletion pages.
- [x] **Terms** page live at `truckernet.app/terms` ✅ (real content — billing, auto-renewal, disclaimers).
- [x] **Privacy Policy** page live at `truckernet.app/privacy` ✅ (real content — data collected, deletion, third parties).
- [ ] **⚠️ Fill unfilled placeholders** on BOTH `/terms` and `/privacy` before submitting:
      `[INSERT EFFECTIVE DATE]` → a real date, and `[INSERT SUPPORT EMAIL]` → a real address.
      A reviewer seeing `[INSERT SUPPORT EMAIL]` is a credibility / rejection risk.
- [ ] **Set up a real support email** — recommend `support@truckernet.app` (you own the domain now).
      Must be a working mailbox/alias: data-deletion + support requests land here. Use the same
      address in the Terms/Privacy placeholders above and on the App Store listing.
- [ ] Set Support URL (`truckernet.app`) + Privacy URL (`truckernet.app/privacy`) on the App Store listing.

**G. OAuth — DONE ✅ (2026-06-29)**
- [x] **Google OAuth** — all 3 Supabase steps completed (redirect URI confirmed, provider on with
      Client ID + Secret, `truckernet://auth/callback` added to Redirect URLs).
- [x] **Apple Sign In** — App ID capability enabled + Supabase Apple provider on with bundle ID
      `com.novaboostlabs.truckernet` (native `signInWithIdToken` flow — no secret/redirect needed).
- [ ] Verify both on the device build (OAuth only works in a real EAS build, not Expo Go).

**H. Security hardening — 2026-06-30 audit (do these; code side is committed)**
- [ ] 🔴 **CRITICAL — apply `2026-06-30_core_tables_rls.sql`** in the Supabase SQL Editor, then in
      Dashboard → Authentication → Policies CONFIRM `loads`, `state_mileage`, `fuel_entries` show
      "RLS enabled" with only owner policies. The anon key is public (ships in the app), so RLS is
      the ONLY thing protecting one user's data from another. If any of these tables had RLS OFF,
      this was an active data-exposure hole. **If you see any policy using `USING (true)`, delete it.**
- [ ] **Redeploy both edge functions** (now require an authenticated user + cap image size, so the
      paid Anthropic key can't be abused by anyone holding the public anon key):
      `supabase functions deploy ocr-fuel-receipt` + `supabase functions deploy ocr-bol`.
      (Leave `verify_jwt` at its default ON.)
- [ ] **Restrict the Mapbox token** at mapbox.com → token → URL restriction to the app's bundle ID
      so a stolen public token can't burn your Mapbox quota.
- [ ] **BOL photos are in a PUBLIC-read storage bucket** (`bol_read_public`) — BOLs contain broker
      names, addresses, weights. Decide: switch to per-user read policy + signed URLs (needs a small
      client change in how `bol_photo_url` is displayed). Flagged; not yet changed.
- [ ] Optional: rate-limit `rate_reports` / `broker_reports` inserts (crowdsourced, anonymous —
      CHECK constraints already block garbage values, but a determined user could spam volume).

---

## 6. Work Log (newest first)

### 2026-06-30 — Security audit + hardening (XSS / SQLi / RLS / API-key abuse)

Full defensive audit before scaling. **SQL injection: not possible** — the entire SQLite layer
is parameterized (`?` + bound params); the only string interpolation is internal column-list
constants and a hardcoded date-filter clause, never user data. **XSS: low surface** — React Native
`Text` doesn't interpret HTML and there's no WebView; the one HTML generator (IFTA PDF via
expo-print) interpolates only the user's own data into a local PDF — escaped it anyway (`esc()`).
**Secrets: clean** — no service_role key or hardcoded secrets in the client; Anthropic key is
server-side only; tokens in SecureStore (AFTER_FIRST_UNLOCK).

**🔴 Critical finding — core-table RLS unverifiable from repo.** `loads`, `state_mileage`,
`fuel_entries` were created in the base schema (not in the repo; the migrations only ADD COLUMNS),
so their RLS status couldn't be confirmed. Since the anon key is public, RLS is the *only* barrier
between users' data. Wrote `2026-06-30_core_tables_rls.sql` — idempotent, additive, owner-scoped
(loads/fuel by `user_id`; state_mileage via parent load). **USER must apply + verify in dashboard.**

**Edge functions hardened** (`ocr-fuel-receipt`, `ocr-bol`): added real authenticated-user check
(`supabase.auth.getUser()` on the caller's JWT — the public anon key alone no longer passes) + an
8M-char image size cap, so the paid Anthropic key can't be abused. **USER must redeploy both.**

**Other items flagged in §5.7 H:** BOL photos are in a public-read bucket (harden to signed URLs);
restrict the Mapbox public token to the bundle ID; optional rate-limit on crowdsourced inserts.
Client `tsc` clean.

### 2026-06-30 — Fair-market formula: blind 20-load validation + calibration pass

**Empirically verified the formula** against current (2026) published market data. Built a
20-load test (all 10 equipment types, mixed origins/destinations/distances) run through the REAL
`getFairMarketRate` (Node 26 native TS, baseline $2.50, June seasonal 1.02), then compared each
midpoint $/mi to DAT / Scale Funding / O Trucking / Freight Sidekick / DrayNow 2026 figures.

**Findings (before fix):** van + reefer medium/long held at 2–8% (the staples are solid). Drift
was concentrated in (a) the short/medium **distance curve** running ~10–13% high (worst on short
flatbed, Chicago→Indy +23%), and (b) **step_deck (+30%) / hazmat (+23%)** equipment multipliers.
Auto-transport + intermodal showed a *definitional* gap (per-car vs per-truck; rail vs drayage),
not a calibration error — left untouched, flagged for a product decision.

**Fix (`src/utils/marketRates.ts`):**
- Flattened `DISTANCE_ANCHORS` across the short/medium range (25mi 1.85→1.70, 75mi 1.58→1.45,
  175mi 1.30→1.20, 375mi 1.14→1.08). 750mi+ anchors **unchanged** (validated), so only the
  short/medium overshoot is pulled down. Floor still protects tiny loads.
- `step_deck` 1.50→1.40, `hazmat` 1.38→1.30.
- Left van/reefer baseline+mult, tanker/power_only/rgn/flatbed mults (within source-data noise),
  and auto/intermodal (definitional) as-is.

**Result:** mean absolute error **5.2%** across 18 scored lanes (van/reefer now 1–6%, hazmat +10%,
tanker +7%, intermodal −1%; step_deck +16% and short flatbed +14% remain a touch rich but sit
inside those equipments' genuinely wide real-world spot ranges — not over-tuned to one data point).
Nothing previously good regressed. `tsc` clean. Test script kept in scratchpad (not committed).

### 2026-06-29 — EAS build unblocked (splash-screen hang) + OAuth + website live

**The build installed but froze on the native splash screen.** Root cause (after two wrong
guesses) was **missing EAS environment variables**: the local `.env` is gitignored, so it was
never uploaded to EAS's build servers. At build time `EXPO_PUBLIC_SUPABASE_URL` was `undefined`
→ `createClient('', '')` throws `supabaseUrl is required` **at module import** → the
`supabase.ts → AuthContext → App.tsx` import chain failed before React mounted → JS never ran →
`SplashScreen.hideAsync()` never called → native splash stayed up forever.

- **Fix:** `eas env:push preview --path .env` (also production + development). Build log now shows
  all five `EXPO_PUBLIC_*` vars loading. **Future env changes must be re-pushed to EAS.**
- **Hardening kept (committed `abeb368`, `8e60f2c`):** AuthContext `getSession` now has
  `.catch/.finally`; i18n init wrapped in try/catch/finally; AppSplashScreen 4s safety timer;
  App.tsx 8s global failsafe + font-error fallback. None of these were the root cause but they
  prevent any single init failure from freezing the splash again.
- **Build config:** corrected Sentry project slug → `truckernet-react-native`;
  `SENTRY_DISABLE_AUTO_UPLOAD=true` on preview/development; pinned dev profile to the same Xcode
  image as preview (`abeb368`, `efd98d8`).
- **`watcher.unstable_workerThreads` validation warning** — benign version skew between
  `@expo/metro-config@54.0.16` (sets it) and `metro@0.83.7` (doesn't recognize it). Cosmetic;
  no build/runtime effect. Left as-is.

**OAuth done:** Google (3 Supabase steps) + Apple Sign In (App ID capability + Supabase provider
with bundle ID). Native Apple flow — no secret/redirect needed. Verify on device build.

**Website live at `truckernet.app`** (new domain, replaces the `truckernet.novaboostlabs.co`
subdomain plan). Terms + Privacy pages have real content but still contain
`[INSERT EFFECTIVE DATE]` / `[INSERT SUPPORT EMAIL]` placeholders — must fill before submission,
and stand up a real `support@truckernet.app` mailbox. Tracked in §5.7 B.

### 2026-06-28 — Final V1 code gaps closed: profile sync, guest removal, brand icon

Three remaining code-side V1 items (everything else was store/legal user actions):

**1. Profile → Supabase sync.** Driver profile (name/equipment/truck#/home base) was local-only;
a reinstall lost it. Added migration `2026-06-28_profiles_driver_fields.sql` (4 columns on the
existing `profiles` table) + `src/lib/sync/profileSync.ts` (push/pull/reconcile, mirrors
expensesSync), wired `syncProfileOnSignIn` into RootNavigator's sign-in effect. Upsert only
touches profile columns, leaving weekly_miles/weekly_fuel_cost intact. **USER must apply the migration.**

**2. Guest mode removed.** "Explore without an account" stripped from Walkthrough, SignIn, SignUp;
`enterGuestMode` + GUEST_SETTING removed from RootNavigator; profile_setup now always → signup.
App is now account-required (the pre-launch decision). `guest_mode` setting plumbing + i18n keys
left in place (harmless, preserves i18n parity); Settings `!user` checks kept as defensive no-ops.

**3. New Freight Terminal app icon.** Old `assets/icon.png` predated the rebrand. Generated a
brand-matched set via `scripts/gen-icons.js` (resvg + real JetBrains Mono ExtraBold): teal "TN"
monogram, faint teal grid, amber accent bar, terminal frame on #0A0A0B. Regenerated icon.png,
splash-icon.png, android foreground/background/monochrome, favicon.png (all correct dims, foreground
transparent + safe-zone padded). `@resvg/resvg-js` installed --no-save (one-off build tool; PNGs are committed).

**tsc 0 errors, i18n parity OK.** This closes the last V1 code work; remaining items are all
user/store actions (§5.7) + the new profiles migration.

---

### 2026-06-29 — Massive feature + polish session (full summary)

**CODE — all tsc clean, i18n parity OK across en/es/pa/zh throughout.**

**Freight Terminal aesthetic — COMPLETE across all 21 screens + components**
Light/dark theme system: `darkColors`/`lightColors` in theme.ts, `ThemeProvider`/`useTheme()` context,
persisted `theme_mode` setting, System/Light/Dark toggle in Settings + Welcome screen dropdown.
`GridBackground.tsx` (28px SVG grid, all screens), `AccentRule.tsx` (vivid amber underline, all headings),
JetBrains Mono font added (`@expo-google-fonts/jetbrains-mono`). All screens converted to `makeStyles(Colors)`
reactive pattern. Tab bar chrome themed. App icons regenerated to Freight Terminal brand (via `scripts/gen-icons.js`).

**Fair-market formula — refinements #1–4 COMPLETE**
#1 Geography (origin strength × reload), #2 continuous distance curve (eliminates band cliffs),
#3a remote-tunable baseline via `market_config` Supabase table, #4 confidence ranges (high/medium/low,
`rateInsights.estRough` for wide-range estimates). All migration applied.

**Features shipped:**
- **Haptics** — `src/lib/haptics.ts`, wired to all save/verdict/tab/selection moments.
- **PostHog full funnel** — 30 events covering entire onboarding, walkthrough CTAs, first-load celebration, load-limit hit, all auth methods. Rescheduled weekly summary with real data.
- **Broker scorecard** — anonymous crowdsourced broker intel. `broker_reports` Supabase table. `src/lib/brokerScorecard.ts`. A–F grade from pay-vs-market + recommend rate. Surfaces on Add Load + Check Load when broker name entered.
- **Re-engagement notifications** — smart weekly P&L (real net + best lane + vs break-even, refreshed on app open), consecutive-weeks streak milestones (2/3/5/10/15/20/26/52 weeks), idle nudge (7 days, regular loggers only).
- **Tax set-aside estimate** — `getTaxSetAside()` in DB, `TaxSetAsideCard` on Dashboard, Settings rate slider (default 25%), quarterly IRS deadlines, urgency warning within 14 days. Not tax advice disclaimer always shown.
- **Value-based paywall conversion** — `getValueMissedStats()` computes lowball load count + conservative lost amount. PaywallScreen shows real dollar callout when triggered from fairMarket. FreeUsageMeter shows "Pro would have flagged X lowball loads" when data exists.
- **Standalone one-off expenses** — `AddExpenseScreen`, `general_expenses` table, FAB "Add Expense" button, cloud sync (`generalExpensesSync.ts`). Unattached → reduces period net. Attached to load → reduces that load's net. History shows expenses interleaved with loads by date (amber icon, delete on tap).
- **Personal nearby-lane history (50mi radius)** — `getPersonalLaneHistory()` rewritten with haversine matching. `pickup_lat/lng/delivery_lat/lng` added to loads (stored on save, synced). Falls back to state-level for older loads. Delta pill: "+$200 above your usual for this lane" / "-$150 below" on Check Load + Add Load.
- **Dynamic break-even (all 3 components)** — fuel CPM: rolling 10 fill-ups (unchanged, already good). Fixed expenses: 30-day check-in + category-aware aging (insurance 335d, ELD 335d, truck 180d, parking 60d etc.). Monthly miles: auto-switches from onboarding estimate → actual logged miles (1+ loads) → 90-day rolling avg (5+ loads). `milesSource` tag shown on break-even strip.
- **Expense review system** — `ExpenseReviewBanner` (amber, shows specific stale categories by name), `ExpenseReviewModal` (per-row "Still correct" confirm + "All accurate" bulk confirm + "Edit" → Expenses tab). `confirmed_at` column on `user_expenses`. 30-day adaptive push notification.
- **Google Sign-in icon** — real 4-color SVG Google "G" replacing the placeholder.
- **Address autocomplete on Profile Setup** home base field.
- **Speed-dial FAB** — Dashboard "+" expands into Add Load / Add Fill-Up / Add Expense with spring animation and backdrop.
- **Onboarding profile sync** — `profileSync.ts`, `profiles` table gets name/equipment/truck#/home_base.
- **Guest mode removed** — app is now account-required.
- **Dashboard layout overhaul** — Check Load CTA moved above analytics (Zone 2), period cards collapsed into hero (month secondary line), Recent Loads before analytics, expense banner above loads, break-even strip as reference Zone 3.
- **RevenueCat live SDK key** — `appl_JvoQxWtuPHFOIitrxyHEVEmGuve` in `SubscriptionContext.tsx`.
- **All 8 Supabase migrations applied** by user 2026-06-29.

**What's still needed (user actions only — all code is done):**
1. EAS build: `eas build --platform ios --profile preview`
2. Google OAuth: 3 Supabase config steps (see §5.7 §G)
3. Website aesthetics → DNS → Terms/Privacy pages → email alias
4. Android subscriptions + RC Android setup (when ready)
5. App Store submission (after Terms/Privacy are live)

---

### 2026-06-28 — Freight Terminal aesthetic: FULL APP redesign complete

**Why:** V1's biggest open item was the aesthetic overhaul. User chose the "Freight Terminal"
direction (dark mono-grid, data-dense, mega-carrier-credible) from 4 mocked concepts.

**Design system (see memory `freight-terminal-aesthetic.md` for the spec):**
- Teal `#00C896` primary (user-confirmed — not #2DD4BF/too light, not #0D9488/too dark), amber
  `#E8A020` as tertiary (heading underlines, auth "OR" dividers, warnings/caution verdicts).
- JetBrains Mono (`@expo-google-fonts/jetbrains-mono`) for headings, numerals, labels; Inter for body.
- New components: `GridBackground.tsx` (28px SVG grid, on every screen but splash) and
  `AccentRule.tsx` (amber heading underline).
- `theme.ts`: added mono FontFamily entries; SectionLabel globally mono.

**Screens migrated (all 21 + tab bar):** Welcome, Walkthrough, SignIn/Up, onboarding ×5,
Dashboard (+4 cards), CheckLoad, AddLoad, LoadDetail, Fuel, FuelEntry, Expenses, IFTA, History,
Settings, Paywall, TabNavigator. Splash kept its bespoke animated identity.

**Method:** per-screen grid+accent+glow, plus bulk font/corner conversion
(bold→monoBold, semiBold→monoSemiBold, Radius.xl/lg→md). **tsc 0 errors, i18n parity intact.**
USER: run the app and spot-check; the aesthetic is feature-complete pending device QA.

---

### 2026-06-27 — Fair-market formula refinement #4: confidence-aware ranges

**Why:** Credibility through humility — a model-only estimate with less information should
present an honestly WIDER range and say so, rather than a confident wrong-looking point range.
Tightens automatically once community data backs the lane (that path already shows the
data-derived range).

**Built (`src/utils/marketRates.ts`):** New `RateConfidence` ('high'|'medium'|'low') on
`MarketRateResult`. `SPREAD_BY_CONFIDENCE` replaces the flat ±13%: high (geography known) ±13%,
medium (geography unknown — quick eval) ±18%, low (micro/local short flat-rated haul OR rgn) ±24%
(rgn keeps its ±30%). Confidence computed before spread. Frontend: CheckLoadScreen + AddLoadScreen
show "rough est. · varies by lane" (`rateInsights.estRough`, new key in all 4 langs) instead of
"est." when `confidence === 'low'`.

**Verified:** 600mi van geo-known → high/±13%; same unknown → medium/±18%; 80mi → low/±24%;
900mi RGN → low/±30%. `tsc` 0 errors, i18n parity OK.

**This completes the fair-market refinement roadmap (#1–4).** Formula now: remote-tunable baseline
× equipment (recalibrated) × continuous distance curve × seasonal × geography(origin+reload),
±confidence-scaled spread, min floors, with community/Waze data overriding when available.

---

### 2026-06-27 — Fair-market formula refinement #3a: remote-tunable baseline

**Why:** The national baseline ($2.50) was hardcoded — couldn't be updated without an app
release, and a market swing would drift every estimate at once and look broken to all users.

**Built:**
- Migration `supabase/migrations/2026-06-27_market_config.sql` — singleton `market_config` row
  with `baseline_dry_van`, CHECK clamp 1.50–4.00, public SELECT / no write policy (dashboard /
  service role only). Seeded at **2.50 = bundled default → applying it changes nothing** until
  deliberately tuned.
- `src/utils/marketRates.ts`: baseline const → injectable `activeBaseline` (default
  `DEFAULT_BASELINE_DRY_VAN = 2.50`) with `setBaselineDryVan()` (clamps, returns applied) +
  `getBaselineDryVan()`. Formula multiplies off `activeBaseline`.
- `src/lib/marketConfig.ts`: `loadCachedMarketConfig()` (sync, applies last cached value) +
  `refreshMarketConfig()` (async fetch → clamp → apply → cache). Degrades gracefully offline /
  unconfigured / first-launch (falls back to bundled default).
- `App.tsx`: after `initDatabase()`, apply cached baseline then background-refresh.

**Decided 3a only, not 3b** (fuel-coupling): rates track diesel only ~20–30%; auto-coupling
overcorrects for modest gain. Manual dashboard edit is simpler and fully controlled.

**Verified:** clamp (5.00→4.00, 0.90→1.50), knob moves all estimates proportionally (2.50→2.65
= +6% app-wide), bad/empty cache → bundled default. `tsc` 0 errors. Note: residual −5% seen
earlier was equipment-specific (van lanes were spot-on at 2.50), so seed stays 2.50 — tune later
from real data, not a blind reseed.

**USER ACTION:** apply `2026-06-27_market_config.sql`; thereafter re-center rates anytime by
editing the `market_config` row in the Supabase dashboard. Refinement #4 (confidence ranges) open.

---

### 2026-06-27 — Fair-market formula refinement #2: continuous distance curve (kill band cliffs)

**Why:** The 7-band distance step function jumped 10–18% at arbitrary mile edges — a 250 vs
251 mi load got a ~12% different estimate. An experienced driver entering 248 vs 252 mi and
seeing the number lurch would distrust the whole feature.

**Built (`src/utils/marketRates.ts`):** Replaced the `DISTANCE_MULT` band→multiplier map with
`DISTANCE_ANCHORS` (7 [miles, mult] points at the old band centers) + `getDistanceMultiplier()`,
piecewise-linear interpolation, flat beyond the ends. `getFairMarketRate` now uses the continuous
fn. Kept `DistanceBand` type + `getDistanceBand()` classifier (still used by rateReports.ts to
hold the band fixed across community tiers, and as result metadata) — they no longer drive the
multiplier.

**Verified:** Old jumps at band edges (−17.7% @100/101, −12.3% @250/251 & @500/501, −10% @1000/
1001, −6.7% @2000/2001) → all now ≤0.2% (just the curve's natural 1-mile slope). Real-lane
validation held / slightly tightened: Dallas→Atlanta +2%, NJ→Atlanta −2%, reefer/flatbed −5%.
Calibration preserved because anchors = old band multipliers. `tsc --noEmit` → 0 errors.

Refinements #3 (remote/fuel baseline — would close the residual ~−5%), #4 (confidence ranges) open.

---

### 2026-06-27 — Fair-market formula refinement #1: GEOGRAPHY (origin market strength)

**Why:** Fair-market price is the #2 core feature. Biggest accuracy gap was geography — the
same truck/miles/month pays very differently out of LA vs rural Montana. A pure
distance/equipment model can't be credible to an experienced driver without it.

**Built (in `src/utils/marketRates.ts`):**
- New `ORIGIN_STRENGTH` per-state index (6 tiers, 1.15 hot → 0.90 sparse), calibrated from 2026
  public freight-market data (DAT/CHR/Scale Funding/O Trucking — never load-board scraping).
  Hot: CA. Strong: TX/IL/IN/OH/MI/WI/WA/OR. Solid: GA/NC/SC/TN/MN/IA/MO/KS. Average: FL/AL/KY/
  AR/LA/MS/OK/VA/AZ/NV/UT/CO/NM. Soft: Northeast + NE. Sparse: MT/WY/ID/ND/SD.
- New `getGeoMultiplier(origin, dest)` = originStrength × reloadAdjustment. Reload nudge (±5%
  cap): weak destination lifts rate (deadhead comp), hot destination trims it (easy reload).
  Clamped 0.82–1.25. Unknown endpoints → 1.0 (graceful for quick eval).
- `getFairMarketRate` now takes optional `originState`/`destState`, multiplies GEO into midRPM,
  returns `geoMult`. Threaded through CheckLoadScreen + AddLoadScreen (states already extracted
  from geocoded pickup/delivery).

**Blind validation (modeled vs real published 2026 lane rates):**
- Dallas→Atlanta van: $2.67 vs $2.60 (+3%) ✓; NJ→Atlanta van: $2.40, market says $2.20–2.50 ✓
- Found + fixed equipment miscalibration: flatbed 1.18→1.34, reefer 1.20→1.22, step_deck
  1.40→1.50 (ratios vs van from 2026 trackers). Flatbed error −18%→−7%.
- Residual systematic ~−6 to −9% on equipment traces to the conservative $2.50 baseline (vs
  current $2.68 national van) — intentional (safer to under- than over-promise); the lever for
  refinement #3 (remote/fuel-coupled baseline).
- Known limitation: extreme premium/backhaul lanes (LA↔Chicago 58% real spread) are compressed
  by the formula — exactly the case the community/Waze data layer is built to capture.

**Rejected:** "This is off" correction button (user: opens us to troll/manipulation of the formula).

`tsc --noEmit` → 0 errors. Refinements #2 (smooth distance curve), #3 (remote/fuel baseline),
#4 (confidence ranges) still open.

---

### 2026-06-27 — Gap fixes: notification i18n + first-load celebration

**Context:** User asked for real gaps / streamlining (not new features — V2 data-moat ideas
saved to memory `v2-data-moat-ideas.md`). Audit found 4 gaps; user chose to fix #2 + #3
(onboarding Skip stays — it's intentional for review, removed at launch; #4 daily-hook entry
point folded into redesign).

**#2 — Notification copy localized.** All 12 hardcoded English notification strings (weekly
P&L, IFTA, load-in-progress, fuel, goal 100%/75%) moved into a new `notifications.*` i18n
block in en/es/pa/zh (at parity). `notifications.ts` now resolves them via `i18n.t()` (instance,
not hook, since these fire from background/scheduled contexts). Goal notifications interpolate
`{{net}}/{{period}}/{{goal}}/{{remaining}}` with a localized period label (`periodWeek`/`periodMonth`).

**#3 — First-load celebration (activation moment).** New `FirstLoadCelebration.tsx` modal fires
once, the first time a driver ever logs a load — shows their true net pay big, with copy that
frames it as "what the load really pays after every real cost" plus the user-requested accuracy
nudge: "Log every load and expense to keep your numbers this accurate." Gated by a once-ever
`first_load_celebrated` setting; detected in `AddLoadScreen.handleSave` (count===0 pre-save),
surfaced via new `onFirstLoad` callback → Dashboard renders the modal after a 400ms delay so the
Add Load sheet finishes dismissing first (iOS double-modal safety). New `firstLoad.*` i18n block
in all 4 languages. Verified live in Playwright (rendered $2,347, all copy resolved, dismiss clean).

**Verification:** `tsc --noEmit` → 0 errors. JSON parity across all 4 languages confirmed.

---

### 2026-06-27 — V1 audit sprint: TypeScript clean-up + Playwright smoke test + i18n fix

**TypeScript:** Fixed 0→5 type errors in `src/db/database.ts`. Root cause: `import { db } from './sqlite'`
could not be resolved because only `sqlite.native.ts` and `sqlite.web.ts` existed — no `sqlite.ts`
for `tsc` to find. Created `src/db/sqlite.ts` as a resolution stub (re-exports from `sqlite.native`).
Metro ignores it at bundle time (prefers `.native.ts`); TypeScript uses it for type checking.
Result: `tsc --noEmit` → **0 errors**.

**Playwright smoke test (web build):** Started Expo web server, walked through:
- ✅ Welcome/language picker — renders correctly, live language switching works
- ✅ Walkthrough — all 4 slides render in web (horizontal pager degrades to scroll on web)
- ✅ Onboarding fuel → expenses → miles → result — all 4 steps work
- ✅ Profile setup — name, all 9 equipment types (incl. Intermodal + Car Transport), truck#, home base
- ✅ Dashboard (injected via React fiber) — break-even strip, weekly hero $0 (Monday-zero), free usage meter "15 of 15 loads left", "Upgrade to Pro" CTAs
- ✅ IFTA — empty state with disclaimer renders; quarter/year selectors work
- ✅ Paywall modal — triggered from "Upgrade to Pro"; plan picker, pricing, trial note, CTA all render
- ⚠️ `paywall.reason.analytics` was rendering as literal key → **fixed** (see below)
- Web-only warnings: shadow* props (iOS-native, expected), RC no key on web (expected), useNativeDriver (expected)

**i18n fix:** `paywall.reason.analytics` was missing from all 4 translation files. The `analytics`
`PaywallReason` was added to the type and `REASON_CONFIG` in PaywallScreen but the translation key
was never added to the `reason` block. Added to en/es/pa/zh at parity.

**Paywall hard-gate audit (code):** Confirmed `AddLoadScreen.tsx:435` — `if (!isPro && !canLogLoadFree()) { presentPaywall('loadLimit'); return; }` — gate is solid. Load count comes from `getLoadCountThisMonth()` → SQLite count of loads WHERE status != 'cancelled' in the current calendar month.

**Referral program:** Deferred to V2 per user decision.

---

### 2026-06-26 — B4 fix: cross-account data contamination (one source of truth)

**Investigation:** ruled out local duplication (both ExpensesScreen and OnboardingExpenses
use clean delete-all+insert replace semantics; categories align; display filter ==
break-even filter) and ruled out sync duplication (pull replaces, push upserts-by-id then
prunes). Found the real hole in the **session/account reconcile**:

- `signOut()` wipes local data first, so the sign-out → sign-in path is clean. **But a
  session that ends WITHOUT an explicit sign-out** (token expiry / refresh failure) leaves
  local data in place (correct — it's the user's). If a **different** account then signs in
  and its cloud is **empty**, `syncXOnSignIn`'s "push local if cloud empty" rule (needed for
  guest→account consolidation) would shove account #1's data into account #2's cloud —
  cross-account contamination, matching B4's "conflicting data across sessions/accounts."

**Fix — explicit data ownership (the Uber/Partiful model):**
- New `data_owner_id` setting + `claimDataOwnership(userId)` in database.ts. Local data is
  owned by one identity: guest/fresh = unset (''), real account = its uid. On every sign-in
  (and cold-start with a session), claim runs: if local data belongs to a *different* real
  account, it's **wiped before reconcile**; a guest's unclaimed data ('') is preserved so it
  still consolidates onto the first account that claims it.
- Wired into both RootNavigator sign-in paths (init real-session branch + the sign-in
  effect), before the sync calls. `data_owner_id` added to `clearAllUserData` so sign-out /
  guest-reset clears ownership too.
- **Safe for existing users:** owner starts unset, so the first claim never wipes — the
  wipe only fires on a genuine account mismatch.

### 2026-06-26 — V1 polish: dashboard Monday-zero + profile data consumption

- **Goal-hero "Monday-zero" fixed** (`GoalProgressCard`). The hero used to greet a driver
  with a **red 0% bar** at the start of every period (net <= 0 → danger). Now distinguishes
  a *fresh* period (net === 0 → neutral grey bar + momentum copy "Fresh start — log a load
  to get rolling") from an *actual loss* (net < 0 → still red). New `dashboard.goalFresh`,
  all 4 languages. Applies to both hero and compact variants.
- **Profile data now consumed** (we collect it in ProfileSetup; it was previously unused):
  - **Dashboard greeting** — when `profile_name` is set, the header shows "WELCOME BACK" +
    the driver's first name instead of "OVERVIEW / Dashboard". New `dashboard.welcomeBack`,
    all 4 languages.
  - **Add Load equipment default** — `loadType` now defaults to the driver's saved
    `profile_equipment_type` (mapped to a LoadType via `PROFILE_EQUIP_TO_LOADTYPE`;
    carHauler→auto_transport, boxTruck→dry_van, etc.). A Check Load prefill still wins.
- **Intentionally NOT done:** guest-mode removal (user keeps it for review until launch);
  B4 session-data-congruency bug (vague — needs its own investigation, not a blind fix).

### 2026-06-26 — Backend sync audit (resolve memory-vs-plan contradiction)

**Finding:** the code is fully wired — `src/lib/sync/loadsSync.ts` and `fuelSync.ts` both
have complete push / pull (nested select) / sign-in reconcile, covering loads +
state_mileage + load_expenses + fuel_entries. The stale "only expenses wired" note was an
out-of-date MEMORY.md index hook (the memory file itself was already correct). MEMORY.md
index line corrected.

**Real risk found + fixed:** the sync migrations were *incremental* `ADD COLUMN` patches
against a base schema not in the repo, so column parity with the ~30-column loads push
couldn't be proven. A missing remote column → upsert error → and since every sync caller
is fire-and-forget, it would **fail silently** (a driver's data quietly never reaching the
cloud). Couldn't verify against live Supabase from here, so eliminated the risk instead:
- **`supabase/migrations/2026-06-26_sync_schema_parity.sql`** — idempotent
  `ADD COLUMN IF NOT EXISTS` for **every** column the client pushes, across loads /
  state_mileage / load_expenses / fuel_entries. Purely additive (never alters/drops, can't
  change a type or break rows); makes the remote schema a provable superset of the client.
  **USER must apply** (added to §5.7 A2).
- Confirmed the local-only `loads.rate_contributed` flag is correctly NOT synced.

### 2026-06-26 — Fair Market data moat: Slice 3 (contribution flywheel)

**Goal:** show drivers they're building the network (the Waze "you're helping" loop) and
frame the reciprocity so they keep sharing — this is what drives the volume that makes the
Slice 1 tiers light up.

- **`getRateContributionCount()`** (database.ts) — local count of `loads` with
  `rate_contributed = 1`: how many of the driver's own loads power the pool. Works offline.
- **`getNetworkReportCount()`** (rateReports.ts) — async Supabase `count` of reports in the
  90-day window (the network-wide total). Returns null when offline/unconfigured so the UI
  hides that figure. (Counts reports, not drivers — the table is anonymous by design.)
- **Settings "Rate Network" card** (above the existing share toggle, in Data & Privacy):
  two stats — "loads you've shared" + "loads in the network" — plus a reciprocity blurb
  that changes with the toggle state: when ON, frames each completed load as helping others
  spot lowballs and sharpening their own community rates; when OFF, nudges them to turn it
  on to build the network and unlock sharper rates on their lanes. All 4 languages.
- This completes the **3-slice Fair Market moat pass**. The crowdsourced rate network is
  now: visible at low density (Slice 1), trustworthy/poison-resistant (Slice 2), and
  self-reinforcing (Slice 3). Remaining is purely **volume over time** + the enterprise
  aggregation/licensing layer (far-future, per enterprise-strategy).

### 2026-06-26 — Fair Market data moat: Slice 2 (data integrity — protect the asset)

**Goal:** make the crowdsourced pool trustworthy enough to eventually license — no
double-counting, no garbage values, no outlier skew.

- **Dedup + completeness (idempotent contribution).** Found that AddLoad fired
  `contributeRateReport` on every completed save (no guard), while `LoadDetailScreen`
  edits never contributed at all — so a load completed via a *status change* was missed,
  and re-saving an AddLoad load could double-count. New design contributes **exactly once
  per load, when it first becomes completed**, regardless of screen:
  - Local schema: `loads.rate_contributed INTEGER DEFAULT 0` (ALTER in the migrations
    block) + `markLoadRateContributed(id)`; `getLoadById` now selects the flag.
  - New `maybeContributeLoadRate(loadId)` in `rateReports.ts` — checks status=completed,
    not-yet-contributed, opt-in, valid states/miles/pay; sets the flag **before** firing
    the async insert (prefers under-counting to double-counting). Wired into **both**
    AddLoad save and LoadDetail save; the old inline call was removed. Anonymity preserved
    (the flag is local-only; `rate_reports` still has no load_id/user_id).
- **Server-side sanity bounds.** Migration `2026-06-26_rate_reports_integrity.sql` adds
  CHECK constraints (`NOT VALID`, so legacy rows are untouched): pay_per_mile 0.30–20.0,
  total_pay 50–100000, miles 1–6000. **USER must apply.** Mirrored by client-side guards
  in `contributeRateReport` (defense in depth + protection before the migration lands).
- **Outlier resistance.** The displayed range is already the IQR (25th–75th pct), which
  ignores tails; additionally `fetchPpms` now filters values outside the sane $/mi envelope
  so pre-constraint garbage can't skew even the median.
- **Next (deferred):** Slice 3 = contribution flywheel ("you're building the network" +
  opt-in nudge) to drive the volume that makes the tiers light up.

### 2026-06-26 — Fair Market data moat: Slice 1 (density activation + community-as-hero)

**Goal:** make the crowdsourced rate network (the real moat) *visible and honest at low
scale*. The pipes already existed (`rate_reports` table, anonymous contribution on
completed loads, percentile `getCommunityRate`), but the match was exact-lane-only
(origin state × dest state × type × band, ≥3 in 90d) → nearly every lane returned null
until massive scale, so the seeded formula carried everything.

- **`src/lib/rateReports.ts` rewritten** — `getCommunityRate` now **cascades** from
  specific to broad, holding the **distance band fixed** (so per-mile rates stay
  comparable) and only widening **geography**:
  1. `exact` — state→state + type + band (≥3 reports)
  2. `corridor` — region→region + type + band (≥5) via a US state→freight-region map
     (west / midwest / south / southeast / northeast)
  3. `national` — type + band, any geography (≥8)
  Returns a new `tier` field so the UI shows confidence. Aggregation switched to
  **per-mile percentiles × this trip's miles** (25/50/75) so reports with differing
  mileage within a band normalize cleanly. At most 2–3 short, indexed queries,
  short-circuiting at the first tier that clears its threshold.
- **`CheckLoadScreen` + `AddLoadScreen`** — when community data exists it now **leads as
  the headline Fair Market number**, with the seeded model shown beneath as a labeled
  `est.` range; the community line shows a **tier-specific confidence label** ("N drivers
  ran this exact lane / this corridor / similar loads"). When no community data, the
  formula shows with an `est.` tag so the real-vs-estimate hierarchy is always explicit.
- **i18n** — `rateInsights.tierExact/tierCorridor/tierNational` + `estTag`, all 4 languages.
- **Migration** `supabase/migrations/2026-06-26_rate_reports_type_band_idx.sql` — index on
  `(load_type, distance_band, reported_at DESC)` for the national tier. **USER must apply.**
- **Deliberately NOT done:** seeding `rate_reports` with formula estimates to fake density
  (would poison the authenticity that is the moat). Formula stays an explicit fallback.
- **Next (deferred):** Slice 2 = data integrity (one-report-per-load dedup, server-side
  sanity bounds, outlier trimming). Slice 3 = contribution flywheel ("you're building the
  network"). Both flagged for a follow-up pass.

### 2026-06-26 — Onboarding restructure + dashboard hero + monetization completion

**A. Pre-dashboard flow restructured (closes §5.5 walkthrough "STILL PENDING").**

- **Welcome page** — `LanguagePickerScreen.tsx` rebuilt from a bare language list into
  a real first-run welcome: "Welcome to TruckerNet" hero + slogan + a tappable language
  dropdown (bottom-sheet Modal) that switches the **entire app language live** via
  `i18n.changeLanguage` (title/slogan/label/button all re-render on select) + a Next
  button. New `welcome.*` i18n namespace, all 4 languages. Default slogan: "Know exactly
  what every load pays — and run your truck like the business it is." (workshop candidate).
- **Driver profile setup** — new `src/screens/onboarding/ProfileSetupScreen.tsx`: name
  (required), equipment type (9 selectable chips incl. **Intermodal Container** +
  **Car Transport**), truck number (optional), home base city + 2-char state (optional).
  Writes `profile_name` / `profile_equipment_type` / `profile_truck_number` /
  `profile_home_base` settings. New `profile.*` i18n namespace, all 4 languages.
- **Auth moved AFTER onboarding** — `RootNavigator.tsx`: new flow is
  `Language(Welcome) → Walkthrough → Fuel → Expenses → Miles → Result → Profile Setup →
  Sign Up → App`. Walkthrough "Get Started" now routes to `onboarding_fuel` (was
  `signup`); result screen → `profile_setup`; profile → `signup` (or `app` for guest).
  The session effect now marks the per-user onboarding flag and runs
  `syncExpensesOnSignIn` post-auth (onboarding data is captured before a user ID exists,
  then pushed once they sign up). `clearAllUserData()` extended to wipe the 4 profile keys.

**B. Dashboard hero restructured.** Break-even was the static hero — demoted because it
  rarely changes and doesn't deserve daily focus.
- **Hero is now income-goal progress** (`GoalProgressCard` new `variant="hero"`: big net
  number + % + progress bar + "$X to go · N days left"). When **no goal is set**, a
  **weekly-net fallback hero** shows `+$net`, and a verdict line fusing the constant in:
  `$1.94/mi · +$0.51 above break-even` (computed from week gross ÷ week miles vs break-even).
- **Break-even demoted to a slim reference strip** (tappable → Expenses), showing
  `BREAK-EVEN $1.430/mi · FUEL CPM $x · FIXED CPM $y`.
- `getWeekPnL()` / `getMonthPnL()` extended to return `miles` + `loads` (new `PeriodPnL`).
- New `dashboard.*` keys (goalToGo, weekEmpty, above/belowBreakEven) + `common.load/loads`,
  all 4 languages. **Open follow-up:** goal hero shows an empty/0% bar early in a period
  (the "Monday-zero" problem) — needs momentum framing, not a red zero.

**C. Monetization completion pass.** Audit finding: monetization was already ~85% built
  (RevenueCat fully wired in `SubscriptionContext`, gates enforced at all call sites,
  conversion-grade `PaywallScreen`). Closed the three real gaps:
- **Free usage meter** — new `src/components/FreeUsageMeter.tsx`. Renders nothing for Pro.
  Full-card variant on Dashboard (above Check Load) + compact banner atop Add Load.
  Shows "X of 15 loads left this month", bar shifts green→amber(≤5)→red(0), taps to the
  `loadLimit` paywall. The missing free→paid lever (urgency before the wall, not a surprise
  block at load #16). New `freeUsage.*` namespace, all 4 languages.
- **Dynamic pricing** — `SubscriptionContext` now loads the live offering and exposes
  `pricing` (localized `priceString` + numeric `price`). `PaywallScreen` uses real store
  prices and **computes** the per-month equivalent + savings badge ("SAVE 29%" not a
  hardcoded "$122"). Falls back to defaults in Expo Go. `priceLike()` reuses the store's
  currency symbol so $/€/£ format without relying on Hermes Intl. Fixes an App Store
  rejection risk (hardcoded prices). `annualMonthly` + `saveBadge` made interpolated.
- **Trial eligibility** — `SubscriptionContext` checks
  `checkTrialOrIntroductoryPriceEligibility` per plan → `trialEligible`. When the selected
  plan is no longer trial-eligible the CTA flips to "Subscribe", the gift note hides, and
  the subtext drops "then". Defaults to eligible; degrades gracefully on SDK error. New
  `paywall.ctaSubscribe` + `paywall.ctaPriceLine`, all 4 languages.
- **⚠️ Caveat:** dynamic pricing + trial eligibility **cannot be verified in Expo Go** —
  they only exercise on a real dev/TestFlight build with configured products. Written
  defensively; verify on a real build. The remaining blocker to revenue is **store config,
  not code** — see §5.6.

### 2026-06-25 — Income goal tracker + V1 bug audit

**Income goal tracker built (V1 item: "Income goal tracker"):**

- **`src/db/database.ts`** — new helpers: `getIncomeGoal()`, `setIncomeGoal()`, `getGoalMilestonesHit()`, `markGoalMilestoneHit()`, `goalPeriodKey()`. Goal stored as `income_goal_amount` + `income_goal_period` settings. Milestone tracking uses `income_goal_milestones` + `income_goal_milestone_period` (ISO week or YYYY-MM key) so notifications only fire once per period. All goal settings cleared on `clearAllUserData()`.

- **`src/lib/notifications.ts`** — new `checkAndNotifyGoalMilestone(currentNet, goal)`. Fires an immediate notification at 75% ("75% of your goal — keep going! 🎯") and 100% ("Goal reached! 🎉") of the net pay goal for the period. Only fires each milestone once per period (new week/month resets automatically).

- **`src/components/GoalProgressCard.tsx`** — new component. Progress bar card: WEEKLY GOAL / MONTHLY GOAL eyebrow, fill bar (teal when on track, amber when < 50%, danger when net ≤ 0), current/goal amounts, days left in period. Shows "Goal reached! 🎉" when net ≥ goal.

- **`src/screens/DashboardScreen.tsx`** — `incomeGoal` added to `DashData` (read from `getIncomeGoal()` in `readDashData()`). `GoalProgressCard` renders between the period cards and the Check Load CTA when a goal is set.

- **`src/screens/SettingsScreen.tsx`** — new "Income Goal" section between Break-Even and Language. Inline edit (same pattern as Weekly Miles): taps to show a period toggle (Weekly | Monthly) + dollar amount input + save/cancel. Displays current goal or "Not set".

- **`src/screens/AddLoadScreen.tsx`** — after saving a completed load, checks the goal and calls `checkAndNotifyGoalMilestone` (best-effort, fire-and-forget).

- **i18n** — 12 new keys under `dashboard.goal*` and `settings.goal*`, all 4 languages at parity.

**V1 bug audit (no code changes — found these were already fixed):**
- B1 (Add Load status defaults to "completed"): `useState(null)` + placeholder text + save guard at line 390. Fixed.
- B2 (Demo data flash): All screens use synchronous lazy init. No DEMO constants remain. Fixed.
- B3 (Onboarding formula): `setMonthlyFixed(getTotalMonthlyExpenses())` is called in `useEffect`. Fixed.
- B4 (Per-session data congruency): ✅ Fixed 2026-06-26 — `data_owner_id` ownership model (see Work Log "B4 fix").
- Fuel receipt OCR: Fully built — `FuelEntryScreen` has "Scan receipt" button wired to `scanFuelReceipt()` which auto-fills dollars, gallons, state. Edge function exists. User needs to deploy: `supabase functions deploy ocr-fuel-receipt` + `supabase secrets set ANTHROPIC_API_KEY=...`

### 2026-06-25 — UI Diagnosis: Full Onboarding + Dashboard Review

**Method:** Playwright MCP is now operational for browser-based UI inspection.
Web SQLite is mocked via a no-op stub (`src/db/sqlite.web.ts`) so the app renders
without crashing in Playwright. Native Expo Go / iOS / Android SQLite remains
completely unchanged (`src/db/sqlite.native.ts` → real `expo-sqlite`).

Every screen was walked in order: Language → Sign In → Onboarding Steps 1–4 →
Dashboard → Fuel tab + Log Fill-up → IFTA → Expenses → History → Check Load →
Add Load → Settings → Paywall modal. Load Detail is the only screen not yet
inspected — it requires a persisted load which is not possible via the web no-op DB.

---

#### Critical (fix before any user sees it)

| # | Screen | Issue |
|---|--------|-------|
| C1 | All screens | **Every `@expo/vector-icons` icon is blank on web.** The icon font does not load in the web bundle. Affects every tab icon, every button icon, every form icon — ~50+ blank boxes across the entire app. Single root cause. |

---

#### High Severity

| # | Screen | Issue |
|---|--------|-------|
| H1 | Language | Logo monogram renders as a bare `"T"` character (15×26px) — looks like a typo, not a logo |
| H2 | Language | No selected-state visible on language options — no checkmark, border, or highlight shows which language is active |
| H3 | Onboarding Step 2 (Expenses) | Page is **1,679px tall** — nearly 2× the viewport. Next button is at y=1,585, completely off-screen with no scroll hint |
| H4 | Onboarding Step 4 (Result) | `"How we calculated this:"` has literal opening and closing quotation marks in the copy — looks like a copy-paste artifact from code |
| H5 | Onboarding Step 4 (Result) | On web: all values show `—` because no data persists through the no-op DB. The user just filled in 3 screens and sees blank results — anticlimactic. On native with real DB this resolves, but worth guarding |
| H6 | Onboarding Step 4 (Result) | Tip text "Add your expenses and miles to calculate your break-even rate" is shown to every user including those who just completed all 3 steps. Should only show when all steps were skipped |
| H7 | Expenses tab | Page is **1,796px tall** — same extreme scroll problem as onboarding expenses. "Save Expenses" button is at y=1,711 |
| H8 | All screens | No max-width constraint. Mobile 375px layouts stretch to 1,152px on a 1,200px desktop viewport — everything looks uncomfortably wide |
| H9 | Settings | Language section layout broken: "English" (selected) renders as a full-width settings row with chevron; other languages (Español, ਪੰਜਾਬੀ, 中文) render as smaller inline text items with no matching structure |

---

#### Medium Severity

| # | Screen | Issue |
|---|--------|-------|
| M1 | Language | "Continue" button is 70×20px — plain unstyled text, easy to miss on a large screen |
| M2 | Sign In | Apple SSO logo icon blank (renders as just the word "Apple"); password eye-toggle icon blank |
| M3 | Sign In | "Sign In" button is 53×20px — same tiny text pattern |
| M4 | Onboarding Step 1 (Fuel) | Step icon is blank (32×35px empty box); repeats on every onboarding step |
| M5 | Onboarding Step 1 (Fuel) | No visual progress indicator — "Step N of 4" is plain text only, no bar or dots |
| M6 | Onboarding Step 1 (Fuel) | Button label inconsistency: Step 1 (Fuel) says "Skip" when empty, "Next" when filled. Step 3 (Miles) says "Next" even when empty. No consistency across steps |
| M7 | Onboarding Step 1 (Fuel) | ~320px dead vertical gap between content (y≈450) and Next button (y=771) |
| M8 | Onboarding Step 2 (Expenses) | All expense input fields default to `"0"` — users must clear zero before typing. Should be empty with placeholder |
| M9 | Onboarding Step 2 (Expenses) | Frequency dropdown looks like a static label — "Monthly" text with blank chevron, not obviously interactive |
| M10 | Onboarding Step 2 (Expenses) | No "Skip" affordance — Step 1 had Skip, Step 2 doesn't. A user with no expenses must scroll 1,679px to advance |
| M11 | Onboarding Step 4 (Result) | "Start Tracking →" button has a literal `→` in the text AND a separate (blank) arrow icon element — double arrow on native |
| M12 | Dashboard | FAB "+" button is 26×29px blank — empty-state copy says "Tap +" but the + is invisible |
| M13 | Dashboard | Settings icon in header is blank (19×22px) |
| M14 | Dashboard | Break-even hero card shows `—` (em-dash) with no fallback prompt to set up break-even |
| M15 | Check Load | Close/X icon in header is blank; location pin icons in address fields are blank |
| M16 | Check Load | "Accept & Log This Load" — no visible verdict/result card shown in the form (no break-even rate to compare against in web) |
| M17 | Add Load | Page is **1,539px tall** in a modal dialog — significant scrolling required |
| M18 | Add Load | Inline paywall card (IFTA state mileage gate) mid-form has a tiny "Upgrade to Pro" button (102×17px). Interrupts the form flow |
| M19 | Add Load | "Scan BOL to autofill" scan icon blank; "Add details" disclosure icon blank; date nav arrows blank |
| M20 | Fuel tab | "CPM TREND — LAST 0 FILL-UPS" — "LAST 0" reads awkwardly. Should hide the count or say "No data yet" when empty |
| M21 | Fuel Entry | Odometer field shows placeholder `"487,892"` — suspicious specific default, looks like hardcoded test data |
| M22 | IFTA | Year navigation arrows blank; quarter tab hit areas appear small (text is 17×17px, though actual tap zones may be larger) |
| M23 | Settings | "Push Notifications" and "Share load data anonymously" switches are `[checked] [disabled]` on web — users can't toggle them, no explanation why |
| M24 | Settings | Guest Mode icon renders as `"?"` (11×24px) — appears to be a missing icon |
| M25 | All screens | Browser tab title shows `undefined` throughout the entire app |
| M26 | Paywall | **"Start 7-Day Free Trial" CTA is below the fold.** Content is 1,141px tall; CTA sits at y=949 with an 843px viewport — users must scroll to find the buy button |
| M27 | Paywall | CTA button is 165×20px — same tiny unstyled text pattern. Highest-stakes tap in the app deserves a full-width solid button |
| M28 | Paywall | All 6 feature list icons are blank (18×20px each); DRIVER PRO logo icon blank |
| M29 | Paywall | "BEST VALUE" (63×11px) and "SAVE $122" (52×11px) badges are 11px tall — nearly invisible |
| M30 | Paywall | "UNLOCKS" badge on first feature is 48×11px — identifies which feature is the key free-to-Pro unlock, but at 11px it's unreadable |
| M31 | Paywall | No clear visual distinction between the selected Annual row and the unselected Monthly row — no border, highlight, or checkmark visible |
| M32 | Paywall | "Secure payment" and "Cancel anytime" trust-badge icons are blank (12×14px) |

---

#### Low Severity / Polish

| # | Screen | Issue |
|---|--------|-------|
| L1 | Onboarding Step 3 (Miles) | Subtitle copy is weak: "We'll calculate your monthly miles from this" — doesn't explain WHY miles matter (break-even CPM) |
| L2 | Onboarding Step 3 (Miles) | Live calc format inconsistency: Fuel shows `$2600` + `/ mo` as separate styled nodes; Miles shows `10,833 mi / mo` all in one string |
| L3 | Onboarding Step 4 (Result) | `$—.———` placeholder uses 5 dashes after decimal — confirm intended format is `$X.XXX` (3 decimal RPM) |
| L4 | Fuel tab | `TOTAL GALLONS` shows `"0.0"` with quotes in accessibility tree — minor rendering oddity |
| L5 | History tab | Calendar date grid renders correct 7-column layout, but each column is ~157px wide on 1,200px viewport — tiny date numbers in huge columns |
| L6 | History tab | Week/Month/All Time filter tabs have no visible selected state in snapshot |
| L7 | Expenses tab | "Other expenses" custom row has structurally different layout from the preset expense rows — inconsistent card pattern mid-scroll |
| L8 | Dashboard | "Check Load" row has blank icons on both sides (left icon + right chevron) |
| L9 | Onboarding Step 2 / Expenses tab | All expense category icons blank (12 blank slots on the expenses screen) |
| L10 | Add Load | Deduction quick-add chips (Scale, Lumper, Toll, Detention, Other) all have blank `+` icons — text labels still readable |

---

#### Priority Summary

**Fix first (blocking visual quality for any demo or user test):**
- C1 — Fix `@expo/vector-icons` rendering on web (single root cause, high impact)
- H8 — Add `maxWidth` + `alignSelf: 'center'` on root containers (one-line fix, affects every screen)
- H4 — Remove literal quote marks from "How we calculated this:" copy
- H2 — Add selected state to language picker
- H9 — Fix Language section row structure in Settings

**Fix before user testing:**
- H3, H7 — Extreme scroll on Expenses screens (onboarding + tab): consider collapsing preset fields or paginating
- H5, H6 — Break-even result screen tip text logic
- M11 — Double arrow on "Start Tracking →"
- M5 — Add visual step progress dots to onboarding
- M25 — Set document title properly on web
- M26, M27 — Paywall CTA below fold + tiny button: this is a direct conversion killer

**Polish pass (after above):**
- M6 — Consistent Skip/Next label logic across onboarding steps
- M7 — Remove dead vertical gap on Step 1
- M8 — Empty inputs (remove zero defaults)
- M20 — Fix "LAST 0 FILL-UPS" label
- M21 — Investigate `487,892` odometer default
- M28–M32 — Paywall visual polish (icons, badge sizes, plan selection state)
- L1 — Improve miles step subtitle copy
- L3 — Confirm $X.XXX format is intentional

**Not inspected (requires persisted load, not possible via web no-op DB):**
- Load Detail screen — needs native Expo Go or a real device session

---

#### Infrastructure notes
- Playwright MCP is working. Web inspection is available for all future sessions.
- `src/db/sqlite.web.ts` is a no-op stub — all reads return `null`/`[]`, all writes are silent. Native DB is untouched.
- `App.tsx` wraps in `<SafeAreaProvider>` — required for web; no effect on native.
- `.playwright-mcp/` is in `.gitignore`.
- Load Detail is the one screen that cannot be reached via web (no persisted loads). Inspect on device.

### 2026-06-23 — Crowdsourced fair-market rate engine (Waze model)

**The core feature:** when a driver saves a completed load, TruckerNet anonymously
contributes that lane's pay to a community pool. Any driver who later evaluates the
same lane sees real reported rates from real drivers — not just the seeded model.

**What was built:**

- **`supabase/migrations/2026-06-23_rate_reports.sql`** — new `rate_reports` table
  (origin_state, destination_state, load_type, distance_band, total_pay, pay_per_mile,
  miles, reported_at). No user_id — fully anonymous. Indexed for fast lane queries.
  RLS: authenticated insert + select.

- **`src/lib/rateReports.ts`** — three exports:
  - `shouldShareRateData()` — reads `share_rate_data` setting (on by default = opt-out)
  - `contributeRateReport()` — fire-and-forget insert on load save (completed status
    only; skipped for guests/unconfigured Supabase/sharing off)
  - `getCommunityRate()` — queries Supabase for matching lane reports in the last 90
    days; returns P25/P50/P75 pay; returns null if < 3 reports (too sparse to show)

- **`src/db/database.ts`** — new `getPersonalLaneHistory()`: queries local `loads`
  table for completed loads on same origin_state + destination_state + load_type.
  Returns count, avgPay, lastPay, lastDate. Free for all users (it's their own data).

- **`src/utils/marketRates.ts`** — exported `getDistanceBand()` and `DistanceBand`
  type (were private; needed by rateReports.ts).

**UI wiring:**

- **CheckLoadScreen** — personal history card appears between load-type dropdown and
  result card as soon as both endpoints are selected (free + Pro). Inside the result
  card, community rates row appears below the fair-market range (Pro only), showing
  "N drivers on this lane · $low–$high" pulled from Supabase.

- **AddLoadScreen** — same two cards appear below the fair-market section when both
  endpoints are selected. On save (completed status), fires `contributeRateReport()`
  as a best-effort background call.

- **SettingsScreen** — new "Data & Privacy" section card with a toggle:
  "Share load data anonymously" (on by default). Persisted to SQLite `share_rate_data`.

- **i18n** — new `rateInsights.*` namespace (5 keys) + `settings.dataPrivacy/shareRateData/
  shareRateDataSub` — all 4 languages at 100% parity.

**USER action required:** run `supabase/migrations/2026-06-23_rate_reports.sql`
in Supabase SQL Editor to create the table.

### 2026-06-23 — App Store name + EAS setup + first successful TestFlight build

**App renamed:** `app.json` `name` changed from "TruckerNet" to **"TruckerNet: Driver Finance"**
(original name taken in App Store Connect; "Driver Finance" chosen after exploring options —
broad enough to cover loads, fuel, IFTA, break-even, expenses without boxing into one feature).

**App Store Connect:** User created the app listing manually with name "TruckerNet: Driver Finance",
bundle ID `com.novaboostlabs.truckernet`. RevenueCat product setup was BLOCKED — ASC was
having outages/login issues. Still pending next session.

**Photo processing deployed (USER action complete):**
- `supabase functions deploy ocr-fuel-receipt` + `ocr-bol` deployed
- `ANTHROPIC_API_KEY` secret set
- `supabase/migrations/2026-06-22_loads_bol_photo.sql` run (BOL storage bucket + RLS)

**EAS Build configured:**
- `eas-cli` installed globally, logged in as `novaboostlabs`
- `eas init` → project linked: `@novaboostlabs/TruckerNet`
  (projectId: `8a2525c8-a2ae-4b6f-a0f9-1c9e21f76627`, written to `app.json`)
- `eas build:configure` → generated `eas.json` (All platforms)
- Device registered (user's iPhone 17 Pro) via Website flow

**Build failures & root causes fixed (3 attempts):**
1. `folly/coro/Coroutine.h` not found — root cause: `react-native-reanimated` was
   v3.16.7 but Expo SDK 54 requires v4.x; also `@react-native-async-storage/async-storage`
   (3.1.1 → 2.2.0) and `react-native-get-random-values` (2.0.0 → ~1.11.0) were wrong.
   Fixed with `npx expo install --check`.
2. EAS `"latest"` image was resolving to Xcode 26 beta (iOS 26.4 SDK) — not yet
   compatible with RN 0.81 dependencies. Fixed by pinning:
   `eas.json` → `"image": "macos-sequoia-15.6-xcode-16.4"`.
3. `expo-build-properties` added with `deploymentTarget: "16.0"` (required for
   RN 0.81 / Expo SDK 54).

**First successful build:** preview profile, internal distribution. User enabled
Developer Mode on iPhone (Settings → Privacy & Security → Developer Mode) and app
installed successfully. 🎉

**Pending USER actions (from this session):**
- [ ] RevenueCat: App Store Connect products + Play Console + RC dashboard
  (see `REVENUECAT_SETUP.md`) — was blocked by ASC outage
- [ ] DNS CNAME `truckernet` → hosting
- [ ] Terms & Conditions page at `truckernet.novaboostlabs.co/terms`
- [ ] Privacy Policy page at `truckernet.novaboostlabs.co/privacy`
- [ ] Email alias `truckernet@novaboostlabs.co` in Google Workspace

**Key EAS commands for next session:**
- Preview build (TestFlight/internal): `eas build --platform ios --profile preview`
- Submit to TestFlight: `eas submit --platform ios`
- Production build (App Store): `eas build --platform ios --profile production`

### 2026-06-22 — BOL OCR autofill (extends backlog #5)

User request: same as fuel-receipt OCR but for BOLs — scan the BOL photo, autofill
pickup/delivery/weight/etc., then let the existing geocode→distance→state-split
flow take over. Built. TS clean; 4-language parity held.

- `supabase/functions/ocr-bol/index.ts` — Claude vision (model `claude-sonnet-4-6`,
  denser docs than receipts) extracting `{pickupAddress, deliveryAddress,
  weightLbs, bolNumber, brokerName}` as strict JSON (prompt cached). Same
  `ANTHROPIC_API_KEY` secret as the fuel function.
- `src/lib/ocr.ts` — `ocrBOL(uri)` + `BolData`; exported `pickImage` (shared with
  fuel scan, refactored). Takes a URI (not its own pick) so the same image
  doubles as the attached BOL proof photo.
- `src/lib/mapbox.ts` — `geocodeAddress(query)` (single best match, non-autocomplete)
  to turn OCR'd addresses into routable points.
- `AddLoadScreen` — "Scan BOL to autofill" button at the top. Flow: pick image →
  set as `bolPhotoUri` → OCR → fill weight/BOL#/broker → geocode pickup+delivery →
  set `pickupSel`/`deliverySel`, which triggers the EXISTING auto-route effect
  (route miles + per-state split via Mapbox geometry + Turf). Falls back to plain
  text if a geocode misses (user picks from autocomplete). Scanning state + hint.
- i18n `addLoad.scanBol.*`, all 4 langs.
- Same deploy as below + `supabase functions deploy ocr-bol` (see `PHOTO_SETUP.md`).

### 2026-06-22 — Photo processing: fuel receipt OCR + BOL photos (backlog #5)

Built both image features. User decisions: **Claude vision (cloud) OCR** for fuel
receipts; **fuel image discarded after scan, BOL photos in cloud storage**. All
Expo Go compatible (no native OCR dep); TypeScript clean; 4-language parity held.

**Fuel receipt OCR:**
- `src/lib/ocr.ts` — `scanFuelReceipt(source)`: pick/capture (expo-image-picker) →
  downscale (expo-image-manipulator, added) → base64 → Supabase Edge Function →
  parsed `{dollars, gallons, pricePerGallon, state, date}`. Discriminated result
  (cancelled/permission/not_configured/failed). Image is never stored.
- `supabase/functions/ocr-fuel-receipt/index.ts` — Deno edge fn calling Anthropic
  Messages API (model `claude-haiku-4-5`) with a strict JSON-only system prompt
  (prompt-cached). Key from `ANTHROPIC_API_KEY` secret — never in the app.
- `FuelEntryScreen` — "Scan receipt" button + action sheet + scanning state +
  "review the values" hint. Auto-fills $/gallons/state (derives gallons from
  $÷price if needed). Graceful alerts on permission/not-configured/failure.

**BOL photos (cloud storage):**
- `src/lib/storage.ts` — `uploadBolPhoto(userId, uri)`: downscale → binary upload
  via `expo-file-system/legacy` `uploadAsync` (reliable in Expo Go) to bucket
  `bol-photos` at `{userId}/{uuid}.jpg`; returns public URL.
- `AddLoadScreen` — Attach BOL photo (camera/library) in optional details, thumb +
  remove; uploads on save (guests/failed upload → local URI fallback).
- `LoadDetailScreen` — BOL photo card + full-screen tap viewer.
- DB: added `loads.bol_photo_url` (schema + local migration + threaded through
  `LoadInsert`/`saveLoad`/`LoadRow`/`getAllLoads`/`replaceLoads`/`LoadDetail`/
  `getLoadById` and `loadsSync` push+pull).
- `supabase/migrations/2026-06-22_loads_bol_photo.sql` — adds column + public
  `bol-photos` bucket + per-user-folder RLS (idempotent).
- i18n: `fuel.form.scan.*`, `addLoad.photo.*`, `loadDetail.bolPhoto`, all 4 langs.
- `tsconfig.json` now excludes `supabase/functions` (Deno code, not RN).

**USER must deploy (see `PHOTO_SETUP.md`):** `supabase functions deploy
ocr-fuel-receipt`, `supabase secrets set ANTHROPIC_API_KEY=…`, and run the BOL
migration SQL. Until then: OCR shows "not set up", BOL falls back to local-only.

**Deferred:** OCR receipt date isn't applied (fuel form has no date field — always
today); BOL bucket is public-by-unguessable-URL (can harden to signed URLs later).

### 2026-06-22 — RevenueCat paywall BUILT (mock-first, all gating live)

Built the full Free↔Driver Pro paywall per the finalized strategy. Mock-first:
everything works in Expo Go with a local `isPro` toggle; real RevenueCat calls
get swapped in once the user creates store products. TypeScript clean; all 4
languages at 100% key parity.

**New files:**
- `src/contexts/SubscriptionContext.tsx` — exposes `isPro` (from persisted mock
  toggle `mock_is_pro`), `loading`, `isMock`, `setMockPro`, and stubbed
  `purchase`/`restore`. `react-native-purchases` is deliberately NOT imported (it
  crashes Expo Go) — the real path is a clearly-marked block to wire later.
  Entitlement id = `pro`.
- `src/contexts/PaywallContext.tsx` — `PaywallProvider` renders the paywall Modal
  once at root; any screen calls `usePaywall().present(reason)`. Reasons tailor
  the headline: generic/fairMarket/loadLimit/history/ifta/export.
- `src/screens/PaywallScreen.tsx` — crown badge, feature list (6 Pro features),
  annual/monthly plan picker (annual default, "SAVE $122"), 7-day trial note,
  CTA, restore, legal links. Prices: $34.99/mo · $297.99/yr.
- `src/components/FairMarketLock.tsx` — amber lock row shown to free users where
  the fair-market $ range would be; tap → paywall('fairMarket').
- `src/lib/gating.ts` — `FREE_LOAD_LIMIT = 15`, `canLogLoadFree()`,
  `freeLoadsRemaining()`.
- `REVENUECAT_SETUP.md` — step-by-step guide for the USER (App Store Connect +
  Play Console + RevenueCat dashboard + what to send back).

**Wiring:**
- `App.tsx` — `SubscriptionProvider` > `PaywallProvider` wrap the navigator.
- `database.ts` — added `getLoadCountThisMonth()` (drives the 15-loads/mo gate).
- **Gating triggers (all 5):** (1) AddLoad save blocks the 16th load/mo for free
  → paywall('loadLimit'); (2)+(3) fair-market lock in CheckLoad + AddLoad; (4)
  History back-arrow (past periods) → paywall('history'); (5) IFTA export tap →
  paywall('export').
- **IFTA blur-teaser** — free users see the first 2 states of REAL data, the rest
  + filing totals rendered at 0.12 opacity behind an upgrade overlay (no
  `expo-blur` dep needed). Export gated too.
- **Settings → Subscription section** — upgrade row (free) / Driver Pro active +
  Manage Subscription (deep-links to store sub settings) / Restore Purchases /
  dev-only Mock Pro toggle (auto-hides when `isMock=false`).
- i18n: new `paywall.*` namespace (21 keys) + `ifta.locked*` + `settings`
  subscription keys, all 4 languages, 0 missing / 0 extra.

**Deferred / open:** real RevenueCat swap (waiting on USER store products);
"dashboard current-week only" free limit from the strategy prose was NOT gated —
left the current month/week P&L cards visible as a teaser (flag for user
decision; not one of the 5 explicit triggers). Fleet/Enterprise tiers still
deferred.

### 2026-06-22 — Fair-market rate engine v2 + paywall strategy finalized

**Backlog #7 — Fair-market rate engine rebuilt** (`utils/marketRates.ts`):
- Deep research via subagent (Scale Funding, Nuvocargo, O Trucking, FreightWaves,
  driver forums, BTS/FRED public data).
- Replaced flat lookup table with formula:
  `max(floor, baseline × equipment × distance × seasonal × miles)`.
- **Minimum floors per equipment** — the core fix. 10-mi dry van = $500-$550 floor
  (not $25). Binding under ~200 mi, matching real flat "job pricing" for short hauls.
- Baseline $2.50/mi dry van (2026 spot avg). 7 distance bands (added micro ≤50mi
  @1.85x, local 51-100mi @1.58x). Equipment mults: reefer +20%, flatbed +18%,
  step deck +40%, hazmat +38%, RGN +80%, power only −15%, intermodal −12%.
  Seasonal index auto-applied by month (Oct +20%, Jan −18%).
- Verdict now compares total $ to range (not $/mi) so floor loads score right.
- Update `BASELINE_DRY_VAN` quarterly from Scale Funding free page. TS clean.

**Paywall strategy finalized (NOT yet built — code is next session):**
- Decided full Free↔Pro split, pricing, trial, IFTA teaser, fair-market gating.
- See the **RevenueCat paywall** bullet in §5 Phase 2 for the complete spec, and
  memory file `monetization-paywall-plan.md`.
- Key user decisions: 15 loads/mo free · 7-day trial · $34.99/mo or $297.99/yr ·
  IFTA blurred-teaser · **fair-market price is Pro-gated** (free users see "Upgrade
  to Pro to see what you should be getting paid" in Check Load + Add Load).
- Build approach: mock `isPro` toggle first, real RevenueCat once store products live.
- NEXT STEPS: (1) build SubscriptionContext w/ mock toggle, (2) Paywall screen,
  (3) gating + 5 triggers, (4) IFTA blur-teaser, (5) Restore/manage in Settings.
  Separately: write USER a RevenueCat account+products setup guide doc.


### 2026-06-21 — Session: full app-wide i18n sweep (backlog #9, round 2)
- **Why:** user reported lots of English still showing with Spanish selected
  (onboarding, dashboard cards, etc.). Root cause: the first pass only fixed key
  parity + 2 screens. Seven more screens used **no i18n at all** and several i18n
  screens had leftover hardcoded strings.
- **Screens fully wired to `t()` this round:** DashboardScreen, FuelScreen,
  IFTAScreen, HistoryScreen, SignInScreen, SignUpScreen (these 6 imported no i18n
  before). Leftover hardcoded strings also fixed in: OnboardingFuel/Miles/Expenses/
  Result, ExpensesScreen, FuelEntryScreen, AddLoadScreen — including all validation
  `Alert.alert` messages.
- Added ~120 new keys across 4 languages (en/es/pa/zh) under common/auth/dashboard/
  fuel/fuel.form/ifta/history/expenses/onboarding/addLoad. Total keys now 386,
  all 4 languages at 100% parity (verified 0 missing / 0 extra).
- **Deliberately left in English:** LanguagePickerScreen (shown *before* a language
  is chosen — multilingual by design); unit abbreviations (mi, gal, lbs, MPG, /mi);
  brand names (TruckerNet, Apple, Google); USD number grouping; numeric placeholder
  examples (e.g. "0.00", "TX", "BOL-12345").
- Verified: `tsc --noEmit` clean; automated sweep finds zero remaining hardcoded
  JSX text nodes or Alert string literals across src/screens + src/components.

### 2026-06-21 — Session: backlog #9 (translation audit) complete
- **Structural gap fill:** script-based key diff vs `en.json` found es missing 25
  keys, pa 71, zh 37 (notably pa was missing whole `fuel.form`, `ifta`, `expenses`,
  `settings` sections). Filled all with natural translations; all 4 languages now at
  100% parity (verified 0 missing / 0 extra).
- **Hardcoded-English screens localized:** `LoadDetailScreen.tsx` (used no i18n at
  all) and `SettingsScreen.tsx` (i18n only for the language switcher) were fully
  English. Added a new `loadDetail.*` namespace and expanded `settings.*` across
  en/es/pa/zh, then wired both screens to `t()`. LoadDetail reuses existing
  `addLoad.loadTypes.*` / `addLoad.statuses.*` (status snake_case → camelCase via a
  small `STATUS_I18N` map) and a new `loadDetail.verdict.*`. Settings alerts
  (sign out / delete account / replay), profile card, break-even rows, about rows,
  and language list all localized; language list secondary label now shows each
  language's name in the active UI language.
- **Date locale localized:** added `getDateLocale()` to `lib/i18n.ts` (en→en-US,
  es→es-MX, pa→pa-IN, zh→zh-CN) and swapped all 7 `toLocaleDateString('en-US', …)`
  calls (History ×4, AddLoad, Fuel, LoadDetail) to use it. Number/money
  `toLocaleString('en-US')` calls left as-is (USD stays US-grouped app-wide).
- `tsc --noEmit` clean.

### 2026-06-21 — Session: backlog #10 + History overhaul + autocomplete fix + Add Load polish

**Backlog #10 — Richer History + Dashboard period cards linked:**
- Dashboard "This Week" and "This Month" period cards are now `TouchableOpacity`.
  Tapping either navigates to the History tab with `{ filter: 'week' | 'month' }`
  param pre-selecting the correct filter and resetting to the current period.
- History filter chips renamed: "Week" / "Month" / "All Time" (was "This Week" /
  "This Month" / "All Time") since you can now view any past period.
- Period navigator (`< Jun 16 – Jun 22 >` / `< June 2026 >`) added between filter
  chips and totals card for Week and Month views. Back/forward arrows; forward
  disabled when on current period.
- **Cross-view linking:** switching Week↔Month preserves context — week of May 21
  → tap Month = May 2026; May with Jun 7 selected → tap Week = week of Jun 7.
  `changeFilter()` no longer blindly resets `periodDate` to today.
- **Monthly calendar** (`src/components/MonthCalendar.tsx`): 7-column grid,
  green dot on days with loads, count badge if >1, green circle on selected day,
  today outline ring. Tap day → filters list + totals to that day. Tap X to clear.
- **Weekly calendar** (`src/components/WeekCalendar.tsx`): compact horizontal
  7-day strip (Mo–Su), same dot/count/selected/today pattern as monthly.
- **Load Detail screen** (`src/screens/LoadDetailScreen.tsx`): tapping any load
  row opens a `pageSheet` Modal. Shows: route card (full addresses + miles),
  P&L (gross/net hero, fuel/fixed cost, gross+net RPM, fair-market range), load
  info (equipment, weight, BOL, broker, backhaul, notes), state mileage table,
  status + verdict color-coded pill badges, date.
- **Backlog load date field on Add Load**: `< Sat, Jun 21, 2026 >` navigator at
  bottom of form. Default = today (shows green "Today" pill badge). Left arrow
  goes back one day; right arrow disabled on today. "Back to today" tap link
  appears when on a past date. `LoadInsert.date` optional field added; `saveLoad`
  uses it. New DB helpers: `getLoadById`, `LoadDetail`, `getHistoryLoadsDateRange`,
  `getHistoryTotalsDateRange`.

**Address autocomplete double-tap bug — fixed:**
- Root cause diagnosed: our previous fix (`onBlur` 150ms + `onPress`) introduced
  a race where `onBlur` unmounted the dropdown before `onPress` (touch-UP) could
  fire → `pick()` never ran → text stayed as the partial query ("Phoe").
- Fix: reverted to `onPressIn` (fires on touch-DOWN, before any layout shift or
  unmount can occur). Reverted inner `ScrollView` back to `View`. Kept `onBlur`
  with 150ms delay (harmless with `onPressIn` since `pick()` already runs and calls
  `setFocused(false)` before blur fires; useful for closing dropdown if user taps
  elsewhere without picking).
- Changed outer ScrollViews in `AddLoadScreen` + `CheckLoadScreen` from
  `keyboardShouldPersistTaps="handled"` → `"always"` to eliminate the original
  intermittent miss where keyboard-dismissal was intercepting touches.

**Small polish:**
- Add Load date row: when date = today, shows a green "Today" pill badge. When
  on a past date, shows "Back to today" tap link instead.

### 2026-06-20 — Session: backlog items #2, #4, #6 + fuel improvements + migrations

**Backlog #2 — Auto per-state mileage (Turf.js):**
- Installed `us-atlas@3` (state boundary TopoJSON, 112KB) + `@types/topojson-client`.
- Updated Mapbox Directions call to `overview=full&geometries=geojson` — now returns
  full route geometry alongside distance. Route cache upgraded to store both.
- New `src/lib/stateSplit.ts`: converts TopoJSON → GeoJSON once at startup, walks
  route coordinate pairs, bounding-box pre-filters candidate states, runs
  `turf.booleanPointInPolygon` on each segment midpoint with fast-path cache for
  the previous state. Returns `{state, miles}[]` sorted by miles desc.
- `AddLoadScreen` now calls `getRouteData` (instead of `getRouteMiles`) and pipes
  geometry through `splitRouteByState`. State mileage rows auto-populate from the
  actual route. Falls back to 50/50 address split if geometry unavailable.
- Confirmed: miles are road miles (geometry traces actual roads; summing segment
  distances = total road distance, matches Mapbox's `route.distance`).

**Backlog #4 — Min/max bounds on all inputs:**
- Caps enforced on every numeric field: fuel weekly $ (≤$5K via onChangeText),
  expenses (≤$50K), onboarding miles (≤15K), load pay (≤$100K), load miles (≤15K),
  state miles rows (≤15K), weight (≤80K lbs), fuel dollars (≤$2K alert on save),
  gallons (≤500 alert on save), odometer (≤2M alert on save).
- Onboarding Miles screen (Screen 3): removed "Skip" — button now disabled until
  miles > 0. Miles are required for break-even to mean anything.

**Backlog #6 — Settings screen:**
- `src/screens/SettingsScreen.tsx` built. Opens as `pageSheet` Modal from gear icon.
- Profile card: avatar circle (user initial), email, "Active Account" / "Guest Mode".
- Break-Even section: Monthly Expenses (→ Expenses tab), Weekly Miles (inline edit
  — input + save/cancel appear in-row, no sub-modal), Replay Setup (confirmation).
- Language section: 4 inline selectable rows; switching is instant, persisted to DB.
- About section: App Version.
- Sign Out: amber full-width button with confirmation. Delete Account: small danger
  link with explanation (local clear + sign out; permanent deletion via email).
- Dashboard gear now opens Settings Modal (old Alert removed). "Replay setup"
  removed from ExpensesScreen header (now lives in Settings only).

**Fuel tab improvements:**
- Rolling CPM hero: `getFuelStats()` now uses `SUM($)/SUM(miles)` over last 10
  fill-ups (same weighted formula as `getLatestFuelCPM` used by break-even).
  `rollingCount` field added so FuelScreen shows "Avg of your last N fill-ups".
- First fill-up baseline message: when 1 fill-up exists but CPM = 0 (no miles yet),
  hero shows "First fill-up sets your odometer baseline — log your next fill-up…"
- State picker: replaced chip grid with bottom-sheet Modal, full state names.
- `autoFocus` removed from onboarding fuel + miles inputs (keyboard no longer
  pops automatically on screen mount).

**Onboarding back buttons:**
- `onBack` prop added to screens 2, 3, 4. Wired in RootNavigator:
  Expenses ← Fuel, Miles ← Expenses, Result ← Miles.

**Supabase migrations (all 3 applied):**
- `2026-06-19_user_expenses_sync.sql` — updated to create `profiles` table first
  (was missing; caused ERROR 42P01 on first run). Also adds `weekly_fuel_cost` col.
- `2026-06-19_fuel_entries_sync.sql` — adds `mpg` + `odometer_reading`.
- `2026-06-19_loads_sync.sql` — adds 6 missing columns to `loads`.
- All applied in Supabase SQL Editor 2026-06-20. Schema is now in sync.

### 2026-06-20 — Tab refresh + SecureStore error + all demo data removed
- **SecureStore / auto-refresh error fixed:** Supabase token timer fires in background
  and hit SecureStore while device was locked → "User interaction is not allowed."
  Fix: `keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK` on all SecureStore calls
  + try-catch in getItem (returns null on failure so Supabase retries silently).
- **History / IFTA / Fuel tab refresh fixed:** `useFocusEffect` added to all three.
  Tab bar keeps screens mounted between visits so useEffect doesn't re-run on re-focus.
  Now reloads data every time the tab gains focus.
- **All demo/sample data removed:** DEMO constants deleted from Dashboard, History,
  IFTA, FuelScreen. All screens show real data or proper empty states only.
- **Guest clean-slate enforced:** `enterGuestMode()` now calls `clearAllUserData()`
  before starting the guest flow — blank DB guaranteed every session regardless of
  `has_real_account` flag state.
- **Sign-out moved to Dashboard gear icon** (removed from ExpensesScreen). Gear →
  Alert shows account email + Sign Out. Correct UX location.

### 2026-06-20 — Fix #1 (guest data persistence) + Fix #8 (demo flash + FuelScreen wiring)
**Backlog items #1 and #8 resolved.**

**#1 — Clean slate for every session without an account:**
- `RootNavigator.init()` now clears ALL local user data (`clearAllUserData()`) on
  every cold start when there is no active session AND the device has never had a
  real account. This is enforced by a `has_real_account` flag in settings:
  - Set to `'true'` whenever a real session is detected (cold start or sign-in).
  - Cleared by `clearAllUserData()` on explicit sign-out.
  - When session is null and `has_real_account` is not set → data wiped, sign-in.
  - When session is null and `has_real_account` IS set → session may be temporarily
    expired (offline) → data preserved, routed to sign-in to re-authenticate.
- Guest flow on restart: tap "Explore without account" → fresh onboarding, 
  clean DB every time. No data survives a cold start without an account.
- Simplified sign-out routing: removed the `guest_mode` check (now cleared by
  `clearAllUserData`); always routes to sign-in when session ends.
- `clearAllUserData` updated: also clears `guest_mode` and `has_real_account`.

**#8 — Demo data showing on first paint / FuelScreen never wired:**
- **FuelScreen**: fully wired to real DB. Shows latest CPM (real), avg CPM this
  month, total spent and gallons this month, CPM trend chart (last 5 fill-ups),
  full fill-up history list. DEMO fallback when no fuel entries. Refreshes on save.
  MPG shown in fill-up detail rows.
- **HistoryScreen**: initial state now loaded synchronously (lazy useState) —
  eliminates the DEMO flash on first paint before useEffect fires.
- **IFTAScreen**: same synchronous init fix for first paint.
- Dashboard was already correct (used synchronous init via `readDashData()`).

### 2026-06-20 — Backend deep audit: 5 bugs fixed, 1 UI bug added to backlog
- **Bug fixed — `guest_mode` not cleared on sign-out:** `clearAllUserData` now also
  deletes the `guest_mode` setting. Without this: a user who started as a guest,
  created an account, then signed out would have `guest_mode='true'` still set.
  RootNavigator checks `if (guest !== 'true') setStep('signin')` — so with
  `guest_mode='true'` and `session=null`, it would never route to sign-in. User
  would be stuck on the app screen with no active session.
- **Bug fixed — profile `update` → `upsert`:** `pushExpenses` was calling
  `.update({ weekly_miles })` on the profiles table. If the profile row doesn't
  exist (trigger race condition or edge case), UPDATE silently saves nothing. Now
  uses `.upsert({ id, weekly_miles, weekly_fuel_cost }, onConflict: 'id')` which
  creates the row if missing.
- **Bug fixed — `weekly_fuel_cost` not synced:** The onboarding result screen reads
  `weekly_fuel_cost` directly from SQLite settings (not from fuel_entries). This
  value was never pushed to Supabase, so on a fresh install + sign-in, "Replay
  setup" would always show `—` for FUEL/MO in the formula. Now synced to/from
  `profiles.weekly_fuel_cost`. Added column to migration #1 (not run yet, still
  safe to add). `pullExpenses` now restores it from the profile.
- **Also fixed (from previous audit):** UUID quoting (×3) and sign-out data leak.
  Total bugs found and fixed this session: 5.
- **UI bug added to backlog (§0.6 item #3):** `monthlyFixed` in
  OnboardingResultScreen is declared with useState(0) but `setMonthlyFixed` is
  never called — FIXED/MO always shows `—` in the formula. Backend is not the
  cause; it's a pure UI read bug. Confirmed and added as a note to backlog item #3.

### 2026-06-20 — Backend audit: 2 bugs fixed, 2 limitations documented
- **Bug fixed — UUID quoting in push cleanup (all 3 sync modules):** The `.not('id',
  'in', ...)` queries were wrapping UUIDs in double-quotes (`"uuid"`), which
  PostgREST ignores for UUID columns. The "delete cloud rows no longer in local" 
  cleanup was silently doing nothing. Fixed to `localIds.join(',')` (bare UUIDs).
- **Bug fixed — sign-out data leak:** `signOut()` now calls `clearAllUserData()`
  before ending the Supabase session. Previously, User A's data stayed in SQLite
  after sign-out; if User B (with no cloud data) signed in next, `syncOnSignIn`
  would push User A's data to User B's account. `clearAllUserData()` wipes
  user_expenses, fuel_entries, loads (cascades to state_mileage), and 
  user-specific settings (weekly_miles, weekly_fuel) while preserving language.
- **Limitation documented — no real-time multi-device push:** sync only fires on
  save and sign-in. Data logged on Device A won't appear on Device B until sign-out
  and sign-in. Fix = Supabase Realtime subscriptions (Phase 2).
- **Limitation documented — text vs timestamptz date columns:** local stores dates
  as YYYY-MM-DD text; remote is timestamptz. Works in practice (pull strips the
  time with `.split('T')[0]`), but midnight-timezone edge cases could flip a date
  by one day. Noted; low priority.
- All other aspects audited and confirmed correct: RLS policies, nested state_mileage
  select, syncOnSignIn error guards, IFTA coverage via synced tables.

### 2026-06-19 — Loads ↔ Supabase sync (3rd vertical slice) + UUID migration
- **Decision (user):** use real UUIDs everywhere — the proper distributed-systems
  standard (Uber-tier). Remote `loads.id` is already `uuid`; switching local IDs
  to match instead of changing the remote column type.
- **Local ID migration (runs once at startup):** `initDatabase()` detects any loads
  with legacy `load-<timestamp>` IDs and converts them to real UUIDs, updating
  `state_mileage.load_id` FK in lockstep with FKs temporarily disabled.
- **`saveLoad()` updated:** now calls `uuidv4()` for all new loads.
- **Migration (user runs — 3rd pending):**
  `supabase/migrations/2026-06-19_loads_sync.sql` — adds 6 missing columns to
  remote `loads` (`pickup_address`, `delivery_address`, `is_backhaul`, `status`,
  `benchmark_fair_pay_min/max`). `state_mileage` remote schema already correct.
- **New module:** `src/lib/sync/loadsSync.ts` — `pushLoads` (upserts loads, then
  delete+re-inserts state_mileage per load, removes cloud-only loads), `pullLoads`
  (one round-trip via Supabase nested select `loads(state_mileage(*))`), 
  `syncLoadsOnSignIn`. Boolean columns coerced (SQLite 0/1 ↔ Postgres boolean).
- **DB helpers:** `getAllLoads`, `getAllStateMileage`, `replaceLoads`, `LoadRow`,
  `StateMileageRow`.
- **Wired:** AddLoadScreen save → `pushLoads`; RootNavigator sign-in →
  `syncLoadsOnSignIn` (alongside expenses + fuel).
- TypeScript clean. **Pending user action:** run the migration SQL (3rd migration).

### 2026-06-19 — Fuel ↔ Supabase sync (2nd vertical slice)
- Next slice after expenses; chosen for lowest risk — local fuel ids are already
  real UUIDs (match remote `uuid` PK), so only 2 columns needed adding remotely.
- **Migration (user runs):** `supabase/migrations/2026-06-19_fuel_entries_sync.sql`
  — adds `mpg` + `odometer_reading` to remote `fuel_entries`. Idempotent.
- **New module:** `src/lib/sync/fuelSync.ts` — `pushFuel`, `pullFuel`,
  `syncFuelOnSignIn` (same shape/safety as expensesSync). Pull normalizes remote
  timestamptz `date` back to local `YYYY-MM-DD`.
- **DB helpers:** `getAllFuelEntries`, `replaceFuelEntries`, `FuelEntryRow`.
- **Wired:** FuelEntryScreen save → `pushFuel`; RootNavigator sign-in →
  `syncFuelOnSignIn` (alongside expenses).
- Note: FuelScreen *list/hero* still shows DEMO — that display-wiring is a separate
  task (like Dashboard/History were), not part of sync. Fuel DATA is real (entry
  form writes SQLite; break-even reads it), so syncing it is meaningful now.
- TypeScript clean. **Pending user action:** run the migration SQL.

### 2026-06-19 — Expenses ↔ Supabase sync (local-first vertical slice)
- **Decisions (user):** scope = expenses only (vertical slice); model = local-first
  (SQLite is source of truth, push on save, pull on login). Prove this pattern,
  then replicate to loads/fuel/IFTA.
- **Finding:** before this, the app synced *nothing* to Supabase (auth only); the
  remote `schema.sql` had no `user_expenses` table and was stale for loads/fuel.
- **Migration (user runs):** `supabase/migrations/2026-06-19_user_expenses_sync.sql`
  — adds `public.user_expenses` (+ RLS, mirrors local) and `profiles.weekly_miles`.
  Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
- **New module:** `src/lib/sync/expensesSync.ts` — `pushExpenses` (upsert local →
  cloud, delete cloud rows no longer local, store weekly miles on profile),
  `pullExpenses` (cloud → local restore), `syncExpensesOnSignIn` (pull; if cloud
  empty, push local up so guest→account loses nothing). All wrapped: a network
  failure never throws/blocks; guests + unconfigured Supabase are no-ops.
- **Guard:** `isSupabaseConfigured()` added to `lib/supabase.ts`; client no longer
  uses `!` non-null assertions on env.
- **Wired:** ExpensesScreen save → `pushExpenses`; onboarding completion →
  `pushExpenses`; RootNavigator sign-in transition → `syncExpensesOnSignIn`.
- TypeScript clean. **Pending user action:** run the migration SQL, then test
  save-on-device-A → login-device-B restore.

### 2026-06-19 — Expenses tab unified on `user_expenses` (release blocker cleared)
- **Bug fixed:** the Settings Expenses tab wrote to the legacy `fixed_expenses`
  table, but `calcBreakEven()` / `getTotalMonthlyExpenses()` read from
  `user_expenses` — so editing expenses in Settings had zero effect on break-even.
  Same with its miles field (break-even reads `weekly_miles` from settings).
- Rewrote `ExpensesScreen.tsx` to mirror onboarding: essentials (truck, insurance,
  maintenance, eld, loadboard, parking) with per-row frequency dropdowns + dynamic
  "Other" rows. Loads existing values from `user_expenses` (matches essentials by
  category, rest → Other), saves via `replaceUserExpenses()`.
- Monthly-miles field reads/writes `weekly_miles` (× 4.333) via new
  `getWeeklyMiles()` / `setMonthlyMiles()` so it actually drives Fixed CPM.
- DB helpers added: `getWeeklyMiles`, `setMonthlyMiles`, `getUserExpenses`,
  `replaceUserExpenses`, `UserExpenseRow`.
- Dropped the legacy Supabase sync to `fixed_expenses` (onboarding is local-only;
  revisit with full Supabase sync). Kept the "Replay setup" button.

### 2026-06-19 — IFTA wired to real DB + CSV export
- `IFTAScreen.tsx`: aggregates `state_mileage` (joined to loads by date) +
  `fuel_entries` gallons per state, per quarter. Year nav (back/forward, capped at
  current year). Export CSV via native `Share` sheet. DEMO fallback when no loads;
  per-quarter empty state once real data exists.
- DB helpers: `getIFTAData(year, q)`, `hasIFTAData(year, q)`, `IFTARow`.

### 2026-06-19 — History wired to real DB
- `HistoryScreen.tsx`: week/month/all filters query real loads; totals
  (gross/net/miles/avg RPM) computed from DB. DEMO fallback when empty; empty state
  when a filter returns nothing. DB helpers: `getHistoryLoads`, `getHistoryTotals`.

### 2026-06-19 — Dashboard wired to real DB (DEMO fallback)
- `DashboardScreen.tsx`: break-even always real; week/month P&L + recent loads from
  DB when loads exist, DEMO sample data when empty (preserves demo-ability).
  Active-load card shows when a load is `in_progress`. Refreshes on Add Load save.
- DB helpers: `getLoadCount`, `getWeekPnL`, `getMonthPnL`, `getRecentLoads`,
  `getActiveLoad`.

### 2026-06-19 — Add Load screen built (Flow 3)
- `src/screens/AddLoadScreen.tsx` — full Add Load flow:
  - Pickup + delivery with `AddressAutocomplete` (Mapbox); auto-mileage fires when both endpoints are selected.
  - State mileage breakdown: pre-filled from pickup/delivery address states (50/50 split if different states), fully user-editable, +/- row controls, live total-vs-route validator.
  - Live net pay preview card (same `calcBreakEven` engine as Check Load), fair-market range row.
  - Load type dropdown, load status dropdown (Upcoming / In Progress / Completed / Cancelled), backhaul toggle.
  - Collapsible "Add details" section for weight, BOL#, broker name/MC, notes.
  - Saves to `loads` + `state_mileage` tables via new `saveLoad()` in `database.ts`.
- `src/db/database.ts` — added `saveLoad()`, `LoadInsert`, `StateMileageInsert` exports.
- `DashboardScreen` — FAB now opens Add Load; `onLogLoad` from Check Load pre-fills and opens Add Load.
- `CheckLoadScreen` — `onLogLoad` callback now passes `AddLoadPrefill` data (pay, miles, addresses, load type, backhaul) instead of calling a no-arg callback.
- Translations — added missing `addLoad.*` keys (`status`, `statuses`, `backhaul`, `netPayPreview`, `brokerName`, `brokerMC`, etc.) to es/pa/zh.
- TypeScript: `tsc --noEmit` passes clean.

### 2026-06-19 — Onboarding completion is now per-account
- Replaced the global `onboarding_completed` flag with a per-user key
  `onboarding_completed:<userId>` (`onboardingKey()` helper). One account's
  progress can no longer leak to another, and any stale global flag is ignored.
- All four call sites (init, sign-in effect, replayOnboarding, onComplete) use
  the per-account key; `replayOnboarding` now depends on `session`.

### 2026-06-19 — Onboarding gated on having a real account
- Onboarding now counts as "done" only when a real account (Supabase session)
  exists. Guests ("explore without an account") re-run onboarding on every
  launch until they sign up.
- `RootNavigator`: init routes to onboarding unless `!!session && flag==='true'`;
  `enterGuestMode` always goes to onboarding; `OnboardingResult.onComplete`
  persists `onboarding_completed` only `if (session)`.
- Note: the flag is global. An install that set it as a guest *before* this
  change can carry a stale `true`; it's neutralized for guests (session gate) and
  self-corrects once a guest finishes onboarding (no longer writes the flag).

### 2026-06-19 — Address autocomplete polish: first-tap select, error surfacing
- AddressAutocomplete: suggestions fire on `onPressIn` so a pick registers on
  the first tap (the keyboard-dismiss layout shift was eating `onPress`). This
  also made endpoint coords reliably set, so auto-mileage actually runs.
- CheckLoadScreen: routing errors are no longer swallowed — logged to Metro
  (`[TruckerNet] Route calculation failed: …`) and surfaced as a warning under
  the miles field.
- Corrected earlier guidance: Mapbox public tokens include Directions by default
  (no separate scope), so a working autocomplete token also works for routing.

### 2026-06-19 — Route caching + dropdown-close fix
- `getRouteMiles` now caches resolved distances in a module-level Map keyed by
  rounded endpoint coords (`routeKey`). Same pickup+delivery lane hits the
  Mapbox Directions API only once per app session. Only successful results are
  cached, so failures/aborts retry cleanly. (In-memory only — persistence across
  app restarts is a possible later upgrade.)
- AddressAutocomplete: dropdown now closes deterministically on selection — gated
  on the field still matching the picked address (`selectedText` ref) instead of
  a race-prone skip-next flag.

### 2026-06-19 — Check Load: Mapbox address autocomplete + auto-mileage
- Provider decision: **Mapbox** (user picked it). One public token does both
  geocoding autocomplete and routing; pure REST so it stays Expo Go compatible.
- `src/lib/mapbox.ts` — `searchAddress()` (Geocoding v6 forward, autocomplete,
  US, house-number level) + `getRouteMiles()` (Directions driving profile,
  meters→miles). Gated on `EXPO_PUBLIC_MAPBOX_TOKEN`; `isMapboxConfigured()`
  lets everything degrade to manual entry if the token is missing.
- `src/components/AddressAutocomplete.tsx` — reusable debounced (300ms),
  abortable type-ahead; suggestions render inline below the field (ScrollView-safe).
- CheckLoadScreen: pickup/delivery use the autocomplete; selecting BOTH endpoints
  auto-fills miles from the route (effect on pickupSel+deliverySel). Miles field
  stays editable as a manual override, shows a calculating spinner then an "Auto"
  badge. Editing an address clears its selection + the auto flag.
- i18n: `checkLoad.autoMiles` added to all 4 langs; backfilled missing Punjabi
  keys (`addressEncourage`, `backhaulHint`, `calculating`).
- `.env.example` added documenting Supabase + Mapbox vars.
- **Setup needed from user:** create a free Mapbox public token (`pk.…`), put it
  in `.env` as `EXPO_PUBLIC_MAPBOX_TOKEN`, restart `npx expo start -c`.
- **Pending:** per-state mileage breakdown (Turf.js + state polygons over the
  route geometry) for IFTA — Mapbox route geometry is available, not yet split.

### 2026-06-19 — Check Load: load-type dropdown + pickup/delivery inputs
- Replaced the single-line horizontal load-type chip scroller with a tappable
  **dropdown** that opens a bottom-sheet `Modal` picker (same pattern as the
  onboarding frequency dropdown) listing all 10 load types.
- Added **Pickup** and **Delivery** address `TextInput`s (with the
  `checkLoad.addressEncourage` accuracy hint). Keys already existed in i18n.
- Addresses are captured but not yet used for routing — that lands with OSRM
  auto-mileage (Flow 3 / Add Load).

### 2026-06-19 — Check Load screen built + Dashboard CTA wired
- Renamed the Dashboard CTA from "Quick Eval — Is This Load Worth It?" to
  **"Check Load — Is This Worth It?"** and gave it an `onPress` (it was inert).
- New `src/screens/CheckLoadScreen.tsx`, opened as a page-sheet `Modal` from the
  Dashboard (same pattern as Fuel → FuelEntry). Manual-miles version (no routing
  yet): inputs = load pay, miles, load type (10 chips), backhaul toggle. Live
  result = verdict badge (green/amber/red), net pay hero, net rate/mi vs
  break-even delta, fair-market total range (`getFairMarketRate`), and a
  backhaul reframe ("Saves ~$X vs driving empty" via `calcDeadheadCost`).
- Net pay / break-even use the real engine (`calcBreakEven` from saved expenses
  + miles + latest fuel CPM). If no break-even is set, shows `checkLoad.noBreakEven`.
- Added i18n `checkLoad.noBreakEven` across en/es/pa/zh. All Check Load keys
  verified to resolve.
- **Pending:** OSRM/address auto-mileage (ties into Add Load / Flow 3); the
  "Accept & Log This Load" button currently just closes — wire it to Add Load
  (prefilled) once that screen exists. The Dashboard FAB (+) is still inert.

### 2026-06-19 — "Replay onboarding" so users can revisit the flow
- Problem: once `onboarding_completed` is set, `RootNavigator` always routes to
  the app; no in-app way to re-see the onboarding screens (and the flag persists
  in SQLite, so an Expo reload doesn't help).
- Added `src/contexts/AppFlowContext.tsx` (leaf module, no import cycle)
  exposing `replayOnboarding()`. `RootNavigator` provides it (clears the flag +
  sets step back to `onboarding_fuel`); the **Expenses/Settings tab** now has a
  "Replay setup" button in its header that calls it.
- Note: the **Expenses tab is a separate legacy screen** writing to
  `fixed_expenses` (truck/insurance/eld/maintenance/parking/other flat columns),
  NOT the onboarding `user_expenses` table. The redesigned onboarding UI is not
  reflected there. **Tech-debt to reconcile:** unify on `user_expenses` so the
  Settings editor matches onboarding.

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
- **Confirmed:** this is the canonical onboarding expenses screen on the
  `claude/truckernet-project-files-khoqlv` branch. Accent is green
  (`#00C896` = `Colors.primary`; amber `#E8A020` is `secondary`). The earlier
  screenshot was a pre-change build (showed the old truncated labels,
  tap-to-cycle frequency, and no Maintenance) — the changes in this commit
  address exactly those issues. After pulling/reloading the Expo build, the
  screen shows full labels, the frequency dropdown, and the Maintenance row.

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
