import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';
import { capture } from '../../lib/analytics';

interface Props {
  // First-launch mode: the final slide offers the auth CTAs.
  onSignUp?:    () => void;
  onSignIn?:    () => void;
  // Replay/review mode (launched from Settings): the final slide offers a
  // single "Done" that returns to the app. When set, auth CTAs are hidden.
  onDone?:      () => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_COUNT = 4;

export default function WalkthroughScreen({ onSignUp, onSignIn, onDone }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== index) {
      capture('walkthrough_slide_viewed', { slide: i + 1, total: SLIDE_COUNT });
      setIndex(i);
    }
  }

  function goNext() {
    const next = Math.min(index + 1, SLIDE_COUNT - 1);
    scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    setIndex(next);
  }

  const isLast = index === SLIDE_COUNT - 1;
  const replay = !!onDone;
  const onSkip = onDone ?? onSignUp;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />

      {/* Top bar — terminal wordmark + Skip */}
      <View style={styles.topBar}>
        <Text style={styles.brandMark}>TRUCKERNET</Text>
        {!isLast ? (
          <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skip}>{t('walkthrough.skip')}</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      {/* Pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        <Slide
          headline={t('walkthrough.s1.headline')}
          sub={t('walkthrough.s1.sub')}
          mock={<HowItWorksMock t={t} />}
        />
        <Slide
          headline={t('walkthrough.s2.headline')}
          sub={t('walkthrough.s2.sub')}
          mock={<CheckLoadMock t={t} />}
        />
        <Slide
          headline={t('walkthrough.s3.headline')}
          sub={t('walkthrough.s3.sub')}
          mock={<FairMarketMock t={t} />}
        />
        <Slide
          headline={t('walkthrough.s4.headline')}
          sub={t('walkthrough.s4.sub')}
          mock={<IFTAMock t={t} />}
        />
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <Text style={styles.punchline}>{t(`walkthrough.s${index + 1}.punchline`)}</Text>
        {!isLast ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('common.next')}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} />
          </TouchableOpacity>
        ) : replay ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('common.done')}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { capture('walkthrough_cta_tapped', { choice: 'get_started' }); onSignUp?.(); }} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('walkthrough.getStarted')}</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { capture('walkthrough_cta_tapped', { choice: 'sign_in' }); onSignIn?.(); }} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>{t('walkthrough.signIn')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Slide shell ───────────────────────────────────────────────────────────────

function Slide({ headline, sub, mock }: { headline: string; sub: string; mock: React.ReactNode }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.slide}>
      <View style={styles.mockWrap}>{mock}</View>
      <Text style={styles.headline}>{headline}</Text>
      <AccentRule style={{ marginBottom: 14 }} />
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

type T = (key: string, opts?: any) => string;

// Sample lanes — proper-noun sample data (kept untranslated, like the IFTA states).
const LANE_VERDICT = { from: 'Denver, CO',          to: 'Kansas City, MO' };
const LANE_CHECK   = { from: 'Salt Lake City, UT',  to: 'Las Vegas, NV' };
const LANE_FAIR    = { from: 'Chicago, IL',         to: 'Dallas, TX' };

function RouteLabel({ from, to }: { from: string; to: string }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.routeRow}>
      <Ionicons name="navigate" size={11} color={Colors.textSecondary} />
      <Text style={styles.routeText} numberOfLines={1}>{from}  →  {to}</Text>
    </View>
  );
}

// Costs captured during setup — shown as chips on slide 1.
const EXPENSE_CHIPS: { icon: React.ComponentProps<typeof Ionicons>['name']; key: string }[] = [
  { icon: 'flash',             key: 'chipFuel' },
  { icon: 'bus',               key: 'chipFixed' },
  { icon: 'shield-checkmark',  key: 'chipInsurance' },
  { icon: 'construct',         key: 'chipMaintenance' },
  { icon: 'car',               key: 'chipParking' },
];

// ── Slide 1 — How it works (costs → break-even → verdict) ──────────────────────

function HowItWorksMock({ t }: { t: T }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.flowCard}>
      {/* Step 1 — costs */}
      <View style={styles.flowRow}>
        <View style={styles.flowBadge}><Text style={styles.flowBadgeNum}>1</Text></View>
        <View style={styles.flowBody}>
          <Text style={styles.flowLabel}>{t('walkthrough.s1.step1')}</Text>
          <View style={styles.chipRow}>
            {EXPENSE_CHIPS.map(({ icon, key }) => (
              <View key={key} style={styles.chip}>
                <Ionicons name={icon} size={12} color={Colors.textSecondary} />
                <Text style={styles.chipText}>{t(`walkthrough.s1.${key}`)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.flowConnector} />

      {/* Step 2 — break-even */}
      <View style={styles.flowRow}>
        <View style={styles.flowBadge}><Text style={styles.flowBadgeNum}>2</Text></View>
        <View style={styles.flowBody}>
          <Text style={styles.flowLabel}>{t('walkthrough.s1.step2')}</Text>
          <Text style={styles.breakEvenValue}>$2.18<Text style={styles.breakEvenUnit}>/mi</Text></Text>
        </View>
      </View>

      <View style={styles.flowConnector} />

      {/* Step 3 — verdict */}
      <View style={styles.flowRow}>
        <View style={styles.flowBadge}><Text style={styles.flowBadgeNum}>3</Text></View>
        <View style={styles.flowBody}>
          <Text style={styles.flowLabel}>{t('walkthrough.s1.step3')}</Text>
          <View style={styles.flowRouteWrap}>
            <RouteLabel {...LANE_VERDICT} />
          </View>
          <View style={styles.flowVerdictRow}>
            <View style={styles.verdictPill}>
              <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
              <Text style={styles.verdictPillText}>{t('walkthrough.takeIt')}</Text>
            </View>
            <Text style={styles.flowNetAmount}>{t('walkthrough.s1.netResult', { amount: '+$1,410' })}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Slide 2 — Check Load result card ───────────────────────────────────────────

function CheckLoadMock({ t }: { t: T }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={[styles.resultCard, { borderColor: Colors.primary }]}>
      <RouteLabel {...LANE_CHECK} />
      <View style={styles.routeDivider} />

      <View style={styles.verdictRow}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
        <Text style={[styles.verdictLabel, { color: Colors.primary }]}>{t('walkthrough.s2.worthIt')}</Text>
      </View>

      <Text style={styles.netLabel}>{t('walkthrough.s2.netPay')}</Text>
      <Text style={styles.netValue}>$1,247</Text>
      <Text style={styles.grossLine}>{t('walkthrough.s2.ofGross', { amount: '$2,162' })}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t('walkthrough.s2.perMile')}</Text>
          <Text style={styles.statValue}>$2.97</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t('walkthrough.s2.breakEven')}</Text>
          <Text style={styles.statValue}>$2.18</Text>
        </View>
      </View>

      <View style={[styles.deltaPill, { backgroundColor: Colors.primaryDim }]}>
        <Ionicons name="trending-up" size={14} color={Colors.primary} />
        <Text style={[styles.deltaText, { color: Colors.primary }]}>
          {t('walkthrough.s2.above', { amount: '$0.79' })}
        </Text>
      </View>
    </View>
  );
}

// ── Slide 3 — Fair Market range ────────────────────────────────────────────────

function FairMarketMock({ t }: { t: T }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.fairCard}>
      <RouteLabel {...LANE_FAIR} />
      <View style={styles.routeDivider} />

      <View style={styles.fairBlock}>
        <Text style={styles.fairEyebrow}>{t('walkthrough.s3.thisLoad')}</Text>
        <Text style={styles.fairOffered}>$1,800</Text>
      </View>

      <View style={styles.fairDivider} />

      <View style={styles.fairBlock}>
        <Text style={styles.fairEyebrow}>{t('walkthrough.s3.fairMarket')}</Text>
        <Text style={styles.fairRange}>$2,050–$2,300</Text>
      </View>

      <View style={styles.lowballPill}>
        <Ionicons name="trending-down" size={14} color={Colors.secondary} />
        <Text style={styles.lowballText}>{t('walkthrough.s3.lowball')}</Text>
      </View>
    </View>
  );
}

