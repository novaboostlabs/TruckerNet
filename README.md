# TruckerNet

> Know your real number before you roll.

---

## What Is TruckerNet?

TruckerNet is a premium native mobile app built exclusively for owner-operator truck drivers. It gives drivers a clear, real-time picture of what they are actually earning after every expense — fuel, insurance, truck payments, maintenance, and more.

The app is dark-mode only, numbers-first, and designed to feel like a professional financial tool — not a generic small business app with a truck sticker on it.

Built with Expo (React Native) and TypeScript. Local-first in v1, with cloud sync planned for a later version.

---

## Who It's For

**Primary user:** Owner-operator truck drivers in the United States who are paid per load.

These are drivers who:
- Own or lease their own truck
- Accept loads through brokers or direct shippers
- Pay their own fuel, insurance, truck payments, and operating costs out of pocket
- Are responsible for their own IFTA fuel tax filings each quarter
- Often have no easy way to know if a load is actually profitable before accepting it

TruckerNet is not built for company drivers who receive a fixed salary, fleet managers, or dispatchers.

---

## The Core Problem

Gross pay is a lie.

A driver might accept a load for $2,800 and feel good about it — but after fuel, fixed costs, and time, the real take-home could be $400 or less. Most drivers have no tool that shows them this in real time.

Specifically, TruckerNet solves three problems:

1. **Pre-load decision making** — Drivers need to know if a load is worth taking *before* they accept it, based on their current real costs. Not a guess. Not a rule of thumb.

2. **True net pay tracking** — After completing a load, drivers need to see exactly what they earned after fuel and fixed costs are factored in, broken down clearly.

3. **IFTA compliance** — Owner-operators must file quarterly IFTA fuel tax reports listing miles driven per state and gallons purchased per state. This is tedious and error-prone when done manually. TruckerNet tracks state mileage automatically on every load and aggregates it for filing.

---

## Full Feature Set

### 1. Dashboard

The home screen. Designed so a driver can open the app and understand their financial position in under five seconds.

- **Break-Even Rate card** — large amber number showing the minimum rate per mile the driver must charge to cover all costs. Updates automatically as fuel prices and fixed expenses change.
- Sub-line breakdown showing current fuel cost-per-mile and fixed cost-per-mile separately.
- **This Week** card — total net pay for the current week, color-coded (amber if positive, red if zero or negative).
- **This Month** card — same, for the current calendar month.
- **Recent Loads list** — last 5 loads, each showing route, gross pay, and net pay with color coding.
- **Floating amber "+" button** — quick access to Add Load screen.
- **Quick Eval pill button** — opens the Quick Eval modal without logging a load.

---

### 2. Quick Eval Modal

The hook feature. Lets a driver evaluate any load offer in seconds, before committing.

- Full-screen modal, minimal layout.
- Two inputs: **Load Pay ($)** and **Miles**.
- Voice input button on each field — driver can speak the numbers without typing.
- Real-time result updates as they type:
  - Large green checkmark if the load beats break-even.
  - Large red X if the load is below break-even.
- Displays: net pay estimate, rate per mile, and how far above or below break-even the load is.
- **"Log This Load" button** — pre-fills the Add Load screen with the entered values so the driver doesn't re-type anything.
- **"Close" button** — dismisses without saving anything.

Available on the free tier with no limits. This is intentional — it is the primary feature that demonstrates value and drives upgrades.

---

### 3. Add Load Screen

Where the driver logs a completed or accepted load.

- **Pickup city + state** — text input with US city autocomplete if feasible, otherwise plain text with 2-letter state.
- **Delivery city + state** — same.
- **Auto mileage calculation** — as soon as both origin and destination are entered, the app calls OSRM (Open Source Routing Machine, free, no API key) to calculate total route miles automatically. The result is displayed and is user-editable.
- **State mileage breakdown** — Turf.js combined with a bundled US state boundary GeoJSON file automatically calculates how many miles of the route were driven in each state. Displayed as a list of state rows, each tappable to edit manually. Rows that have been manually edited are flagged visually.
- **Gross pay** — dollar amount for the load.
- **Weight** — load weight in pounds.
- **BOL number** — Bill of Lading reference number.
- **Deadhead toggle** — marks if this is an empty (unpaid) miles leg.
- **Notes** — free text field.
- **Voice input** — microphone icon on every text field. Driver can dictate any value.
- **Live net pay calculation** — shown at the bottom of the screen, updates in real time as fields are filled in.
- **Save Load button** — commits the record to the local database.

---

### 4. Fuel Tab

Tracks fuel costs and calculates the driver's current cost-per-mile for fuel, which feeds directly into every net pay calculation.

