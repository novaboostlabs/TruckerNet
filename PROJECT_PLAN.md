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

_Last updated: 2026-06-23 — Crowdsourced rate engine built (Waze model). Community rates from `rate_reports` Supabase table (opt-out, anonymous, 90-day rolling, min 3 reports). Personal lane history from local DB. Both surfaces in CheckLoad + AddLoad. Settings toggle. All 4 languages at parity. USER must run migration: `supabase/migrations/2026-06-23_rate_reports.sql`. NEXT: RevenueCat products in App Store Connect → ping to wire real SDK; DNS/Terms/Privacy/email alias._

> **Backend sync state:** Sync is **local-first** — SQLite is source of truth;
> push on save, pull on sign-in. All 3 slices wired: expenses + fuel + loads.
> All 3 Supabase migrations applied 2026-06-20. Schema is in sync.

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

User-reported items (2026-06-19). Captured so nothing is forgotten; **explicitly
deferred** — do not start these until the user calls for them. Newest batch first.

1. **Per-session data congruency / one source of truth.** Expenses page shows
   conflicting info entered across different sessions (e.g. fuel added one session,
   insurance another, now conflicting). Each app session should be a clean slate
   until an account is created; once an account exists, all the user's data
   consolidates onto that one account (the Uber/Partiful model). Tie-in with the
   local-first sync work.
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

## 6. Work Log (newest first)

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
