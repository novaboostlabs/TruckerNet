import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import PaywallScreen, { PaywallReason } from '../screens/PaywallScreen';
import { capture } from '../lib/analytics';

/**
 * App-wide paywall presentation. The paywall fires from many places (Add Load
 * 16th-load gate, Check Load / Add Load fair-market area, History past-periods,
 * IFTA tab, any export). Rather than each screen owning Modal-visibility state,
 * the paywall is rendered once per "host" and any screen calls `present(reason)`.
 *
 * WHY HOSTS EXIST (App Review 2.1(b) fix): on iOS a <Modal> declared at the app
 * root CANNOT present while another modal (e.g. the Check Load / Add Load /
 * Settings pageSheet) is already presented — the present call is silently
 * dropped, so upgrade buttons inside those sheets "did nothing". The fix: any
 * screen that is itself shown inside a <Modal> mounts a <PaywallHost /> in its
 * own tree. The paywall then renders as a *nested* modal inside the currently
 * presented sheet (which iOS supports), and falls back to the root-level modal
 * only when no host is mounted (tab screens like IFTA / Dashboard / History).
 */

interface PaywallContextValue {
  /** Open the paywall, optionally tailored to what the user just reached for. */
  present: (reason?: PaywallReason) => void;
  // ── internals (used by PaywallHost; not for screens) ──
  visible: boolean;
  reason: PaywallReason;
  close: () => void;
  registerHost: (id: number) => void;
  unregisterHost: (id: number) => void;
  topHost: number | null;
}

const PaywallContext = createContext<PaywallContextValue>({
  present: () => {},
  visible: false,
  reason: 'generic',
  close: () => {},
  registerHost: () => {},
  unregisterHost: () => {},
  topHost: null,
});

let nextHostId = 1;

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<PaywallReason>('generic');
  // Stack of mounted hosts — the most recently mounted one presents the paywall.
  const [hosts, setHosts] = useState<number[]>([]);

  const present = useCallback((r: PaywallReason = 'generic') => {
    setReason(r);
    setVisible(true);
    capture('paywall_shown', { reason: r });
  }, []);

  const close = useCallback(() => setVisible(false), []);

  const registerHost   = useCallback((id: number) => setHosts(h => [...h, id]), []);
  const unregisterHost = useCallback((id: number) => setHosts(h => h.filter(x => x !== id)), []);
  const topHost = hosts.length > 0 ? hosts[hosts.length - 1] : null;

  return (
    <PaywallContext.Provider value={{ present, visible, reason, close, registerHost, unregisterHost, topHost }}>
      {children}
      {/* Root-level presentation — only when no modal screen is hosting. */}
      <Modal
        visible={visible && topHost === null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
      >
        <PaywallScreen onClose={close} reason={reason} />
      </Modal>
    </PaywallContext.Provider>
  );
}

/**
 * Mount inside any screen that is itself presented as a <Modal> (Settings,
 * Check Load, Add Load, …). Renders the paywall as a nested modal so iOS can
 * present it above the current sheet. Place it anywhere in the screen's tree.
 */
export function PaywallHost() {
  const { visible, reason, close, registerHost, unregisterHost, topHost } = useContext(PaywallContext);
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextHostId++;

  useEffect(() => {
    const id = idRef.current;
    registerHost(id);
    return () => unregisterHost(id);
  }, [registerHost, unregisterHost]);

  return (
    <Modal
      visible={visible && topHost === idRef.current}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <PaywallScreen onClose={close} reason={reason} />
    </Modal>
  );
}

export function usePaywall() {
  return useContext(PaywallContext);
}
