# TruckerNet — Product Requirements Document (PRD)

**Version:** 2.0
**Product type:** Mobile-first SaaS (native iOS + Android primary; web companion included)
**North Star:** $50,000 MRR
**Prepared for:** Build via Claude Code (primary) and/or Lovable (prototype)

---

## 1. Product Vision

### Vision Statement

TruckerNet is the financial operating system for owner-operator truck drivers. It tells drivers exactly what every load actually pays them after all real costs, automates their IFTA reporting, and gives them the business intelligence to run their operation like a serious company — not a guessing game.

### The Problem

Owner-operators are quoted gross load prices by brokers but have no fast, reliable tool to calculate true net pay after diesel, truck payment, insurance, ELD, maintenance, parking, and fees. Most IFTA reporting is done by hand on spreadsheets. There is no premium, mobile-first, all-in-one financial tool built specifically for this market.

### The Solution

A driver enters a load (origin, destination, offered pay). TruckerNet:

1. Auto-calculates total miles and exact per-state mileage breakdown.
2. Shows a fair-market benchmark for that lane (crowdsourced + seeded data).
3. Calculates true net pay for that load after every real expense.
4. Tells the driver instantly whether the load clears their break-even rate.
5. Automatically builds their IFTA report in the background.
6. Gives them a full business dashboard: weekly/monthly net pay, cost trends, lane profitability, and income goals.

### Target Market

**Primary:** U.S. owner-operator truck drivers (~350,000).
**Secondary:** Small fleet operators (2–5 trucks).
**Tertiary:** Company drivers tracking personal earnings; Canadian owner-operators (future).

### Core Value Proposition

"Know exactly what every load actually pays you — before you accept it. Never do IFTA by hand again. Run your truck like a real business."

---

## 2. North Star & Revenue Milestones

**North Star: $50,000 MRR**

This is not a hobby app. TruckerNet competes in the same category as Calm, Elevate, and YNAB — premium, subscription-first, best-in-class tools people pay for month after month because the value is undeniable. Every product decision should be made with this benchmark in mind.

**MRR Milestone Ladder**

| Milestone | MRR     | Est. Paying Accounts | Timeframe Target      |
|-----------|---------|----------------------|-----------------------|
| 1         | $1,000  | ~35                  | Month 1–2 post-launch |
| 2         | $5,000  | ~165                 | Month 3–4             |
| 3         | $10,000 | ~330                 | Month 5–6             |
| 4         | $25,000 | ~650 (mixed tiers)   | Month 9–12            |
| 5         | $50,000 | ~1,200 (mixed tiers) | Month 18–24           |

At 350,000 U.S. owner-operators, $50,000 MRR requires capturing 0.34% of the market — less than one-third of one percent. This is achievable.

**Key product success metrics**

- Free-to-paid conversion rate: target 12–15%.
- Monthly retention: target 85%+ (churn below 15%).
- Daily active use of Quick Eval (the core engagement hook).
- Average loads logged per active user per week.
- Net Revenue Retention (NRR): target 100%+ via tier upgrades.

---

## 3. User Personas

**Persona 1 — "Carlos" — The Independent Owner-Operator**
Owns one truck. Finds loads on DAT or through broker relationships. Knows he's leaving money on the table but has no clean tool. Drives 10–14 hours/day. Will pay for anything that clearly saves him money. Cannot type while driving. Files IFTA quarterly and hates it.

**Persona 2 — "Dana" — The Growing Fleet Operator**
Runs 2–5 trucks, some with hired drivers. Needs to track profitability across multiple units. Higher willingness to pay. Needs fleet dashboard, per-driver reporting, and combined IFTA.

**Persona 3 — "Miguel" — The Dispatcher / Small Carrier**
Runs 6–20 trucks. Needs enterprise controls, driver management, and accounting exports. Custom pricing candidate.

---

## 4. Core Feature: True Net Pay Per Load (THE CORE)

