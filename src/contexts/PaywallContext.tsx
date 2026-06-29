import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from 'react-native';
import PaywallScreen, { PaywallReason } from '../screens/PaywallScreen';
import { capture } from '../lib/analytics';

/**
 * App-wide paywall presentation. The paywall fires from many places (Add Load
 * 16th-load gate, Check Load / Add Load fair-market area, History past-periods,
 * IFTA tab, any export). Rather than each screen owning Modal-visibility state,
 * the Modal is rendered once here and any screen calls `present(reason)`.
 */

interface PaywallContextValue {
  /** Open the paywall, optionally tailored to what the user just reached for. */
  present: (reason?: PaywallReason) => void;
}

const PaywallContext = createContext<PaywallContextValue>({ present: () => {} });

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<PaywallReason>('generic');

  const present = useCallback((r: PaywallReason = 'generic') => {
    setReason(r);
    setVisible(true);
    capture('paywall_shown', { reason: r });
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return (
    <PaywallContext.Provider value={{ present }}>
      {children}
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <PaywallScreen onClose={close} reason={reason} />
      </Modal>
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  return useContext(PaywallContext);
}
