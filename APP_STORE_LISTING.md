# App Store Listing — Copy, Screenshots, QA (v1.0.0)

> Paste-ready assets for App Store Connect. Reflects the three core pillars —
> True Net Pay, Fair Market Price, Automatic IFTA — plus the smaller features
> that actually ship. Updated 2026-07-04. Broker Check is NOT mentioned; it's
> shelved (see PROJECT_PLAN.md Work Log 2026-07-04).

---

## Subtitle (30-char max)

```
Net pay + fair market rates
```
(27 chars — fits with room to spare)

---

## Promotional text (170-char max — editable anytime without a new review)

```
Know what a load really pays, whether the rate is fair, and file IFTA without the spreadsheet. The financial co-pilot built by an owner-operator, for owner-operators.
```

---

## Keywords (100-char max, comma-separated, NO spaces after commas)

```
owner operator,IFTA,trucker,freight,fair market,lowball,per mile,net pay,fuel,CDL,dispatch,spot rate
```

---

## Description

```
Know what every load actually pays — and whether the rate is even fair — before you accept it.

TruckerNet is the financial co-pilot for owner-operators, built around the three numbers that decide whether you make money:

1. TRUE NET PAY PER LOAD
Brokers quote you gross. TruckerNet shows your real take-home — after fuel, truck payment, insurance, tolls, lumper fees, and every fixed cost — and tells you instantly whether the load clears your break-even. Check any load in seconds with just the rate and miles. Free and unlimited.

2. FAIR MARKET PRICE (Pro)
Stop wondering if you're being lowballed. TruckerNet shows what a lane actually pays — backed by real loads other drivers ran on that exact lane and corridor, plus your own history ("$0.18 above your usual for this lane"). Now you negotiate from data, or walk away.

3. AUTOMATIC PER-STATE IFTA
Enter pickup and delivery and TruckerNet calculates total miles and the exact per-state breakdown automatically — no manual mileage logs. Your quarterly IFTA report builds itself in the background; export to CSV or PDF for your accountant in one tap. (Estimates for your records — not a tax-filing service.)

AND EVERYTHING ELSE THAT RUNS YOUR BUSINESS
• "Where to Fuel" — the truly cheapest diesel on your route after state fuel taxes (the lowest pump price often isn't the lowest real cost)
• Fuel tracking with automatic cost-per-mile and MPG
• Tax set-aside estimate so a quarterly bill never blindsides you
• Net-pay trends, cost breakdowns, and income goals
• Scan a fuel receipt or bill of lading to auto-fill the details
• A shareable load card for your net numbers
• Works offline, syncs across your devices, and speaks English, Spanish, Punjabi, and Chinese

FREE TO START
Unlimited load checks, break-even, and core tracking are free. Driver Pro unlocks unlimited saved loads, full IFTA export, fair-market data, analytics, and cross-device sync — with a 7-day free trial.

Built by a former owner-operator who was tired of doing this math on a napkin at the fuel island.

—
Subscription: Driver Pro is $34.99/month or $297.99/year after a 7-day free trial. Payment is charged to your Apple ID; auto-renews unless canceled at least 24 hours before the period ends. Manage or cancel in your App Store settings.
Terms: https://truckernet.app/terms · Privacy: https://truckernet.app/privacy
```

---

## Screenshot shot-list (6.7" iPhone, 1290×2796 — display order)

Seed a **Pro** test account with ~3–4 weeks of realistic loads before capturing, so nothing looks empty. Same clean status bar on all six; bold caption band at the top of each frame.

| # | Screen | What to show | Caption |
|---|--------|---------------|---------|
| 1 | Check Load verdict | Green "Worth it": net pay hero, $/mi, above break-even | "Know what a load really pays." |
| 2 | Fair Market Price | Offered rate vs. fair-market range + "X drivers ran this lane" | "Stop getting lowballed." |
| 3 | Dashboard | Populated: week net pay, break-even, recent loads | "Run your truck like a business." |
| 4 | Auto IFTA table | Full per-state breakdown + export button | "Your IFTA builds itself." |
| 5 | "Where to Fuel" | Fuel optimizer showing a state flip + $ savings | "The cheapest pump isn't the cheapest fuel." |
| 6 | Analytics | Net-pay trend + cost breakdown charts | "See where your money goes." |