### Description

For any load, calculate the driver's real take-home pay after every real cost. This is the single most important feature. All other features serve this.

### User inputs

- Pickup city + state
- Delivery city + state
- Equipment type (dry van, reefer, flatbed, tanker, other)
- Gross pay offered
- Weight (lbs) — optional
- BOL / reference number — optional
- Deadhead toggle (empty miles, unpaid)
- Additional per-load costs: tolls, scale fees, lumper fees — optional

### System auto-calculates

- Total miles (OSRM routing engine)
- Per-state mileage breakdown (Turf.js + US state GeoJSON)
- Fuel cost for this load
- Fixed cost allocation for this load
- Per-load additional costs
- True net pay
- Gross and net rate per mile
- Fair market benchmark comparison

### Exact calculation logic

```
fixedCostPerMile     = (truckPayment + insurance + eldPayment
                        + maintenanceMonthly + parkingMonthly
                        + otherMonthly) / estimatedMonthlyMiles

currentFuelCostPerMile = costPerMile from most recent FuelEntry
                         (fallback: user-set default)

fuelCostForLoad      = totalMiles × currentFuelCostPerMile
fixedCostForLoad     = totalMiles × fixedCostPerMile
additionalCosts      = sum of all per-load extra costs entered

netPay               = grossPay − fuelCostForLoad
                       − fixedCostForLoad − additionalCosts

grossRatePerMile     = grossPay / totalMiles
netRatePerMile       = netPay / totalMiles

breakEvenRatePerMile = currentFuelCostPerMile + fixedCostPerMile

Verdict:
  netRatePerMile <= breakEvenRatePerMile          → RED
  netRatePerMile < breakEvenRatePerMile × 1.15    → AMBER (thin margin)
  netRatePerMile >= breakEvenRatePerMile × 1.15   → GREEN
```

### Display

Net pay is the hero number — large, color-coded by verdict. Show full breakdown: gross → minus fuel → minus fixed → minus per-load costs → net. Display benchmark comparison inline.

---

## 5. Core Feature: Automatic Mileage & Per-State IFTA Breakdown

### Description

When origin and destination are entered, auto-calculate total miles AND per-state mileage (e.g., LA → Phoenix = California: 287 mi, Arizona: 163 mi).

### Requirements

- OSRM (free, no API key) for route polyline.
- Turf.js + bundled US Census state boundary GeoJSON for state mileage intersection.
- Handle deadhead/return trips identically.
- ALL auto-calculated values are user-editable. Tap any state mileage to override. Flag manually edited fields (isManuallyEdited: true). Auto-calc is the default, never the lock.
- Full manual entry fallback if no connection or routing fails.

---

## 6. Feature: Fair Market Rate Benchmark

### Description

Show the driver what a fair market rate for this lane looks like, so they can negotiate or walk away from a low offer.

### Three-stage data strategy

**Why no scraping:** DAT, Truckstop, and all major load boards prohibit automated scraping in their ToS. Violating this creates legal risk and app store rejection risk. Never build any scraping functionality.

**Stage 1 — Seeded benchmarks (launch):**
Manually seed a rate table using publicly available data (Bureau of Transportation Statistics, FreightWaves public reports, published industry averages). Keyed by equipment type × region. Formula:

```
estimatedFairPay = totalMiles × benchmarkRatePerMile[equipmentType][region]
```

Label clearly as estimate. Update manually every 4–6 weeks.

**Stage 2 — Crowdsourced user data (500+ active users):**
With user opt-in (clearly explained at onboarding), each completed load anonymously contributes: origin state, destination state, equipment type, miles, gross pay, weight, week-of (no exact date). Aggregate these into a live rate database. When enough data points exist for a lane, switch from seeded to crowdsourced average. Show data confidence ("Based on 847 real loads").

This is the Waze model: users contribute data, users benefit from data. Becomes a competitive moat over time.