- **Log Fuel Entry button** — top of screen.
- **Current cost per mile** — large prominent number. This is the live fuel CPM used in all calculations.
- **Trend chart** — simple line chart showing cost per mile across the last 10 fuel entries.
- **Past fuel entries list** — date, dollars per gallon, CPM, and state of purchase.
- **Log Fuel Entry form:**
  - Dollars spent (total fill-up cost)
  - Gallons purchased
  - Miles driven on that tank
  - State where fuel was purchased (used for IFTA)
  - Receipt photo capture (camera or photo library) with OCR via NVIDIA NIM API to auto-fill fields from the receipt image

---

### 5. IFTA Tab

Automates the most painful part of owner-operator compliance: quarterly IFTA fuel tax reporting.

IFTA (International Fuel Tax Agreement) requires owner-operators to report miles driven per state and gallons purchased per state each quarter. TruckerNet collects this data automatically from every logged load and fuel entry.

- **Quarter selector** — Q1 / Q2 / Q3 / Q4 with year picker.
- **Auto-aggregated table:**
  - Columns: State | Miles Driven | Gallons Purchased | Tax Line (placeholder for v1)
  - Data pulled automatically from all loads and fuel entries in the selected quarter.
- **Editable rows** — tap any row to manually adjust a value if needed.
- **Totals row** at the bottom of the table.
- **Export button:**
  - CSV export in v1
  - PDF export in a future version
- **Disclaimer** displayed at the bottom of the tab: *"These figures are estimates based on your logged data. Verify all totals before filing your IFTA return."*

IFTA export is a Pro-only feature.

---

### 6. Expenses Tab

Where the driver sets up their fixed monthly costs. This data powers the fixed cost-per-mile calculation used in every net pay and break-even computation.

- **Input fields (monthly amounts):**
  - Truck payment
  - Insurance
  - ELD (electronic logging device) payment
  - Other expenses (catch-all)
- **Estimated monthly miles** — the driver's typical monthly mileage.
- **Auto-calculated fixed cost per mile** — displayed live as fields are updated. Formula: `(truck payment + insurance + ELD + other) ÷ estimated monthly miles`
- **Breakdown card** — shows each expense as a percentage of total fixed costs.
- **Save button** — persists to local database. Values are loaded automatically on app open.

---

### 7. History Tab

Full log of all loads, with filtering and summary totals.

- All loads listed, most recent first.
- **Filter bar:** This Week / This Month / All Time.
- **Header totals** for the selected period: total gross pay, total net pay, total miles, average rate per mile.
- **Each row shows:** route (city to city), date, gross pay, net pay (color coded).
- **Tap a row** → full Load Detail screen showing all fields, with an Edit option.

History exports (CSV) are a Pro-only feature.

---

### 8. Settings

Accessible from a header icon on the Dashboard.

- Subscription status (Free vs Pro, renewal date if Pro).
- **Upgrade to Pro button** → opens RevenueCat paywall screen.
- **Restore Purchases button** — for users reinstalling the app.
- Privacy Policy (placeholder link in v1).
- App version number.

---

## Net Pay Formula

```
currentFuelCostPerMile  = dollarsSpent ÷ milesDriven  (from most recent FuelEntry)

fixedCostPerMile        = (truckPayment + insurance + eldPayment + otherExpenses)
                          ÷ estimatedMonthlyMiles

fuelCostForLoad         = totalMiles × currentFuelCostPerMile
fixedCostForLoad        = totalMiles × fixedCostPerMile
netPay                  = grossPay − fuelCostForLoad − fixedCostForLoad

breakEvenRatePerMile    = currentFuelCostPerMile + fixedCostPerMile
```

All values in USD. All distances in miles.

---

## Data Models

### Load
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| date | string | ISO 8601 |
| pickupCity | string | |
| pickupState | string | 2-letter |
| deliveryCity | string | |
| deliveryState | string | 2-letter |
| totalMiles | number | Auto via OSRM, user-editable |
| grossPay | number | |
| weightLbs | number | |
| bolNumber | string | |
| isDeadhead | boolean | |
| notes | string | |
| stateMileage | StateMileage[] | Auto via Turf.js |
| fuelCostForLoad | number | Calculated |
| fixedCostForLoad | number | Calculated |
| netPay | number | Calculated |
| ratePerMile | number | grossPay ÷ totalMiles |

### StateMileage
| Field | Type | Notes |
|---|---|---|
| state | string | 2-letter |
| miles | number | |
| isManuallyEdited | boolean | |