Screenshot #1 (the verdict card) is the strongest single image — lead with it.

---

## TestFlight QA checklist

Run on a **real iPhone** via TestFlight — purchases and OAuth do not work in the simulator or Expo Go.

**Money / purchase (highest risk)**
- [ ] Paywall shows real localized prices ($34.99 / $297.99), not fallback text
- [ ] "Start 7-Day Free Trial" appears for a fresh sandbox account
- [ ] Purchase completes → Pro unlocks (IFTA table, fair-market data, analytics, unlimited loads)
- [ ] Kill + reopen app → still Pro
- [ ] Delete + reinstall → Restore Purchases brings Pro back
- [ ] Purchase failure (airplane mode mid-purchase) shows a sensible message, not a crash

**Auth**
- [ ] Email sign-up → confirm → sign in
- [ ] Google sign-in works
- [ ] Apple sign-in works

**Core loop**
- [ ] Onboarding: fuel → expenses → miles → break-even result shows a real number → sign up
- [ ] Add a load with real pickup/delivery → miles + per-state breakdown auto-fill
- [ ] Net pay + verdict compute correctly; save it
- [ ] Tap a load in Recent Loads → detail opens; swipe → Edit and Delete both work
- [ ] Log a fuel fill-up → CPM updates; Fuel tab flips from "ESTIMATE" to real data
- [ ] IFTA tab: free user sees the blurred sample teaser; Pro sees the real table + CSV/PDF export works
- [ ] Fair Market: free user sees the upgrade lock; Pro sees the range + community data

**This session's fixes (verify specifically — these regressed before)**
- [ ] Replay Setup (Settings): change an expense + weekly miles → Save → back in app → break-even reflects new numbers → fully quit and relaunch → numbers still hold
- [ ] Settings → Cloud backup row shows a recent "Backed up" timestamp
- [ ] Log a load in the evening → its date is today, not tomorrow

**Cross-device sync**
- [ ] Sign in on a second device (or reinstall) → loads/expenses come back

**Basics**
- [ ] No crash on cold launch; splash is dark (no white flash)
- [ ] Settings → Terms and Privacy open the live truckernet.app pages
- [ ] Settings has a working Delete Account option (Apple requires this)

---

## App Store Connect setup checklist

- [ ] `supportsTablet: false` is in `app.json` (done 2026-07-04) → iPhone-only screenshots needed, no iPad set
- [ ] Support URL: `https://truckernet.app`
- [ ] Privacy Policy URL: `https://truckernet.app/privacy`
- [ ] Privacy "nutrition label": declare — email (auth), location (routing/mileage), usage data (PostHog analytics), crash data (Sentry). No data sold to third parties.
- [ ] Age rating: business/finance tool, no objectionable content — should qualify for 4+
- [ ] Reviewer demo account: provide a seeded login (not empty) in App Review notes so the reviewer sees a full app

---

## Reviewer demo account — setup steps + seed data

**Setup order:**
1. Sign up in the TestFlight build with an email you own (e.g. `appreview@truckernet.app` or a personal alias) + a real password.
2. Confirm via the Supabase confirmation email — same flow every user goes through.
3. Complete onboarding + profile with the values below.
4. Log the loads, then the fuel fill-ups, then the two general expenses — each list is oldest-first.
5. Put the finished email + password into App Store Connect → App Review Information.
6. **Grant this account Pro** in RevenueCat Dashboard → Customers → search by its Supabase user ID → grant the `pro` entitlement (no card charged). Do this LAST, after the account exists, so the reviewer never hits a paywall.

Dates below are given as "days before you enter this data" (e.g. `-24` = 24 days ago) — count back from whatever day you actually do this, oldest first. All loads use Mapbox address autocomplete for pickup/delivery so miles + per-state IFTA split fill in automatically; don't hand-type state mileage.

### Onboarding + Profile