**Stage 3 — Paid API (post-traction):**
When revenue allows, integrate Greenscreens.ai or negotiate a DAT RateView data partnership for real-time spot rates as a Fleet/Enterprise feature.

### Display

- "Market benchmark: ~$X,XXX ($Y.YY/mi)" alongside broker's offer.
- Color: green if at/above benchmark, red if below.
- Data source label: "Estimate" (Stage 1) or "Based on X real loads" (Stage 2).
- Never guarantee rates. Always benchmark language.

### Privacy

Opt-in only. Plain English disclosure at onboarding. Settings toggle to disable contribution at any time. No PII stored in rate entries.

---

## 7. Feature: IFTA Auto-Tracking & Reporting

### Description

Automatically build the quarterly IFTA fuel-tax report from logged load mileage (per-state) and logged fuel purchases (per-state gallons). This is a flagship differentiator — no clean mobile app does this automatically.

### Requirements

- Aggregate per quarter + per state: miles driven, gallons purchased, state where purchased.
- Pull mileage from load StateMileage[]. Pull gallons from FuelEntry.statePurchased.
- Editable table — tap any cell to override.
- Quarter selector (Q1–Q4 + year).
- Export: CSV (v1), formatted PDF (v2).
- Eventually: support Canadian provinces (IFTA applies to Canada too).

### Mandatory disclaimer (displayed in IFTA tab)

"These figures are estimates based on your logged data. Verify all totals before filing your IFTA return. TruckerNet is not a tax filing service and is not responsible for filing accuracy."

---

## 8. Feature: Fuel Tracking

**Inputs:** dollars spent, gallons, miles driven on that tank, state purchased.
**Calculates:** cost per mile, price per gallon. Feeds IFTA + net pay engine.
**Display:** current CPM (prominent), cost-per-mile trend chart (last 20 entries), fuel history list.
**OCR:** snap a receipt photo → auto-extract dollars, gallons, date, state (NVIDIA NIM free-tier vision or device ML Kit). Always confirm before saving.

---

## 9. Feature: Fixed Expenses

**Monthly inputs:** truck payment, insurance, ELD, maintenance/repairs average, parking, other.
**Also input:** estimated monthly miles.
**Calculates:** fixed cost per mile (feeds all net-pay math). Breakdown as % of total.
**Design note:** make this feel like setting up a business, not a form. Onboarding guides the user through it step by step.

---

## 10. Feature: Quick Eval (Daily Hook)

The fastest load evaluation possible. Must be the lowest-friction action in the entire app.

- Accessible from Dashboard + home-screen shortcut widget (iOS 16+ widget support).
- Two inputs: offered pay + miles. Voice input on both.
- Real-time result as user types: large green ✓ or red ✗, net pay, rate/mile, vs break-even delta.
- "Log This Load" → pre-fills Add Load screen.
- Free tier: Quick Eval is **unlimited** (this is the primary hook that converts free → paid).

---

## 11. Feature: Voice Input

- Microphone button on every text/number field.
- Device-native speech recognition (free, offline, fast).
- Future: full natural-language load entry ("Load from Dallas to Houston, paying two grand, dry van") parsed into all fields automatically using on-device NLP or Claude API.

---

## 12. Feature: Dashboard & Business Intelligence

### Dashboard

- Break-even rate (hero, always visible).
- Current fuel CPM + fixed CPM.
- This week's net pay + vs last week (trend arrow).
- This month's net pay + vs last month.
- Income goal progress bar (user sets weekly/monthly targets).
- Recent loads list (last 5) with verdict colors.
- Quick Eval button + Add Load FAB.

### Analytics (Pro+)

- Net pay trend: weekly/monthly line chart over time.
- Cost breakdown pie: fuel vs fixed vs per-load.
- Lane profitability: which origin→destination pairs make the most money for this driver.
- Best day/week of year (seasonal patterns as data accumulates).
- Average gross vs net per load over time.
- Miles driven vs miles paid (deadhead ratio).

