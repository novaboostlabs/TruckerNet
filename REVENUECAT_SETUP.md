# RevenueCat Setup Guide — TruckerNet Driver Pro

This is your step-by-step checklist to take the paywall from **mock mode** (what's
built now) to **real, charging subscriptions**. The app already has the full
paywall UI, gating, IFTA blur, and a dev toggle wired — once you finish the steps
below and we flip the code from the mock path to the real RevenueCat path, the
paywall starts taking real money.

> **What "mock mode" means today:** `SubscriptionContext` reads a local toggle
> (Settings → Subscription → "Mock Pro") instead of calling RevenueCat. Flip it to
> test every Pro/Free state in Expo Go without any store products existing.

---

## The product plan we're selling

| | Product ID (suggested) | Price | Trial |
|---|---|---|---|
| Driver Pro — Monthly | `driver_pro_monthly` | **$34.99/mo** | 7-day free |
| Driver Pro — Annual  | `driver_pro_annual`  | **$297.99/yr** (~29% off) | 7-day free |

- **RevenueCat entitlement id:** `pro` (the code checks
  `entitlements.active['pro']` — keep this exact string).
- One **Offering** (e.g. `default`) containing two **Packages**: Monthly + Annual.

---

## Step 1 — Apple App Store Connect (iOS)

1. Go to **App Store Connect → Your App → Subscriptions**.
2. Create a **Subscription Group** (e.g. "Driver Pro"). Both products live in the
   same group so users can up/downgrade between monthly/annual.
3. Add two **Auto-Renewable Subscriptions**:
   - `driver_pro_monthly` — $34.99, 1 month duration.
   - `driver_pro_annual` — $297.99, 1 year duration.
4. On **each** product, add an **Introductory Offer → Free Trial → 7 days**.
5. Fill in the localized display name, description, and a review screenshot
   (Apple requires one — a screenshot of the paywall is fine).
6. **Banking & Tax:** Agreements, Tax, and Banking must be **Active** in App Store
   Connect or products stay in "Missing Metadata" and won't load.

## Step 2 — Google Play Console (Android)

1. **Play Console → Your App → Monetize → Subscriptions**.
2. Create a subscription `driver_pro_monthly`:
   - Add a **base plan** (auto-renewing, monthly, $34.99).
   - Add an **offer → free trial → 7 days**.
3. Create `driver_pro_annual` the same way (yearly, $297.99, 7-day trial).
4. Activate each subscription.

## Step 3 — RevenueCat dashboard

1. Create an account at **app.revenuecat.com** and add a **Project** ("TruckerNet").
2. **Add two apps** to the project: one **App Store** app, one **Play Store** app.
   - iOS: upload your **App Store Connect API key** (.p8) — RevenueCat needs it to
     validate receipts.
   - Android: upload the **Google Play service-account JSON** with the right
     permissions (Play Console → Setup → API access).
3. **Entitlements →** create one called **`pro`**.
4. **Products →** import/add `driver_pro_monthly` and `driver_pro_annual` for both
   platforms, and **attach both to the `pro` entitlement**.
5. **Offerings →** create a `default` offering with two packages:
   - **Monthly** → `driver_pro_monthly`
   - **Annual** → `driver_pro_annual`
6. Copy your two **public SDK API keys** (one per platform) from
   **Project Settings → API Keys**. You'll paste them into the app config.

## Step 4 — Tell me when keys exist

Once Step 3 is done and you have the two public API keys, come back and say
"RevenueCat is ready." I'll then:

1. Add the keys to `.env` (`EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`).
2. Flip `SubscriptionContext` from the mock path to the real RevenueCat path
   (configure SDK, read the `pro` entitlement, wire `purchase`/`restore` to the
   `default` offering's packages, add the customer-info listener).
3. Remove the dev mock toggle from Settings (it auto-hides when `isMock=false`).

> ⚠️ **Native module note:** `react-native-purchases` does **not** run in **Expo
> Go**. To test real purchases you'll need a **development build**
> (`npx expo run:ios` / `eas build --profile development`) and a **sandbox tester**
> account (Apple) / **license tester** (Google). Until then, keep using the mock
> toggle in Expo Go.

---

## Testing the real flow (later)

- **iOS sandbox:** App Store Connect → Users and Access → Sandbox Testers. Sign in
  with the sandbox account on the device's App Store, then run the dev build.
- **Android:** add license testers in Play Console → Setup → License testing.
- Verify: purchase → `pro` entitlement flips on → gates unlock; "Restore
  Purchases" re-grants on a fresh install; trial shows 7 days before first charge.