| Field | Value |
|---|---|
| Weekly fuel cost | $700 |
| Weekly miles | 2,500 |
| Truck payment | $1,650/mo |
| Insurance | $600/mo |
| Maintenance | $350/mo |
| ELD | $45/mo |
| Load board | $50/mo |
| Parking | $60/mo |
| Other: "Phone/Data plan" | $80/mo |
| Income goal | $3,000 / weekly |
| Tax rate | 25% (default) |
| Name | Marcus Reyes |
| Equipment type | Dry Van |
| Truck number | T-114 |
| Home base | Dallas, TX |

(Resulting break-even ≈ $0.54/mi — comfortably inside real-world range; don't overthink precision, it just needs to be non-zero and plausible.)

### Loads (enter oldest → newest; "today" = the day you do this)

| # | Day | Pickup | Delivery | Equipment | Gross Pay | Status | Notes |
|---|---|---|---|---|---|---|---|
| 1 | -24 | Dallas, TX | Atlanta, GA | Dry Van | $1,950 | Completed | ~795 mi |
| 2 | -22 | Atlanta, GA | Charlotte, NC | Dry Van | $430 | Completed | ~245 mi, short-haul |
| 3 | -19 | Charlotte, NC | Memphis, TN | Reefer | $1,730 | Completed | ~630 mi |
| 4 | -17 | Memphis, TN | Dallas, TX | Dry Van | $1,060 | Completed | ~450 mi |
| 5 | -14 | Dallas, TX | Denver, CO | Flatbed | $2,250 | Completed | ~790 mi |
| 6 | -12 | Denver, CO | Kansas City, MO | Dry Van | $1,380 | Completed | ~600 mi |
| 7 | -10 | Kansas City, MO | Dallas, TX | Dry Van | $1,100 | Completed | ~500 mi |
| 8 | -8 | Dallas, TX | Houston, TX | Dry Van | $385 | Completed | ~240 mi, **Backhaul toggle ON** |
| 9 | -6 | Houston, TX | New Orleans, LA | Dry Van | $840 | Completed | ~350 mi |
| 10 | -4 | New Orleans, LA | Dallas, TX | Reefer | $1,325 | Completed | ~510 mi. Broker: "Sunbelt Logistics", MC 123456. Add load expenses: Scale $11, Lumper $75 |
| 11 | -2 | Dallas, TX | Atlanta, GA | Dry Van | $1,990 | Completed | ~795 mi |
| 12 | -1 | Nashville, TN | Dallas, TX | Dry Van | $0 | Completed | ~660 mi, **Deadhead toggle ON** (empty reposition) |
| 13 | 0 (today) | Dallas, TX | Atlanta, GA | Dry Van | $1,975 | **In Progress** | ~795 mi — shows the live "Mark Complete" flow |
| 14 | 0 (today) | Atlanta, GA | Charlotte, NC | Dry Van | $410 | **Upcoming** | ~245 mi — shows the "Start Load" flow |

### Fuel fill-ups (enter oldest → newest)

Starting odometer: **412,600** (set this as your very first fill-up's reading, a day or two before load #1).

| # | Day | State | Gallons | $/gal | Amount | Odometer |
|---|---|---|---|---|---|---|
| 1 | -24 | TX | 123 | $3.85 | $473.55 | 413,400 |
| 2 | -21 | LA | 123 | $3.95 | $485.85 | 414,200 |
| 3 | -18 | MS | 123 | $3.75 | $461.25 | 415,000 |
| 4 | -15 | GA | 123 | $3.90 | $479.70 | 415,800 |
| 5 | -12 | CO | 123 | $3.70 | $455.10 | 416,600 |
| 6 | -9 | KS | 123 | $3.65 | $449.00 | 417,400 |
| 7 | -6 | TX | 123 | $3.80 | $467.40 | 418,200 |
| 8 | -3 | TX | 118 | $3.85 | $454.30 | 418,965 |

(This lands MPG around ~6.5, a realistic loaded sleeper-cab figure — don't worry about matching it exactly.)

### General (one-off) expenses — for the History tab

| Day | Label | Category | Amount |
|---|---|---|---|
| -16 | Truck wash + minor repair | Maintenance | $180 |
| -7 | Parking fine | Fine | $75 |