---

## 13. Feature: History & Load Management

- All loads, most recent first.
- Filters: This Week / This Month / Custom range / By state / By equipment.
- Totals header: gross, net, miles, avg rate/mile, load count.
- Tap load → full detail + edit.
- Sort by: date, net pay, rate/mile, miles.
- Search by BOL number, city, or broker name.

---

## 14. Feature: Cross-Device Sync & Web Companion

- Supabase backend (auth + real-time DB) enables seamless sync across the driver's phone, tablet, and computer.
- Web companion app: accessible at truckernet.app (or equivalent). Primarily for desktop use during bookkeeping, IFTA review, and accounting exports. Full feature parity with mobile for data review; add/edit optimized for mobile.
- Offline-first: all core features work without connection. Sync when connection restores.

---

## 15. Feature: Accounting & Export

- IFTA export: CSV (v1), formatted PDF (v2).
- Full load history export: CSV with all fields.
- Monthly P&L summary: one-page PDF showing gross income, total expenses by category, net income. Send to accountant in one tap.
- QuickBooks-compatible export (v3).
- All export features: Pro tier and above only.

---

## 16. Feature: Email Reporting

- Weekly summary email: net pay, loads completed, best load of the week, fuel CPM trend. Sent Monday morning.
- Monthly business report: full P&L, IFTA summary, lane performance, income goal vs actual.
- Quarterly IFTA reminder with pre-filled data.
- Email via Resend (transactional email service, generous free tier).
- All email reports: opt-in, configurable in Settings.

---

## 17. Feature: Smart Notifications (Push)

- Break-even rate change alert (when diesel price shifts significantly).
- Weekly net pay summary.
- Quarterly IFTA due-date reminder (2 weeks + 3 days before).
- Income goal milestone ("You've hit 75% of your monthly goal!").
- Fuel price drop alert near driver's current location (future, location-based).
- All notifications: individually togglable in Settings.

---

## 18. Feature: In-App Referral Program

- "Give a driver $10 off their first month, get $10 off yours."
- Unique referral link per user. Tracked via RevenueCat + Supabase.
- Referred user gets 30-day free trial (instead of standard 7 days) — a meaningful upgrade to the referral.
- Top referrers: recognize in app (optional leaderboard).
- This is the primary organic growth engine. Build it into onboarding, not just settings.

---

## 19. Feature: Maintenance Tracking (Pro)

- Log services: oil change, tire rotation, brake job, DOT inspection, any custom service.
- Track by date and odometer.
- Alert when due: based on mileage intervals or calendar (configurable).
- Maintenance cost feeds monthly expense average automatically.
- Full maintenance history: useful for truck resale value.

---

## 20. Feature: Broker Scorecard (Pro)

- When logging a load, optionally tag the broker (name + MC number).
- Rate: payment speed (1–5), reliability, communication.
- Over time: broker performance history for this driver.
- Future: anonymized crowdsourced broker ratings across all TruckerNet users (same privacy model as rate data).

---

## 21. Feature: Fleet Dashboard (Fleet Tier)

- Add and manage multiple trucks (up to 5 in Fleet tier, unlimited in Enterprise).
- Per-truck profitability: net pay, CPM, miles driven, deadhead ratio.
- Combined IFTA report across all trucks in fleet.
- Driver assignment: assign loads/trucks to named drivers.
- Fleet-level income goal and dashboard.

---

## 22. Secondary Revenue Streams

Beyond subscription revenue, TruckerNet has natural partnership opportunities that align with driver needs:

**Truck insurance referrals:** Partner with commercial truck insurance providers (Progressive Commercial, Great West Casualty, etc.). When a driver enters their insurance cost on onboarding, surface an optional "See if you can lower this" CTA. Referral fee per policy quoted/bound.