### FuelEntry
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| date | string | ISO 8601 |
| dollarsSpent | number | |
| gallons | number | |
| milesDriven | number | |
| costPerMile | number | dollarsSpent ÷ milesDriven |
| statePurchased | string | 2-letter |

### FixedExpenses
Single record, replaced on each save.

| Field | Type | Notes |
|---|---|---|
| truckPayment | number | Monthly |
| insurance | number | Monthly |
| eldPayment | number | Monthly |
| otherExpenses | number | Monthly |
| estimatedMonthlyMiles | number | |
| fixedCostPerMile | number | Calculated |

---

## Design System

**Dark mode only in v1.**

The aesthetic is premium and minimal — think Linear or Wise, built for a truck driver. No gradients. No truck illustrations. No stock icons. Numbers are the hero of every screen.

### Colors
| Role | Hex |
|---|---|
| Background | `#0F0F0F` |
| Surface / Cards | `#1A1A1A` |
| Borders | `#2A2A2A` |
| Primary text | `#F0EDE8` |
| Secondary text | `#8A8780` |
| Accent / CTA (Diesel Amber) | `#E8A020` |
| Danger (below break-even) | `#D94F3D` |
| Success (above break-even) | `#4CAF82` |

### Typography
- **Font:** Inter throughout
- **Dashboard hero numbers:** 40–48pt semibold
- **Card numbers:** 28–32pt semibold
- **Section headers:** 12pt uppercase, letter-spacing 1.5, secondary text color
- **Body / labels:** 15–16pt regular

### Layout Rules
- Minimum 20px horizontal padding on all screens
- Cards: background `#1A1A1A`, 1px border `#2A2A2A`, border-radius 12px
- Bottom tab bar: icon + label, amber highlight on active tab
- Floating action button: amber, on Dashboard for quick add

---

## Tech Stack

| Package | Purpose |
|---|---|
| Expo SDK (latest stable) | App framework and build tooling |
| TypeScript | Type safety throughout |
| React Navigation | Native stack + bottom tab navigation |
| expo-sqlite | Local database for all data (v1 is offline-first) |
| OSRM | Route distance calculation — free, no API key |
| @turf/turf | Geospatial state-mileage calculation for IFTA |
| US State GeoJSON | State boundary data bundled in app (Natural Earth / US Census) |
| @react-native-voice/voice | Voice input on text fields |
| expo-camera + expo-image-picker | Receipt photo capture |
| NVIDIA NIM API (free tier) | Receipt OCR via vision model to auto-fill fuel entries |
| react-native-purchases (RevenueCat) | In-app subscriptions (iOS + Android) |
| Apple IAP + Google Play Billing | Handled entirely through RevenueCat |
| React Native Reanimated | Animations |
| expo-google-fonts/inter | Inter font |

**Payment rules:** RevenueCat only. No Stripe. No external web payment links.

---

## Monetization

### Free Tier
- Up to 10 load entries per month
- Quick Eval: unlimited (intentional — this is the hook)
- No IFTA export
- No CSV or PDF export

### Pro Tier
- **$29.99 / month**
- **$249.99 / year** (displayed with "Save 30%" badge)
- Unlimited load entries
- Full IFTA tab with export
- Full History with CSV export
- All future premium features

### Paywall Triggers
- Free user attempts to log their 11th load in a month
- Free user taps any export button

Paywall screen shows both monthly and annual options. Annual is visually emphasized.

---

## Storage & Sync

- **v1:** All data stored locally on device using expo-sqlite. No account required. No internet connection required except for OSRM route calculation and NVIDIA NIM receipt OCR.
- **Future:** Cloud sync and multi-device support planned for a later version.

---

## Build Phases

### Phase 1 — Foundation
- Initialize Expo + TypeScript project
- Install all dependencies
- Set up React Navigation (bottom tabs + stack)
- Apply full design system (theme.ts with all colors, fonts, spacing)
- Styled placeholder screens for all 5 tabs
- expo-sqlite database with complete schema
- Fully functional Expenses tab (form, save, load on open, live CPM calculation)

### Phase 2 — Dashboard + Quick Eval
- Break-even rate card
- This Week / This Month net pay cards
- Quick Eval modal with voice input and real-time result

### Phase 3 — Add Load + Fuel
- OSRM integration for auto mileage
- Turf.js + GeoJSON for state mileage breakdown
- Voice input on all fields
- Fuel entry logging with receipt OCR

### Phase 4 — IFTA + History
- IFTA quarterly aggregation and export
- History tab with filters and totals

### Phase 5 — Monetization
- RevenueCat integration
- Free tier limits enforcement
- Paywall screen

### Phase 6 — Polish & Launch
- Animations (Reanimated)
- Edge case handling
- App Store + Google Play submission prep
