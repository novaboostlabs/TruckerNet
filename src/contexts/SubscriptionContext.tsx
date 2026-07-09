import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSetting, setSetting } from '../db/database';
import { useAuth } from './AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// RevenueCat configuration
// ─────────────────────────────────────────────────────────────────────────────

// Live iOS public SDK key from RevenueCat (set 2026-06-29).
const IOS_API_KEY     = 'appl_JvoQxWtuPHFOIitrxyHEVEmGuve';
// Paste the Android public SDK key here once the RevenueCat Android app is
// created and its products are attached to the `pro` entitlement (RC dashboard
// → Project → Apps → Android → API Keys). Everything else in this file is
// already platform-agnostic — this string is the only remaining step.
const ANDROID_API_KEY = '';

// The entitlement IDENTIFIER (not display name) set in the RevenueCat dashboard.
// Dashboard: identifier "pro", display name "TruckerNet Pro", with products
// truckernet_pro_monthly + truckernet_pro_annual attached. Must match exactly —
// the app reads entitlements.active['pro'] to decide isPro.
const ENTITLEMENT_ID = 'pro';

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic import — react-native-purchases is a native module that crashes Expo Go
// at import time. Wrapping in try/catch degrades gracefully to mock mode.
// ─────────────────────────────────────────────────────────────────────────────
let Purchases: any              = null;
let PURCHASES_ERROR_CODE: any   = null;
let INTRO_ELIGIBILITY_STATUS: any = null;
try {
  const rc                 = require('react-native-purchases');
  Purchases                = rc.default ?? rc;
  PURCHASES_ERROR_CODE     = rc.PURCHASES_ERROR_CODE;
  INTRO_ELIGIBILITY_STATUS = rc.INTRO_ELIGIBILITY_STATUS;
} catch { /* Expo Go — native module unavailable, mock mode active */ }

// The RC native module is unavailable in Expo Go, or if autolinking failed.
const NATIVE_MODULE_MISSING = Purchases === null;
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Mock entitlement mode (the Settings dev toggle grants Pro) is DEV-ONLY.
// In a PRODUCTION build we must never enter mock mode — otherwise a failed
// native-module load would silently hand out free Pro. In prod with no module,
// isPro stays false and purchase/restore surface a clear error instead.
const MOCK_MODE = __DEV__ && (IS_EXPO_GO || NATIVE_MODULE_MISSING);

// Public SDK key for the current platform. Empty string until configured — on
// Android this is still blank pending the RevenueCat Android app + Play billing.
const PLATFORM_API_KEY = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PRO_KEY = 'mock_is_pro';

/** A single plan's price, sourced live from the store via RevenueCat. */
export interface PlanPrice {
  /** Localized, store-formatted price string (e.g. "$34.99", "34,99 €"). */
  priceString:  string;
  /** Raw numeric amount, for computing per-month equivalents and savings. */
  price:        number;
  /** ISO currency code (e.g. "USD"). */
  currencyCode: string;
}

export interface Pricing {
  monthly: PlanPrice | null;
  annual:  PlanPrice | null;
}

/**
 * Whether the user can still claim the free trial / intro offer on each plan.
 * Defaults to true (fresh user). Flips to false once the trial has been used,
 * so the paywall never promises a trial it can't deliver. Determined per-plan
 * because a 7-day trial may be configured on one term and not the other.
 */
export interface TrialEligibility {
  monthly: boolean;
  annual:  boolean;
}

export interface SubscriptionContextValue {
  /** True when the user has an active Driver Pro entitlement. */
  isPro:      boolean;
  /** Still resolving entitlement state on cold start. */
  loading:    boolean;
  /**
   * Live store prices from the current RevenueCat offering. Both null until
   * loaded (and in Expo Go / mock mode) — the paywall falls back to defaults.
   */
  pricing:    Pricing;
  /** Per-plan free-trial eligibility (defaults to eligible). */
  trialEligible: TrialEligibility;
  /**
   * True when isPro is driven by the local mock toggle (Expo Go or RC not
   * yet configured). The dev toggle in Settings is hidden once this is false.
   */
  isMock:     boolean;
  /** Dev-only: flip the mock entitlement. No-op in production builds. */
  setMockPro: (value: boolean) => void;
  /** Trigger a purchase flow for the given plan. */
  purchase:   (plan: 'monthly' | 'annual') => Promise<{ error: string | null }>;
  /** Restore previous App Store / Play Store purchases. */
  restore:    () => Promise<{ error: string | null }>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>(
  {} as SubscriptionContextValue
);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
// Pull a PlanPrice out of a RevenueCat package (shape varies; be defensive).
function toPlanPrice(pkg: any): PlanPrice | null {
  const product = pkg?.product;
  if (!product) return null;
  return {
    priceString:  product.priceString ?? '',
    price:        typeof product.price === 'number' ? product.price : 0,
    currencyCode: product.currencyCode ?? 'USD',
  };
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isPro,   setIsPro]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<Pricing>({ monthly: null, annual: null });
  const [trialEligible, setTrialEligible] = useState<TrialEligibility>({ monthly: true, annual: true });
  // Flips true once Purchases.configure() has run — the identity effect below
  // must never call logIn/logOut on an unconfigured SDK.
  const [rcReady, setRcReady] = useState(false);
  // The identity we actually configured/logged in as, so the identity effect
  // can tell "user changed" apart from "same user, first render."
  const configuredUserId = React.useRef<string | null>(null);