**ELD referrals:** When a driver enters their ELD provider, offer a comparison. Partner with Motive (KeepTruckin), Samsara, or smaller providers. Referral fee per signup.

**Load factoring referrals:** Many O/Os use factoring companies to get paid immediately. Partner with RTS Financial, OTR Solutions, etc. Surface this in the load detail screen. Referral fee per account opened.

**Diesel fuel card partnerships:** Partner with fuel card programs (TCS Fuel, EFS, Comdata) that offer per-gallon discounts. Present as a value-add to Pro users. Referral or rev-share per signup.

These are non-invasive, genuinely useful to the driver, and add meaningful revenue on top of subscriptions. Secondary revenue could add 20–30% on top of MRR at scale.

---

## 23. Data Models

```
User {
  id: string (Supabase auth UUID)
  email: string
  createdAt: string (ISO)
  subscriptionTier: string ("free" | "pro" | "fleet" | "enterprise")
  revenueCatCustomerId: string
  crowdsourcingOptIn: boolean
  truckCount: number
}

Load {
  id: string
  userId: string
  date: string (ISO)
  pickupCity: string
  pickupState: string (2-letter)
  deliveryCity: string
  deliveryState: string (2-letter)
  equipmentType: string
  totalMiles: number            (auto, editable)
  grossPay: number
  additionalCosts: number       (tolls, lumper, scale fees)
  weightLbs: number
  bolNumber: string
  brokerName: string
  brokerMC: string
  isDeadhead: boolean
  notes: string
  stateMileage: StateMileage[]
  benchmarkFairPay: number      (calculated)
  fuelCostForLoad: number       (calculated)
  fixedCostForLoad: number      (calculated)
  netPay: number                (calculated)
  grossRatePerMile: number      (calculated)
  netRatePerMile: number        (calculated)
  verdict: string               ("green" | "amber" | "red")
  truckId: string               (for fleet users)
}

StateMileage {
  state: string (2-letter)
  miles: number
  isManuallyEdited: boolean
}

FuelEntry {
  id: string
  userId: string
  date: string (ISO)
  dollarsSpent: number
  gallons: number
  milesDriven: number
  costPerMile: number           (calculated)
  pricePerGallon: number        (calculated)
  statePurchased: string (2-letter)
  truckId: string               (for fleet users)
}

FixedExpenses {
  id: string
  userId: string
  truckId: string
  truckPayment: number          (monthly)
  insurance: number             (monthly)
  eldPayment: number            (monthly)
  maintenanceMonthly: number    (monthly average)
  parkingMonthly: number        (monthly)
  otherMonthly: number          (monthly)
  estimatedMonthlyMiles: number
  fixedCostPerMile: number      (calculated)
  updatedAt: string (ISO)
}

Truck {
  id: string
  userId: string
  nickname: string
  year: number
  make: string
  model: string
  vin: string
  dotNumber: string
  isActive: boolean
}

MaintenanceEntry {
  id: string
  userId: string
  truckId: string
  date: string (ISO)
  serviceType: string
  cost: number
  odometer: number
  notes: string
  nextDueMiles: number
  nextDueDate: string (ISO)
}

BrokerEntry {
  id: string
  userId: string
  brokerName: string
  mcNumber: string
  paymentSpeedRating: number (1–5)
  reliabilityRating: number (1–5)
  notes: string
  lastUsed: string (ISO)
}

BenchmarkRate {
  id: string
  equipmentType: string
  originRegion: string
  destinationRegion: string
  ratePerMile: number
  source: string ("seeded" | "crowdsourced")
  dataPointCount: number
  lastUpdated: string (ISO)
}

CrowdsourcedRateEntry (opt-in, anonymous) {
  id: string
  originState: string (2-letter)
  destinationState: string (2-letter)
  equipmentType: string
  totalMiles: number
  grossPay: number
  ratePerMile: number
  weightLbs: number
  weekOf: string (ISO week, no exact date)
}

IncomeGoal {
  id: string
  userId: string
  period: string ("weekly" | "monthly")
  targetNetPay: number
  createdAt: string (ISO)
}
```

