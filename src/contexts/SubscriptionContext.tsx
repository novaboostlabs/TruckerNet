import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSetting, setSetting } from '../db/database';

/**
 * Subscription / entitlement state for the Free ↔ Driver Pro paywall.
 *
 * BUILD APPROACH (decided 2026-06-22): mock-first. `react-native-purchases` is a
 * native module and CRASHES in Expo Go if imported at load time, so this context
 * is intentionally pure-JS right now. `isPro` is driven by a persisted mock
 * toggle (flipped from the dev row in Settings) so the full paywall UI, gating,
 * and IFTA blur can be built and tested in Expo Go before any store products
 * exist. The real RevenueCat wiring goes in the clearly-marked block below and
 * only runs in a dev/production build, never in Expo Go.
 *
 * RevenueCat entitlement id = "pro" (see monetization-paywall-plan).
 */

const MOCK_PRO_KEY = 'mock_is_pro';

export interface SubscriptionContextValue {
  /** True when the user has the "pro" entitlement (mock toggle for now). */
  isPro: boolean;
  /** Still resolving entitlement state on cold start. */
  loading: boolean;
  /** Whether isPro is coming from the local mock toggle (vs real RevenueCat). */
  isMock: boolean;
  /** Dev-only: flip the mock entitlement. No-op once real RevenueCat is wired. */
  setMockPro: (value: boolean) => void;
  /**
   * Purchase a package. Stubbed until store products are live — surfaces a
   * clear "not wired yet" result instead of pretending to charge.
   */
  purchase: (plan: 'monthly' | 'annual') => Promise<{ error: string | null }>;
  /** Restore previous purchases. Stubbed until RevenueCat is wired. */
  restore: () => Promise<{ error: string | null }>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>(
  {} as SubscriptionContextValue
);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── MOCK PATH (active) ───────────────────────────────────────────────
    // Read the persisted mock toggle. Synchronous SQLite, so no flash.
    try {
      setIsPro(getSetting(MOCK_PRO_KEY) === 'true');
    } catch {
      setIsPro(false);
    }
    setLoading(false);

    // ── REAL REVENUECAT PATH (wire later — do NOT enable in Expo Go) ──────
    // When store products are live and running in a dev/production build:
    //   import Purchases from 'react-native-purchases';
    //   Purchases.configure({ apiKey: <platform key> });
    //   const info = await Purchases.getCustomerInfo();
    //   setIsPro(info.entitlements.active['pro'] !== undefined);
    //   Purchases.addCustomerInfoUpdateListener((info) =>
    //     setIsPro(info.entitlements.active['pro'] !== undefined));
    // Guard the import behind `!Constants.appOwnership === 'expo'` (Expo Go).
  }, []);

  function setMockPro(value: boolean) {
    setSetting(MOCK_PRO_KEY, value ? 'true' : 'false');
    setIsPro(value);
  }

  async function purchase(_plan: 'monthly' | 'annual') {
    // Stub until RevenueCat products exist. Real impl:
    //   const offerings = await Purchases.getOfferings();
    //   const pkg = plan === 'annual' ? annualPkg : monthlyPkg;
    //   await Purchases.purchasePackage(pkg);  // entitlement listener flips isPro
    return { error: 'Subscriptions are not available yet. Coming soon!' };
  }

  async function restore() {
    // Stub until RevenueCat is wired. Real impl:
    //   const info = await Purchases.restorePurchases();
    //   setIsPro(info.entitlements.active['pro'] !== undefined);
    return { error: 'Nothing to restore yet.' };
  }

  return (
    <SubscriptionContext.Provider
      value={{ isPro, loading, isMock: true, setMockPro, purchase, restore }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