  useEffect(() => {
    if (MOCK_MODE) {
      // ── MOCK PATH (dev only: Expo Go or missing native module) ────────────
      try { setIsPro(getSetting(MOCK_PRO_KEY) === 'true'); } catch { setIsPro(false); }
      setLoading(false);
      return;
    }

    // Production build but the native module didn't load — never grant Pro.
    // isPro stays false; purchase/restore return a clear error below.
    if (NATIVE_MODULE_MISSING) {
      console.error('[TruckerNet] RevenueCat native module unavailable in a production build.');
      setLoading(false);
      return;
    }

    // Wait for Supabase auth to resolve before ever configuring RevenueCat, so
    // we can configure AS the real account from the very first call — see why
    // below.
    if (authLoading) return;

    // ── REAL REVENUECAT PATH (dev / production build) ─────────────────────
    async function initRC() {
      try {
        if (!PLATFORM_API_KEY) {
          console.warn(
            `[TruckerNet] RevenueCat: no API key for platform "${Platform.OS}".`,
            Platform.OS === 'android'
              ? 'Set ANDROID_API_KEY in SubscriptionContext.tsx once the RevenueCat Android app + Play Console billing are set up.'
              : '',
          );
          setLoading(false);
          return;
        }
        const apiKey = PLATFORM_API_KEY;

        // Enable verbose logging in dev builds for easier debugging.
        if (__DEV__) {
          Purchases.setLogLevel(Purchases.LOG_LEVEL?.DEBUG ?? 'DEBUG');
        }

        // Configure AS the signed-in account from the start, per RevenueCat's
        // own recommendation for apps with their own auth system. The
        // previous version configured with no appUserID (anonymous), then
        // called logIn(user.id) afterward as a separate step — every single
        // cold launch briefly created (or tried to reuse) a throwaway
        // anonymous identity before aliasing it to the real account. That's
        // the real explanation for "16 new customers appeared in RevenueCat"
        // (roughly one per app relaunch) AND for Pro status racing/flip-
        // flopping (a fetch could land on that anonymous nobody's entitlements
        // instead of the real account's). Passing appUserID directly skips
        // the anonymous identity entirely when we already know who's signed in.
        Purchases.configure({ apiKey, appUserID: user?.id ?? undefined });
        configuredUserId.current = user?.id ?? null;
        setRcReady(true); // identity effect below may now logIn/logOut safely

        // Safe now: we configured AS the correct identity (or explicitly
        // anonymous if no one's signed in), so this reads the right customer.
        const customerInfo = await Purchases.getCustomerInfo();
        setIsPro(customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined);

        // Stay in sync whenever the entitlement changes (e.g. after purchase,
        // restore, expiry, a dashboard grant, or a billing retry).
        Purchases.addCustomerInfoUpdateListener((info: any) => {
          setIsPro(info.entitlements.active[ENTITLEMENT_ID] !== undefined);
        });

        // Load live, localized store prices so the paywall never hardcodes them.
        try {
          const offerings = await Purchases.getOfferings();
          const cur = offerings?.current;
          if (cur) {
            const monthlyPkg = cur.monthly ?? cur.availablePackages?.find((p: any) => p.identifier === 'monthly');
            const annualPkg  = cur.annual  ?? cur.availablePackages?.find((p: any) => p.identifier === 'yearly');
            setPricing({ monthly: toPlanPrice(monthlyPkg), annual: toPlanPrice(annualPkg) });

            // Check whether this user can still claim the intro trial on each plan,
            // so we never promise "7-day free trial" to someone who already used it.
            try {
              const ids = [monthlyPkg, annualPkg]
                .filter(Boolean)
                .map((p: any) => p.product.identifier);
              if (ids.length) {
                const map = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
                const ELIGIBLE = INTRO_ELIGIBILITY_STATUS?.INTRO_ELIGIBILITY_STATUS_ELIGIBLE ?? 2;
                const ok = (pkg: any) =>
                  pkg ? map[pkg.product.identifier]?.status === ELIGIBLE : true;
                setTrialEligible({ monthly: ok(monthlyPkg), annual: ok(annualPkg) });
              }
            } catch (e) {
              console.warn('[TruckerNet] Trial eligibility check failed:', e);
              // Leave defaults (eligible) — better to offer a trial than wrongly hide it.
            }
          }
        } catch (e) {
          console.warn('[TruckerNet] RevenueCat offerings load failed:', e);
        }
      } catch (e) {
        console.error('[TruckerNet] RevenueCat init error:', e);
      } finally {
        setLoading(false);
      }
    }

    initRC();
  }, [authLoading]); // eslint-disable-line