---

## 24. Master Calculation Reference

```
fixedCostPerMile     = (truckPayment + insurance + eldPayment
                        + maintenanceMonthly + parkingMonthly
                        + otherMonthly) / estimatedMonthlyMiles

currentFuelCostPerMile = most recent FuelEntry.costPerMile

breakEvenRatePerMile = currentFuelCostPerMile + fixedCostPerMile

For each load:
  fuelCostForLoad    = totalMiles × currentFuelCostPerMile
  fixedCostForLoad   = totalMiles × fixedCostPerMile
  netPay             = grossPay − fuelCostForLoad
                       − fixedCostForLoad − additionalCosts
  grossRatePerMile   = grossPay / totalMiles
  netRatePerMile     = netPay / totalMiles
  benchmarkFairPay   = totalMiles × benchmarkRate[equipment][region]

Verdict thresholds:
  RED    = netRatePerMile <= breakEvenRatePerMile
  AMBER  = netRatePerMile < breakEvenRatePerMile × 1.15
  GREEN  = netRatePerMile >= breakEvenRatePerMile × 1.15
```

---

## 25. Key User Flows

**Onboarding (under 3 minutes):**
Welcome → account creation (Supabase auth) → add truck details → enter fixed expenses step-by-step → enter first fuel purchase → crowdsourcing opt-in (plain language) → referral program intro → dashboard live.

**Evaluate a load offer (under 10 seconds):**
Quick Eval → speak or type pay + miles → green/red verdict → optionally "Log This Load."

**Log a completed load:**
Add Load → origin/destination → auto miles + state breakdown → confirm/edit → pay, weight, BOL → view net pay → save.

**Log fuel:**
Fuel tab → snap receipt (OCR) or manual → confirm → save.

**Quarterly IFTA:**
IFTA tab → select quarter → review aggregated state table → edit if needed → export.

**Refer a friend:**
Profile → Referral → copy link or share → friend gets 30-day trial → you get $10 credit.

---

## 26. Design System

Dark mode only in v1. Premium, minimal, numbers-forward.
Reference feel: Linear, Wise, Stripe Dashboard — applied to a tool for working operators.

```
Colors:
  Background          #0F0F0F
  Surface / cards     #1A1A1A
  Surface elevated    #222222
  Borders             #2A2A2A
  Primary text        #F0EDE8
  Secondary text      #8A8780
  Accent / CTA        #E8A020  (diesel amber)
  Danger / RED load   #D94F3D
  Success / GREEN     #4CAF82
  Amber / AMBER load  #E8A020 (same as accent)
  Link / info         #5B8DEF

Typography (Inter):
  Hero number         40–48pt semibold
  Card number         28–32pt semibold
  Section header      12pt uppercase, letter-spacing 1.5, secondary
  Body                15–16pt regular
  Caption / label     13pt regular, secondary

Rules:
  - Min 20px horizontal padding
  - Cards: #1A1A1A bg, 1px #2A2A2A border, 12px radius
  - No gradients
  - No truck illustrations or stock icons
  - Numbers are the hero — large, clear, immediate
  - Amber FAB on Dashboard
  - Bottom tab: minimal icon + label, amber on active
  - All interactive states have clear pressed/hover feedback
  - Loading states: skeleton screens, not spinners
```

---

## 27. Monetization

All payments via **RevenueCat** (wraps Apple IAP + Google Play Billing).
**Never use Stripe for in-app mobile subscriptions** — App Store rejection.

### Pricing Tiers

**Free**

- 10 load entries/month
- Unlimited Quick Eval
- Basic dashboard (current week only)
- No export, no IFTA, no analytics
- No email reports

**Driver Pro — $34.99/month or $279.99/year (save 33%)**

