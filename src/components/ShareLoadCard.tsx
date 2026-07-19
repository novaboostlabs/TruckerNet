import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { capture as track } from '../lib/analytics';

// The card is a BRAND ASSET — it renders in the fixed dark Freight Terminal
// palette regardless of the app theme, so every screenshot in every Facebook
// group looks identically TruckerNet.
const CARD = {
  bg:      '#0A0A0B',
  surface: '#161616',
  border:  '#2A2A2A',
  text:    '#F0EDE8',
  dim:     '#9A9A9A',
  label:   '#8A8A8A',
  teal:    '#00C896',
  amber:   '#E8A020',
  red:     '#EF4444',
  grid:    'rgba(130, 150, 150, 0.14)',
};

const CARD_W = 320;

export interface ShareLoadData {
  from:     string;   // "Dallas, TX"
  to:       string;   // "Atlanta, GA"
  miles:    number;
  grossPay: number;
  netPay:   number;
  netRPM:   number;
  verdict:  string | null;  // 'green' | 'amber' | 'red' | null
  date:     string;         // display-ready
}

interface Props {
  visible: boolean;
  onClose: () => void;
  data:    ShareLoadData;
}

function money(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString('en-US');
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

/**
 * Branded, shareable load report card. Every share is an ad with the wordmark
 * on it — drivers already screenshot rate cons into Facebook groups daily;
 * this makes the screenshot beautiful and self-attributing.
 */
export default function ShareLoadCard({ visible, onClose, data }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  // Privacy mode: mask the dollar amounts (route/verdict/branding stay) so a
  // driver can share the load without broadcasting their rates. Fixed-width
  // masks so the real magnitude can't be inferred from the digits.
  const [hidePay, setHidePay] = useState(false);
  const MASK_MONEY = '$•,•••';
  const MASK_RPM   = '$•.••';

  const verdictColor =
    data.verdict === 'green' ? CARD.teal :
    data.verdict === 'amber' ? CARD.amber :
    data.verdict === 'red'   ? CARD.red :
    data.netPay >= 0 ? CARD.teal : CARD.red;

  const verdictLabel = data.verdict ? t(`loadDetail.verdict.${data.verdict}`) : null;

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        track('load_card_shared', { verdict: data.verdict, net_pay: data.netPay, hide_pay: hidePay });
      }
    } catch { /* user dismissed the sheet or capture failed — nothing to do */ }
    finally { setSharing(false); }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* ── The capture target ── */}
        <View ref={cardRef} collapsable={false} style={[cardStyles.card, { borderColor: verdictColor }]}>
          {/* Grid motif sized to the card */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern id="sharegrid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <Line x1="0" y1="0" x2="0" y2="28" stroke={CARD.grid} strokeWidth="1" />
                  <Line x1="0" y1="0" x2="28" y2="0" stroke={CARD.grid} strokeWidth="1" />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#sharegrid)" />
            </Svg>
          </View>

          <View style={cardStyles.inner}>
            {/* Wordmark + date */}
            <View style={cardStyles.topRow}>
              <Text style={cardStyles.wordmark}>TRUCKERNET</Text>
              <Text style={cardStyles.date}>{data.date}</Text>
            </View>

            {/* Route */}
            <Text style={cardStyles.route} numberOfLines={2}>
              {data.from}  →  {data.to}
            </Text>
            <Text style={cardStyles.miles}>
              {Math.round(data.miles).toLocaleString('en-US')} {t('common.miles')}
            </Text>

            <View style={cardStyles.rule} />

            {/* Net pay hero */}
            <Text style={cardStyles.netLabel}>{t('dashboard.netPay').toUpperCase()}</Text>
            <Text style={[cardStyles.netValue, { color: verdictColor }]}>
              {hidePay ? MASK_MONEY : money(data.netPay)}
            </Text>
            <Text style={cardStyles.grossLine}>
              {t('dashboard.ofGross', { amount: hidePay ? MASK_MONEY : money(data.grossPay) })}
            </Text>

            {/* Stats row */}
            <View style={cardStyles.statsRow}>
              <View>
                <Text style={cardStyles.statLabel}>$/MI</Text>
                <Text style={cardStyles.statValue}>{hidePay ? MASK_RPM : `$${data.netRPM.toFixed(2)}`}</Text>
              </View>
              {verdictLabel && (
                <View style={[cardStyles.verdictPill, { backgroundColor: verdictColor + '20', borderColor: verdictColor + '60' }]}>
                  <Text style={[cardStyles.verdictText, { color: verdictColor }]}>{verdictLabel}</Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View style={cardStyles.footer}>
              <Text style={cardStyles.footerTag}>{t('shareCard.tagline')}</Text>
              <Text style={cardStyles.footerUrl}>truckernet.app</Text>
            </View>
          </View>
        </View>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          {/* Privacy toggle — mask the dollar amounts before sharing */}
          <View style={styles.privacyRow}>
            <Ionicons name="eye-off-outline" size={16} color="#CCCCCC" />
            <Text style={styles.privacyLabel}>{t('shareCard.hidePay')}</Text>
            <Switch
              value={hidePay}
              onValueChange={setHidePay}
              trackColor={{ false: '#3A3A3A', true: CARD.teal + '66' }}
              thumbColor={hidePay ? CARD.teal : '#FFFFFF'}
              ios_backgroundColor="#3A3A3A"
            />
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85} disabled={sharing}>
            {sharing
              ? <ActivityIndicator size="small" color={Colors.onPrimary} />
              : <Ionicons name="share-outline" size={17} color={Colors.onPrimary} />}
            <Text style={styles.shareBtnText}>{t('shareCard.share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Fixed-palette styles for the brand card (theme-independent on purpose).
const cardStyles = StyleSheet.create({
  card: {
    width: CARD_W, backgroundColor: CARD.bg,
    borderWidth: 2, borderRadius: 16, overflow: 'hidden',
  },
  inner:    { padding: 24 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  wordmark: { fontFamily: FontFamily.monoBold, fontSize: 12, color: CARD.dim, letterSpacing: 2.2 },
  date:     { fontFamily: FontFamily.monoRegular, fontSize: 11, color: CARD.label },

  route: { fontFamily: FontFamily.monoBold, fontSize: 17, color: CARD.text, letterSpacing: -0.3, lineHeight: 24 },
  miles: { fontFamily: FontFamily.monoRegular, fontSize: 12, color: CARD.dim, marginTop: 3 },

  rule: { height: 1, backgroundColor: CARD.border, marginVertical: 18 },

  netLabel:  { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: CARD.label, letterSpacing: 1.8, marginBottom: 6 },
  netValue:  { fontFamily: FontFamily.monoBold, fontSize: 46, lineHeight: 52, letterSpacing: -2 },
  grossLine: { fontFamily: FontFamily.monoRegular, fontSize: 13, color: CARD.dim, marginTop: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  statLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 9, color: CARD.label, letterSpacing: 1.4, marginBottom: 3 },
  statValue: { fontFamily: FontFamily.monoBold, fontSize: 18, color: CARD.text },
  verdictPill: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  verdictText: { fontFamily: FontFamily.bold, fontSize: 13 },

  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: CARD.border,
  },
  footerTag: { fontFamily: FontFamily.regular, fontSize: 11, color: CARD.dim },
  footerUrl: { fontFamily: FontFamily.monoSemiBold, fontSize: 11, color: CARD.teal, letterSpacing: 0.4 },
});

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  actions: { width: CARD_W, marginTop: 18 },
  privacyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, marginBottom: 12,
  },
  privacyLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.label, color: '#CCCCCC' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15,
  },
  shareBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  closeBtn:  { alignItems: 'center', paddingVertical: 14 },
  closeText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: '#CCCCCC' },
});