// ── Slide 4 — IFTA mini table ──────────────────────────────────────────────────

const IFTA_ROWS = [
  { state: 'TX', miles: '1,840', gallons: '283.1' },
  { state: 'TN', miles: '620',   gallons: '95.4' },
  { state: 'MO', miles: '560',   gallons: '86.2' },
  { state: 'OK', miles: '410',   gallons: '63.1' },
  { state: 'IL', miles: '380',   gallons: '58.5' },
];

function IFTAMock({ t }: { t: T }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.iftaCard}>
      <View style={styles.iftaHeaderRow}>
        <Text style={[styles.iftaHeader, { flex: 1 }]}>{t('walkthrough.s4.state')}</Text>
        <Text style={[styles.iftaHeader, { flex: 2, textAlign: 'right' }]}>{t('walkthrough.s4.miles')}</Text>
        <Text style={[styles.iftaHeader, { flex: 2, textAlign: 'right' }]}>{t('walkthrough.s4.gallons')}</Text>
      </View>

      {IFTA_ROWS.map((r, i) => (
        <View key={r.state} style={[styles.iftaRow, i < IFTA_ROWS.length - 1 && styles.iftaRowBorder]}>
          <Text style={[styles.iftaState, { flex: 1 }]}>{r.state}</Text>
          <Text style={[styles.iftaCell, { flex: 2, textAlign: 'right' }]}>{r.miles}</Text>
          <Text style={[styles.iftaCell, { flex: 2, textAlign: 'right' }]}>{r.gallons}</Text>
        </View>
      ))}

      <View style={styles.iftaFooter}>
        <Ionicons name="share-outline" size={13} color={Colors.primary} />
        <Text style={styles.iftaFooterText}>{t('walkthrough.s4.ready')}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  pager: { flex: 1 },

  topBar: {
    height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenH,
  },
  brandMark: { fontFamily: FontFamily.monoSemiBold, fontSize: 12, color: Colors.labelColor, letterSpacing: 1.6 },
  skip: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary, letterSpacing: 0.5 },

  slide: {
    width: SCREEN_W,
    paddingHorizontal: Spacing.screenH,
    justifyContent: 'center',
    flex: 1,
  },
  mockWrap: { marginBottom: 40, alignItems: 'stretch' },
  headline: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary,
    lineHeight: 36, marginBottom: 12, letterSpacing: -0.6, alignSelf: 'flex-start',
  },
  sub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary,
    lineHeight: 23,
  },

  // Dots
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingVertical: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.surfaceHigh },
  dotActive: { backgroundColor: Colors.primary, width: 22 },

  // Footer
  footer: { paddingHorizontal: Spacing.screenH, paddingBottom: 12 },
  punchline: {
    fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary,
    textAlign: 'center', lineHeight: 26, marginBottom: 16, letterSpacing: -0.3,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 12,
  },
  primaryBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  secondaryBtn:  { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  secondaryBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  ghostBtn:      { alignItems: 'center', paddingVertical: 6 },
  ghostBtnText:  { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  // ── Slide 1: flow ──
  flowCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad,
  },
  flowRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  flowBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primaryMid, alignItems: 'center', justifyContent: 'center',
  },
  flowBadgeNum: { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.primary },
  flowBody: { flex: 1, paddingTop: 2 },
  flowLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.labelColor, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  flowConnector: { width: 1, height: 22, backgroundColor: Colors.border, marginLeft: 14, marginVertical: 2 },

  // Sample-lane route label (shared across slides)
  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeText: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary, flexShrink: 1, letterSpacing: 0.3 },
  routeDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginTop: 12, marginBottom: 16 },
  flowRouteWrap: { marginBottom: 8 },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textPrimary },

  breakEvenValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -1 },
  breakEvenUnit:  { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary },

  flowVerdictRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdictPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  verdictPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.primary },
  flowNetAmount: { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.primary },

  // ── Slide 2: result card (mirrors CheckLoad) ──
  resultCard: {
    backgroundColor: Colors.surface, borderWidth: 2, borderRadius: Radius.md, padding: Spacing.cardPad,
  },
  verdictRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  verdictLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.body },
  netLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 6 },
  netValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.heroLarge, lineHeight: 56, letterSpacing: -2, color: Colors.primary, marginBottom: 2 },
  grossLine: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 16 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statCell:  { flex: 1 },
  statSep:   { width: 1, height: 32, backgroundColor: Colors.border, marginHorizontal: 16 },
  statLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 10, marginBottom: 4 },
  statValue: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },
  deltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  deltaText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label },

  // ── Slide 3: fair market ──
  fairCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad,
  },
  fairBlock: { marginBottom: 4 },
  fairEyebrow: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 10, marginBottom: 6 },
  fairOffered: { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.textPrimary, letterSpacing: -1 },
  fairDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 16 },
  fairRange:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -1 },
  lowballPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.secondaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 18,
  },
  lowballText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.secondary },

  // ── Slide 4: IFTA ──
  iftaCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
  },
  iftaHeaderRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 12,
    backgroundColor: Colors.surfaceHigh,
  },
  iftaHeader: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 10, marginBottom: 0 },
  iftaRow:    { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14, alignItems: 'center' },
  iftaRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  iftaState:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary },
  iftaCell:   { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textPrimary },
  iftaFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: Spacing.cardPad, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surfaceHigh,
  },
  iftaFooterText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption, color: Colors.primary },
});