- Unlimited loads
- Full IFTA tab + CSV export
- Full history + analytics
- Email reports
- Maintenance tracking
- Broker scorecard
- Accounting exports
- Cross-device sync
- Priority support

**Fleet — $89.99/month or $749.99/year (save 30%)**

- Everything in Pro
- Up to 5 trucks
- Fleet dashboard + per-truck reporting
- Combined IFTA across trucks
- Driver assignment

**Enterprise — $229.99/month, custom annual**

- Everything in Fleet
- Unlimited trucks
- Custom onboarding
- Dedicated support
- API access
- QuickBooks integration

### Paywall triggers

- Free user hits 10 loads/month
- Free user taps any export/analytics/IFTA feature
- Show paywall with Pro highlighted, annual plan emphasized ("Most popular").

### Path to $50K MRR (illustrative mix)

```
1,000 Driver Pro (monthly)  × $34.99  = $34,990
200  Fleet                  × $89.99  = $17,998
20   Enterprise             × $229.99 = $4,600
                              Total   ≈ $57,588 MRR
```

---

## 28. Technical Stack & Infrastructure

### Backend (Supabase — used from day one)

- **Authentication:** Supabase Auth (email/password + Apple Sign-In + Google Sign-In)
- **Database:** Supabase Postgres (all user data, loads, fuel, expenses, crowdsourced rates)
- **Real-time:** Supabase Realtime for cross-device sync
- **Storage:** Supabase Storage for receipt photos
- **Edge Functions:** Supabase Edge Functions for server-side rate aggregation and crowdsource processing
- **Row-level security:** all tables locked to authenticated user's own data

### Mobile (primary product)

- Expo SDK (latest stable) + TypeScript
- React Navigation (native stack + bottom tabs)
- expo-sqlite (local cache / offline-first layer)
- OSRM for routing (free, no key)
- @turf/turf + bundled US state GeoJSON for IFTA mileage
- @react-native-voice/voice for voice input
- expo-camera + NVIDIA NIM (free tier) for receipt OCR
- react-native-purchases (RevenueCat) for subscriptions
- React Native Reanimated for animations
- expo-google-fonts/inter for typography
- expo-notifications for push
- PostHog (React Native SDK) for analytics and feature flags

### Web companion

- React + Vite (or Next.js)
- Same Supabase backend
- Responsive, desktop-optimized for bookkeeping and exports

### Supporting services

- **RevenueCat** — subscription management (free under $2,500 MRR)
- **Resend** — transactional email / weekly reports (free tier: 3,000/month)
- **PostHog** — product analytics, funnel tracking, feature flags (free tier: 1M events/month)
- **Sentry** — error tracking (free tier available)
- **Intercom or Crisp** — in-app customer support chat (Crisp has a free tier)

### Infrastructure cost at launch

- Apple Developer: $99/year
- Google Play: $25 one-time
- Supabase: free tier (up to 500MB DB, 2GB storage) → $25/month at growth
- RevenueCat: free under $2,500 MRR
- OSRM + GeoJSON: free
- NVIDIA NIM: free tier
- Resend: free under 3K emails/month
- PostHog: free under 1M events/month
- Sentry: free tier
- Crisp: free tier
  **Total at launch: ~$124 one-time + ~$0/month until meaningful scale**

---

## 29. Development Phases

**Phase 1 — Foundation**
Expo + TypeScript setup. Supabase project init. Auth (sign-up/login). Design system + navigation. Database schema. Fixed Expenses screen (full CRUD).

**Phase 2 — Core Engine**
Fuel tracking. Fixed cost per mile. Break-even calculation. Quick Eval modal (full functionality). Net pay formula engine.

**Phase 3 — Load Logging**
Add Load screen with OSRM miles + Turf.js state breakdown (all fields editable). Benchmark rate display. Net pay calculation live as user types. Dashboard with real data. History tab.

