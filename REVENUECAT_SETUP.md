# RevenueCat Setup Guide — TruckerNet Pro

This is your step-by-step checklist to take the paywall **live**. The app code is
**already fully wired to RevenueCat** — real `configure`, entitlement check,
`purchase`/`restore`, customer-info listener, live offering prices, and trial-
eligibility check all live in `src/contexts/SubscriptionContext.tsx`. Nothing else
needs to change in code except pasting your **live public SDK key**. What remains is
**store + dashboard configuration**, below.

> **Mock fallback (Expo Go only):** `react-native-purchases` is a native module that
> can't load in Expo Go, so there the app automatically falls back to a local toggle
> (Settings → Subscription → "Mock Pro") to test Pro/Free states. On a real
> dev/TestFlight build the real RevenueCat path runs — no code flip required.

> **Canonical identifiers (code + dashboard agree — confirmed 2026-06-26):**
> entitlement identifier **`pro`** (display name "TruckerNet Pro"); the app reads
> `entitlements.active['pro']`. Products **`truckernet_pro_monthly`** +
> **`truckernet_pro_annual`** attached to it. Keep these exact strings everywhere.

---

## The product plan we're selling

| | Product ID | Price | Trial |
|---|---|---|---|
| TruckerNet Pro — Monthly | `truckernet_pro_monthly` | **$34.99/mo** | 7-day free |
| TruckerNet Pro — Annual  | `truckernet_pro_annual`  | **$297.99/yr** (~29% off) | 7-day free |

- **RevenueCat entitlement id:** `pro` (the code checks `entitlements.active['pro']`).
- One **Offering** (mark it **current**) containing two **Packages**: Monthly + Annual.

---

## Step 1 — Apple App Store Connect (iOS)

1. Go to **App Store Connect → Your App → Subscriptions**.
2. Create a **Subscription Group** (e.g. "TruckerNet Pro"). Both products live in the
   same group so users can up/downgrade between monthly/annual.
3. Add two **Auto-Renewable Subscriptions**:
   - `truckernet_pro_monthly` — $34.99, 1 month duration.
   - `truckernet_pro_annual` — $297.99, 1 year duration.
4. On **each** product, add an **Introductory Offer → Free Trial → 7 days**. (Without
   this, the paywall's trial-eligibility check returns no-offer and the CTA shows
   "Subscribe" instead of "Start 7-Day Free Trial".)
5. Fill in the localized display name, description, and a review screenshot
   (Apple requires one — a screenshot of the paywall is fine).
6. **Banking & Tax:** Agreements, Tax, and Banking must be **Active** in App Store
   Connect or products stay in "Missing Metadata" and won't load.

## Step 2 — Google Play Console (Android, later)

1. **Play Console → Your App → Monetize → Subscriptions**.
2. Create a subscription `truckernet_pro_monthly`:
   - Add a **base plan** (auto-renewing, monthly, $34.99).
   - Add an **offer → free trial → 7 days**.
3. Create `truckernet_pro_annual` the same way (yearly, $297.99, 7-day trial).
4. Activate each subscription.

## Step 3 — RevenueCat dashboard

1. Create an account at **app.revenuecat.com** and add a **Project** ("TruckerNet").
2. **Add the apps** to the project: an **App Store** app now, a **Play Store** app
   when Android is ready.
   - iOS: upload your **App Store Connect API key** (.p8) — RevenueCat needs it to
     validate receipts.
   - Android: upload the **Google Play service-account JSON** with the right
     permissions (Play Console → Setup → API access).
3. **Entitlements →** ✅ already created — identifier **`pro`**, display name
   **TruckerNet Pro**.
4. **Products →** ✅ `truckernet_pro_monthly` + `truckernet_pro_annual` attached to
   `pro`. After Step 1 creates them in App Store Connect, confirm RC imports the same
   Product IDs for the iOS app.
5. **Offerings →** create an offering (mark it **current**) with two packages:
   - **Monthly** (RC's standard Monthly package type) → `truckernet_pro_monthly`
   - **Annual** (RC's standard Annual package type) → `truckernet_pro_annual`
   Using the standard Monthly/Annual package types lets the code resolve them via
   `current.monthly` / `current.annual`.
6. Copy your **public SDK API key (iOS)** from **Project Settings → API Keys →
   Public app-specific**.

## Step 4 — Paste the live key into the app

1. In `src/contexts/SubscriptionContext.tsx`, replace the placeholder
   `IOS_API_KEY = 'test_…'` with your **live iOS public SDK key**. (Public SDK keys
   are safe to ship in the bundle.) Set `ANDROID_API_KEY` when the Android app exists.
2. That's the only code change — the entitlement (`pro`), purchase/restore, offering
   prices, and trial logic are already wired and read the key from these constants.

> ⚠️ **Native module note:** `react-native-purchases` does **not** run in **Expo Go**.
> To test real purchases you need a **development build**
> (`npx expo run:ios` / `eas build --profile development`) and a **sandbox tester**
> account (Apple) / **license tester** (Google). In Expo Go the app stays on the mock
> toggle automatically.

---

## Testing the real flow (on a dev/TestFlight build)

- **iOS sandbox:** App Store Connect → Users and Access → Sandbox Testers. Sign in
  with the sandbox account on the device, then run the dev build.
- **Android:** add license testers in Play Console → Setup → License testing.
- Verify on-device:
  - Real **localized prices** render (not the `$34.99 / $297.99` fallbacks) → the
    offering loaded.
  - The **savings badge** computes from the real prices.
  - **"Start 7-Day Free Trial"** shows for a fresh sandbox account; after the trial is
    used, the CTA becomes **"Subscribe"** and the gift note hides.
  - Purchase → `pro` entitlement flips on → every gate unlocks (load limit, IFTA
    export, fair-market, History past periods, analytics).
  - **Restore Purchases** re-grants on a fresh install.
- The legal links must resolve: `…/terms` and `…/privacy` must be live, or Apple
  rejects the subscription.