  // ── Tie the RevenueCat identity to the signed-in TruckerNet account ───────
  // Handles the identity CHANGING after the initial configure() above — a
  // sign-out followed by a different account signing in, all within the same
  // app session (no restart, so configure() itself doesn't run again). Skips
  // its own first run when the identity already matches what initRC() just
  // configured with, so a fresh launch doesn't fire a redundant logIn() call.
  //  - a new account starts free (correct, since configure() now uses ITS id);
  //  - the purchasing account keeps Pro across its own devices;
  //  - "Restore Purchases" still re-grants from the device's store receipt on
  //    whichever account runs it (Apple requires restore to always work —
  //    per-Apple-ID sharing is the platform's model, not something we control);
  //  - dashboard-granted entitlements (reviewer demo account) target the
  //    Supabase uid and now actually reach that account.
  useEffect(() => {
    if (MOCK_MODE || NATIVE_MODULE_MISSING || !rcReady) return;
    if ((user?.id ?? null) === configuredUserId.current) return; // no actual change

    (async () => {
      try {
        if (user?.id) {
          configuredUserId.current = user.id;
          const { customerInfo } = await Purchases.logIn(user.id);
          setIsPro(customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined);
        } else {
          configuredUserId.current = null;
          // logOut throws if already anonymous — only call when identified.
          const anonymous = await Purchases.isAnonymous();
          if (!anonymous) {
            const info = await Purchases.logOut();
            setIsPro(info?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined);
          } else {
            setIsPro(false);
          }
        }
      } catch (e) {
        console.warn('[TruckerNet] RevenueCat identity switch failed:', e);
        // Fail closed on identity uncertainty: never leave a previous account's
        // Pro visible to whoever is signed in now.
        if (!user?.id) setIsPro(false);
      }
    })();
  }, [user?.id, rcReady]); // eslint-disable-line

  // ── Mock toggle (dev only, no-op in production) ───────────────────────────
  function setMockPro(value: boolean) {
    if (!MOCK_MODE) return; // guard: dev-only — never mutate real entitlement state
    setSetting(MOCK_PRO_KEY, value ? 'true' : 'false');
    setIsPro(value);
  }

  // ── Purchase ──────────────────────────────────────────────────────────────
  async function purchase(plan: 'monthly' | 'annual'): Promise<{ error: string | null }> {
    if (MOCK_MODE) {
      return { error: 'Subscriptions require a dev or production build — not available in Expo Go.' };
    }
    if (NATIVE_MODULE_MISSING || !PLATFORM_API_KEY) {
      return { error: 'Subscriptions aren’t available on this device yet. Please update to the latest version.' };
    }
    try {
      const offerings = await Purchases.getOfferings();
      const current   = offerings.current;
      if (!current) return { error: 'No offerings available. Please try again later.' };

      // Prefer the typed shorthand (current.monthly / current.annual), fall back
      // to scanning availablePackages by identifier for custom package IDs.
      const pkg = plan === 'annual'
        ? (current.annual   ?? current.availablePackages.find((p: any) => p.identifier === 'yearly'))
        : (current.monthly  ?? current.availablePackages.find((p: any) => p.identifier === 'monthly'));

      if (!pkg) return { error: `The ${plan} plan is not available right now.` };

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setIsPro(customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined);
      return { error: null };
    } catch (e: any) {
      // User tapped Cancel — not an error; don't surface anything.
      if (
        e?.userCancelled === true ||
        (PURCHASES_ERROR_CODE && e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
      ) {
        return { error: null };
      }
      console.error('[TruckerNet] Purchase error:', e);
      return { error: e?.message ?? 'Purchase failed. Please try again.' };
    }
  }

  // ── Restore purchases ─────────────────────────────────────────────────────
  async function restore(): Promise<{ error: string | null }> {
    if (MOCK_MODE) {
      return { error: 'Restore requires a dev or production build — not available in Expo Go.' };
    }
    if (NATIVE_MODULE_MISSING || !PLATFORM_API_KEY) {
      return { error: 'Subscriptions aren’t available on this device yet. Please update to the latest version.' };
    }
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isNowPro     = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPro(isNowPro);
      return {
        error: isNowPro
          ? null
          : Platform.OS === 'ios'
            ? 'No active subscription found on this Apple ID.'
            : 'No active subscription found on this Google account.',
      };
    } catch (e: any) {
      console.error('[TruckerNet] Restore error:', e);
      return { error: e?.message ?? 'Restore failed. Please try again.' };
    }
  }

  return (
    <SubscriptionContext.Provider
      value={{ isPro, loading, pricing, trialEligible, isMock: MOCK_MODE, setMockPro, purchase, restore }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