**Phase 4 — IFTA + Exports**
IFTA tab (auto-aggregated, editable). CSV export. Voice input on all fields. Receipt OCR (Supabase Storage + NVIDIA NIM).

**Phase 5 — Growth & Retention**
RevenueCat paywall + free/pro gating. Email reports (Resend). Push notifications. Referral program. Income goal tracker. Onboarding flow polish.

**Phase 6 — Analytics + Polish**
PostHog integration. Sentry error tracking. Maintenance tracking. Broker scorecard. Lane profitability analytics. Skeleton loading states. TestFlight + internal beta.

**Phase 7 — Launch**
App Store + Google Play submission. Web companion (basic). Marketing site (truckernet.app). Soft launch to trucking communities.

**Phase 8 — Scale**
Fleet tier + multi-truck dashboard. Combined fleet IFTA. Enterprise tier. PDF export. QuickBooks integration. Crowdsourced rate data pipeline. Secondary revenue partnerships.

**Phase 9 — Moat**
Load board API partnerships (when revenue justifies). Real-time rate data. Canadian IFTA support. API for third-party integrations.

---

## 30. Go-to-Market

**Founder advantage:** built by a former owner-operator — this is the #1 marketing asset. Lead with it everywhere, always.

**Pre-launch (start now):**
Genuinely participate in trucking communities (r/Truckers, r/owneroperators, major Facebook groups). Answer IFTA questions. Help with load profitability math. Build a name before the app exists. When it launches, you're not a stranger selling something — you're the guy who's been helping for months.

**Launch channels (priority order):**

1. Founder-led short-form video: TikTok, YouTube Shorts, Reels. Real load math. Real receipts. Real numbers. "I was an O/O and this is what I actually made per load." This is the highest-leverage channel.
2. Trucking subreddits — genuine posts, not spam.
3. Trucking Facebook groups (100K+ members each).
4. Trucking podcasts — guest spots.
5. Trade publications: Overdrive Magazine, Land Line Magazine.
6. Affiliate program for trucking YouTubers — 30% recurring commission.
7. Truck stop flyers / QR codes at Pilot, Flying J, Love's (later).
8. Apple Search Ads — target "trucker app", "IFTA app", "owner operator calculator."

**Referral program:** built into the product, introduced during onboarding. 30-day extended trial for referred users drives word-of-mouth within the community.

**One-line pitch:**
"I was an owner-operator. I built the calculator I wish I had. Try it free."

---

## 31. Risks & Mitigation

- **Crowdsourced rate data** requires opt-in, privacy compliance, and time to accumulate. Mitigated by Stage 1 seeded benchmarks and transparent labeling.
- **Never scrape DAT or other load boards.** ToS violation, legal risk, App Store risk.
- **App Store review** takes 1–3 weeks. Build review buffer into launch timeline.
- **IFTA liability** — always disclaim. This is not a tax filing service.
- **Competitive risk** — a well-funded competitor could copy the concept. Counter: move fast, build brand loyalty, founder trust is the moat no one can buy.
- **Marketing consistency** is the real bottleneck post-launch. Treat content creation as a weekly non-negotiable, not an afterthought.
- **Fleet/Enterprise sales** require outbound effort. Plan for a light sales motion at that tier.
- **Churn** is the silent killer of SaaS. Build retention mechanics (notifications, weekly emails, goal tracking) before you need them, not after churn is already high.

---

## 32. Legal & Compliance

- Privacy policy and terms of service required before App Store submission.
- IFTA and tax features must carry clear "estimate / not a filing service" disclaimers.
- Crowdsourced data requires transparent opt-in and privacy policy coverage.
- Secondary revenue partnerships (insurance, factoring referrals) may require disclosure language.
- All financial calculations are decision-support tools. The driver remains responsible for their own filings and load decisions.

---

*TruckerNet PRD v2.0 — North Star: $50,000 MRR*
