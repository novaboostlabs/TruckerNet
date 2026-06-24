import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSetting, setSetting } from '../db/database';

// ─────────────────────────────────────────────────────────────────────────────
// RevenueCat configuration
// ─────────────────────────────────────────────────────────────────────────────

// 🚨 BEFORE APP STORE SUBMISSION: replace test_ key with the live key from
//    RevenueCat → Project Settings → API Keys → Public app-specific (iOS).
const IOS_API_KEY     = 'test_MHQhqpsKYgUVrPYkZkECVNiZBXN';
const ANDROID_API_KEY = ''; // add when Play Console + RC Android app is set up

// The identifier set on the entitlement in the RevenueCat dashboard.
const ENTITLEMENT_ID = 'TruckerNet: Driver Finance Pro';

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic import — react-native-purchases is a native module that crashes Expo Go
// at import time. Wrapping in try/catch degrades gracefully to mock mode.
// ─────────────────────────────────────────────────────────────────────────────
let Purchases: any            = null;
let PURCHASES_ERROR_CODE: any = null;
try {
  const rc             = require('react-native-purchases');
  Purchases            = rc.default ?? rc;
  PURCHASES_ERROR_CODE = rc.PURCHASES_ERROR_CODE;
} catch { /* Expo Go — native module unavailable, mock mode active */ }

// True when running in the Expo Go client (native modules unavailable).
const IS_EXPO_GO = Constants.appOwnership === 'expo' || Purchases === null;

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PRO_KEY = 'mock_is_pro';

export interface SubscriptionContextValue {
  /** True when the user has an active Driver Pro entitlement. */
  isPro:      boolean;
  /** Still resolving entitlement state on cold start. */
  loading:    boolean;
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
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro,   setIsPro]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_EXPO_GO) {
      // ── MOCK PATH (Expo Go) ───────────────────────────────────────────────
      try { setIsPro(getSetting(MOCK_PRO_KEY) === 'true'); } catch { setIsPro(false); }
      setLoading(false);
      return;
    }

    // ── REAL REVENUECAT PATH (dev / production build) ─────────────────────
    async function initRC() {
      try {
        const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
        if (!apiKey) {
          console.warn('[TruckerNet] RevenueCat: no API key for platform', Platform.OS);
          setLoading(false);
          return;
        }

        // Enable verbose logging in dev builds for easier debugging.
        if (__DEV__) {
          Purchases.setLogLevel(Purchases.LOG_LEVEL?.DEBUG ?? 'DEBUG');
        }

        Purchases.configure({ apiKey });

        // Fetch the current entitlement state.
        const customerInfo = await Purchases.getCustomerInfo();
        setIsPro(customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined);

        // Stay in sync whenever the entitlement changes (e.g. after purchase,
        // restore, expiry, or a billing retry).
        Purchases.addCustomerInfoUpdateListener((info: any) => {
          setIsPro(info.entitlements.active[ENTITLEMENT_ID] !== undefined);
        });
      } catch (e) {
        console.error('[TruckerNet] RevenueCat init error:', e);
      } finally {
        setLoading(false);
      }
    }

    initRC();
  }, []); // eslint-disable-line

  // ── Mock toggle (dev only, no-op in production) ───────────────────────────
  function setMockPro(value: boolean) {
    if (!IS_EXPO_GO) return; // guard: never mutate real entitlement state
    setSetting(MOCK_PRO_KEY, value ? 'true' : 'false');
    setIsPro(value);
  }

  // ── Purchase ──────────────────────────────────────────────────────────────
  async function purchase(plan: 'monthly' | 'annual'): Promise<{ error: string | null }> {
    if (IS_EXPO_GO) {
      return { error: 'Subscriptions require a dev or production build — not available in Expo Go.' };
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
    if (IS_EXPO_GO) {
      return { error: 'Restore requires a dev or production build — not available in Expo Go.' };
    }
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isNowPro     = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPro(isNowPro);
      return {
        error: isNowPro ? null : 'No active subscription found on this Apple ID.',
      };
    } catch (e: any) {
      console.error('[TruckerNet] Restore error:', e);
      return { error: e?.message ?? 'Restore failed. Please try again.' };
    }
  }

  return (
    <SubscriptionContext.Provider
      value={{ isPro, loading, isMock: IS_EXPO_GO, setMockPro, purchase, restore }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
