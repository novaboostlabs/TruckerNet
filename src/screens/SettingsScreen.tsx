import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, KeyboardAvoidingView, Platform, Linking, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel,
} from '../theme/theme';
import { AppFlowContext } from '../contexts/AppFlowContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { getWeeklyMiles, getSetting, setSetting, getIncomeGoal, setIncomeGoal, getRateContributionCount } from '../db/database';
import { getNetworkReportCount } from '../lib/rateReports';
import { getSyncStatus, syncAll } from '../lib/sync';
import { setupNotifications, cancelAllNotifications } from '../lib/notifications';
import { capture } from '../lib/analytics';
import * as haptics from '../lib/haptics';
import GridBackground from '../components/GridBackground';
import { useTheme, ThemeMode } from '../theme/ThemeContext';

// ── Constants ──────────────────────────────────────────────────────────────

const APP_VERSION  = '1.0.0 (Beta)';
const URL_TERMS    = 'https://truckernet.app/terms';
const URL_PRIVACY  = 'https://truckernet.app/privacy';

const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English' },
  { code: 'es', label: 'Spanish',  native: 'Español' },
  { code: 'pa', label: 'Punjabi',  native: 'ਪੰਜਾਬੀ'  },
  { code: 'zh', label: 'Chinese',  native: '中文'     },
];

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function RowDivider() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return <View style={styles.rowDivider} />;
}

interface RowProps {
  icon:       React.ComponentProps<typeof Ionicons>['name'];
  iconBg?:    string;
  iconColor?: string;
  label:      string;
  sublabel?:  string;
  rightLabel?:string;
  chevron?:   boolean;
  onPress?:   () => void;
  disabled?:  boolean;
  danger?:    boolean;
  rightElement?: React.ReactNode;
}

function Row({
  icon, iconBg, iconColor, label, sublabel,
  rightLabel, chevron = true, onPress, disabled, danger, rightElement,
}: RowProps) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={disabled || !onPress}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg ?? Colors.surfaceHigh }]}>
        <Ionicons
          name={icon}
          size={17}
          color={iconColor ?? Colors.textSecondary}
        />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {rightElement ?? (
        <View style={styles.rowRight}>
          {rightLabel && (
            <Text style={styles.rowRightLabel}>{rightLabel}</Text>
          )}
          {chevron && onPress && (
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface Props {
  onClose:              () => void;
  onNavigateToExpenses: () => void;
}

export default function SettingsScreen({ onClose, onNavigateToExpenses }: Props) {
  const { t, i18n } = useTranslation();
  const { user, signOut, deleteAccount } = useAuth();
  const { isPro, isMock, setMockPro, restore } = useSubscription();
  const { present: presentPaywall } = usePaywall();
  const { replayOnboarding, replayWalkthrough } = useContext(AppFlowContext);
  const { mode: themeMode, setMode: setThemeMode, colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // ── Cloud-backup status (so the driver can SEE their data is safe) ──
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());
  const [syncing, setSyncing]       = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleSyncNow = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    await syncAll(user.id);
    setSyncStatus(getSyncStatus());
    setSyncing(false);
  }, [user, syncing]);

  const backupSublabel = syncing
    ? t('settings.backupSyncing')
    : syncStatus.lastError
      ? t('settings.backupFailed')
      : syncStatus.lastSyncAt
        ? t('settings.backupOk', { time: new Date(syncStatus.lastSyncAt).toLocaleString(i18n.language) })
        : t('settings.backupNever');

  const THEME_OPTIONS: { value: ThemeMode; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { value: 'system', icon: 'phone-portrait-outline' },
    { value: 'light',  icon: 'sunny-outline' },
    { value: 'dark',   icon: 'moon-outline' },
  ];

  // Manage subscription → deep-link to the store's subscription settings.
  function handleManageSub() {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url);
  }

  async function handleRestore() {
    const { error } = await restore();
    Alert.alert(
      error ? t('paywall.comingSoonTitle') : t('paywall.restoredTitle'),
      error ?? t('paywall.restoredBody'),
    );
  }

  // Weekly miles inline edit
  const [weeklyMiles,  setWeeklyMilesLocal] = useState(() => getWeeklyMiles());
  const [editingMiles, setEditingMiles]     = useState(false);
  const [milesInput,   setMilesInput]       = useState('');
  const milesRef = useRef<TextInput>(null);

  // Tax rate inline edit
  const [taxRateInput,   setTaxRateInput]   = useState('');
  const [editingTaxRate, setEditingTaxRate] = useState(false);
  const [taxRate,        setTaxRateLocal]   = useState<number>(() => {
    const v = parseFloat(getSetting('tax_rate') ?? '25');
    return isNaN(v) ? 25 : Math.min(50, Math.max(5, v));
  });
  const taxRateRef = useRef<TextInput>(null);

  const startEditTaxRate = useCallback(() => {
    setTaxRateInput(String(taxRate));
    setEditingTaxRate(true);
    setTimeout(() => taxRateRef.current?.focus(), 50);
  }, [taxRate]);

  const saveTaxRate = useCallback(() => {
    const n = parseFloat(taxRateInput);
    const clamped = !isNaN(n) && n >= 5 && n <= 50 ? Math.round(n) : taxRate;
    setSetting('tax_rate', String(clamped));
    setTaxRateLocal(clamped);
    haptics.tapMedium();
    setEditingTaxRate(false);
  }, [taxRateInput, taxRate]);

  // Income goal inline edit
  const [incomeGoal,    setIncomeGoalLocal] = useState(() => getIncomeGoal());
  const [editingGoal,   setEditingGoal]     = useState(false);
  const [goalInput,     setGoalInput]       = useState('');
  const [goalPeriod,    setGoalPeriod]      = useState<'weekly' | 'monthly'>('weekly');
  const goalRef = useRef<TextInput>(null);

  const startEditGoal = useCallback(() => {
    const current = getIncomeGoal();
    setGoalInput(current ? String(Math.round(current.amount)) : '');
    setGoalPeriod(current?.period ?? 'weekly');
    setEditingGoal(true);
    setTimeout(() => goalRef.current?.focus(), 50);
  }, []);

  const saveGoal = useCallback(() => {
    const n = parseFloat(goalInput);
    const amount = n > 0 && n <= 999999 ? n : null;
    setIncomeGoal(amount, goalPeriod);
    setIncomeGoalLocal(getIncomeGoal());
    setEditingGoal(false);
    haptics.tapMedium();
    if (amount) capture('income_goal_set', { period: goalPeriod, amount });
  }, [goalInput, goalPeriod]);

  const cancelGoal = useCallback(() => setEditingGoal(false), []);

  const [shareData, setShareData] = useState(() => getSetting('share_rate_data') !== 'false');
  const [contribCount] = useState(() => getRateContributionCount());
  const [networkCount, setNetworkCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getNetworkReportCount().then((n) => { if (active) setNetworkCount(n); });
    return () => { active = false; };
  }, []);
  const [notifsEnabled, setNotifsEnabled] = useState(() => getSetting('notifications_enabled') !== 'false');

  const startEditMiles = useCallback(() => {
    setMilesInput(weeklyMiles > 0 ? String(Math.round(weeklyMiles)) : '');
    setEditingMiles(true);
    setTimeout(() => milesRef.current?.focus(), 50);
  }, [weeklyMiles]);

  const saveMiles = useCallback(() => {
    const n = parseFloat(milesInput);
    if (n > 0 && n <= 15000) {
      setSetting('weekly_miles', String(n));
      setWeeklyMilesLocal(n);
      haptics.tapMedium();
    }
    setEditingMiles(false);
  }, [milesInput]);

  const cancelMiles = useCallback(() => setEditingMiles(false), []);

  // Language
  const currentLang = i18n.language.split('-')[0]; // normalize 'en-US' → 'en'

  function handleLanguageChange(code: string) {
    i18n.changeLanguage(code);
    setSetting('language', code);
  }

  // Sign out
  function handleSignOut() {
    Alert.alert(
      t('settings.signOut'),
      t('settings.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: () => { onClose(); signOut(); },
        },
      ]
    );
  }

  // Delete account — permanently deletes the Supabase auth user + all cloud
  // data via the `delete-account` Edge Function (Apple guideline 5.1.1(v)).
  function handleDeleteAccount() {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccountAction'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            const { error } = await deleteAccount();
            setDeletingAccount(false);
            if (error) {
              Alert.alert(t('settings.deleteAccountFailedTitle'), t('settings.deleteAccountFailedBody'));
              return;
            }
            onClose();
          },
        },
      ]
    );
  }

  // Replay onboarding
  function handleReplaySetup() {
    Alert.alert(
      t('settings.replayTitle'),
      t('settings.replayConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.replayAction'),
          onPress: () => { onClose(); replayOnboarding(); },
        },
      ]
    );
  }

  // Replay the intro walkthrough (review mode)
  function handleReplayWalkthrough() {
    onClose();
    replayWalkthrough();
  }

  // Profile avatar
  const initials  = user?.email?.[0]?.toUpperCase() ?? '?';
  const isGuest   = !user;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        >

          {/* ── Profile Card ── */}
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              {isGuest ? (
                <>
                  <Text style={styles.profileEmail}>{t('settings.profileGuest')}</Text>
                  <Text style={styles.profileSub}>{t('settings.profileGuestSub')}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
                  <View style={styles.profileBadge}>
                    <View style={styles.profileBadgeDot} />
                    <Text style={styles.profileBadgeText}>{t('settings.profileActive')}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Subscription ── */}
          <SectionHeader label={t('settings.subscription')} />
          <View style={styles.card}>
            {isPro ? (
              <>
                <Row
                  icon="diamond"
                  iconBg={Colors.secondaryDim}
                  iconColor={Colors.secondary}
                  label={t('settings.proActive')}
                  sublabel={t('settings.proActiveSub')}
                  chevron={false}
                  rightElement={
                    <View style={styles.proPill}>
                      <View style={styles.proPillDot} />
                      <Text style={styles.proPillText}>{t('settings.proActiveSub')}</Text>
                    </View>
                  }
                />
                <RowDivider />
                <Row
                  icon="card-outline"
                  label={t('settings.manageSub')}
                  onPress={handleManageSub}
                />
              </>
            ) : (
              <Row
                icon="diamond"
                iconBg={Colors.secondaryDim}
                iconColor={Colors.secondary}
                label={t('settings.upgradeTitle')}
                sublabel={t('settings.upgradeSub')}
                onPress={() => presentPaywall('generic')}
              />
            )}
            <RowDivider />
            <Row
              icon="refresh-circle-outline"
              label={t('settings.restorePurchases')}
              chevron={false}
              onPress={handleRestore}
            />
            {/* Dev-only mock toggle — lets us test Pro gating before store
                products exist. Hidden once real RevenueCat is wired (isMock=false). */}
            {isMock && (
              <>
                <RowDivider />
                <Row
                  icon="construct-outline"
                  label={t('settings.devProToggle')}
                  sublabel={t('settings.devProToggleSub')}
                  chevron={false}
                  rightElement={
                    <Switch
                      value={isPro}
                      onValueChange={setMockPro}
                      trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
                      thumbColor={isPro ? Colors.primary : Colors.textTertiary}
                    />
                  }
                />
              </>
            )}
          </View>

          {/* ── Cloud backup status (signed-in only) ── */}
          {!isGuest && (
            <>
              <SectionHeader label={t('settings.backupSection')} />
              <View style={styles.card}>
                <Row
                  icon={syncStatus.lastError ? 'cloud-offline-outline' : 'cloud-done-outline'}
                  iconBg={syncStatus.lastError ? Colors.dangerDim : Colors.primaryDim}
                  iconColor={syncStatus.lastError ? Colors.danger : Colors.primary}
                  label={t('settings.backupTitle')}
                  sublabel={backupSublabel}
                  chevron={false}
                  onPress={handleSyncNow}
                  rightElement={syncing ? <ActivityIndicator size="small" color={Colors.primary} /> : undefined}
                />
              </View>
            </>
          )}

          {/* ── Break-Even Setup ── */}
          <SectionHeader label={t('settings.breakEvenSetup')} />
          <View style={styles.card}>

            <Row
              icon="wallet-outline"
              iconBg={Colors.primaryDim}
              iconColor={Colors.primary}
              label={t('settings.monthlyExpenses')}
              sublabel={t('settings.monthlyExpensesSub')}
              onPress={onNavigateToExpenses}
            />

            <RowDivider />

            {/* Weekly miles — inline editable */}
            <TouchableOpacity
              style={styles.row}
              onPress={startEditMiles}
              activeOpacity={0.6}
              disabled={editingMiles}
            >
              <View style={[styles.iconBox, { backgroundColor: Colors.primaryDim }]}>
                <Ionicons name="navigate-outline" size={17} color={Colors.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('settings.weeklyMiles')}</Text>
                <Text style={styles.rowSublabel}>{t('settings.weeklyMilesSub')}</Text>
              </View>
              {editingMiles ? (
                <View style={styles.milesEditRow}>
                  <TextInput
                    ref={milesRef}
                    value={milesInput}
                    onChangeText={(v) => {
                      const n = parseFloat(v);
                      if (!isNaN(n) && n > 15000) return;
                      setMilesInput(v);
                    }}
                    keyboardType="number-pad"
                    style={styles.milesInput}
                    maxLength={5}
                    selectTextOnFocus
                    onSubmitEditing={saveMiles}
                  />
                  <Text style={styles.milesUnit}>{t('settings.milesUnit')}</Text>
                  <TouchableOpacity onPress={saveMiles} style={styles.milesSaveBtn} activeOpacity={0.7}>
                    <Ionicons name="checkmark" size={17} color={Colors.onPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelMiles} style={styles.milesCancelBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={17} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.rowRight}>
                  <Text style={styles.rowRightLabel}>
                    {weeklyMiles > 0
                      ? `${Math.round(weeklyMiles).toLocaleString()} ${t('settings.milesUnit')}`
                      : t('settings.notSet')}
                  </Text>
                  <Ionicons name="pencil-outline" size={14} color={Colors.textTertiary} />
                </View>
              )}
            </TouchableOpacity>

            <RowDivider />

            <Row
              icon="refresh-outline"
              iconBg={Colors.primaryDim}
              iconColor={Colors.primary}
              label={t('settings.replaySetup')}
              sublabel={t('settings.replaySetupSub')}
              onPress={handleReplaySetup}
            />

            <RowDivider />

            <Row
              icon="play-circle-outline"
              iconBg={Colors.primaryDim}
              iconColor={Colors.primary}
              label={t('settings.replayWalkthrough')}
              sublabel={t('settings.replayWalkthroughSub')}
              onPress={handleReplayWalkthrough}
            />
          </View>

          {/* ── Tax Set-Aside Rate ── */}
          <SectionHeader label={t('settings.taxSection')} />
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={startEditTaxRate}
              activeOpacity={0.6}
              disabled={editingTaxRate}
            >
              <View style={[styles.iconBox, { backgroundColor: Colors.secondaryDim }]}>
                <Ionicons name="receipt-outline" size={17} color={Colors.secondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('settings.taxRate')}</Text>
                <Text style={styles.rowSublabel}>{t('settings.taxRateSub')}</Text>
              </View>
              {editingTaxRate ? (
                <View style={styles.milesEditRow}>
                  <TextInput
                    ref={taxRateRef}
                    style={styles.milesInput}
                    value={taxRateInput}
                    onChangeText={setTaxRateInput}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={saveTaxRate}
                    onBlur={saveTaxRate}
                    selectTextOnFocus
                  />
                  <Text style={styles.milesUnit}>%</Text>
                  <TouchableOpacity onPress={saveTaxRate} style={styles.milesSaveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.rowRightLabel}>{taxRate}%</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Income Goal ── */}
          <SectionHeader label={t('settings.goalSection')} />
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={startEditGoal}
              activeOpacity={0.6}
              disabled={editingGoal}
            >
              <View style={[styles.iconBox, { backgroundColor: Colors.secondaryDim }]}>
                <Ionicons name="trophy-outline" size={17} color={Colors.secondary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('settings.goalLabel')}</Text>
                <Text style={styles.rowSublabel}>{t('settings.goalSub')}</Text>
              </View>
              {editingGoal ? (
                <View style={{ flex: 1 }}>
                  {/* Period toggle */}
                  <View style={styles.goalPeriodRow}>
                    <TouchableOpacity
                      style={[styles.goalPeriodBtn, goalPeriod === 'weekly' && styles.goalPeriodBtnActive]}
                      onPress={() => setGoalPeriod('weekly')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.goalPeriodText, goalPeriod === 'weekly' && styles.goalPeriodTextActive]}>
                        {t('settings.goalWeekly')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.goalPeriodBtn, goalPeriod === 'monthly' && styles.goalPeriodBtnActive]}
                      onPress={() => setGoalPeriod('monthly')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.goalPeriodText, goalPeriod === 'monthly' && styles.goalPeriodTextActive]}>
                        {t('settings.goalMonthly')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Amount input */}
                  <View style={styles.milesEditRow}>
                    <Text style={styles.milesUnit}>$</Text>
                    <TextInput
                      ref={goalRef}
                      value={goalInput}
                      onChangeText={setGoalInput}
                      keyboardType="number-pad"
                      style={[styles.milesInput, { flex: 1 }]}
                      maxLength={7}
                      selectTextOnFocus
                      onSubmitEditing={saveGoal}
                    />
                    <TouchableOpacity onPress={saveGoal} style={styles.milesSaveBtn} activeOpacity={0.7}>
                      <Ionicons name="checkmark" size={17} color={Colors.onPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelGoal} style={styles.milesCancelBtn} activeOpacity={0.7}>
                      <Ionicons name="close" size={17} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.rowRight}>
                  <Text style={styles.rowRightLabel}>
                    {incomeGoal
                      ? `$${Math.round(incomeGoal.amount).toLocaleString()} / ${incomeGoal.period === 'weekly' ? t('settings.goalWeekly') : t('settings.goalMonthly')}`
                      : t('settings.notSet')}
                  </Text>
                  <Ionicons name="pencil-outline" size={14} color={Colors.textTertiary} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Appearance ── */}
          <SectionHeader label={t('settings.appearance')} />
          <View style={styles.segRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.segChip, active && styles.segChipActive]}
                  onPress={() => setThemeMode(opt.value)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.icon}
                    size={17}
                    color={active ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.segText, active && styles.segTextActive]}>
                    {t(`settings.appearance_${opt.value}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Language ── */}
          <SectionHeader label={t('settings.language')} />
          <View style={styles.card}>
            {LANGUAGES.map((lang, i) => {
              const selected = currentLang === lang.code;
              return (
                <React.Fragment key={lang.code}>
                  {i > 0 && <RowDivider />}
                  <TouchableOpacity
                    style={[styles.langRow, selected && styles.langRowActive]}
                    onPress={() => handleLanguageChange(lang.code)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.langLabels}>
                      <Text style={[styles.langNative, selected && styles.langNativeActive]}>
                        {lang.native}
                      </Text>
                      {lang.code !== 'en' && (
                        <Text style={styles.langEnglish}>{t(`language.${lang.code}`)}</Text>
                      )}
                    </View>
                    {selected && (
                      <View style={styles.langCheck}>
                        <Ionicons name="checkmark" size={16} color={Colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Notifications ── */}
          <SectionHeader label={t('settings.notifications')} />
          <View style={styles.card}>
            <Row
              icon="notifications-outline"
              iconBg={Colors.primaryDim}
              iconColor={Colors.primary}
              label={t('settings.notificationsLabel')}
              sublabel={t('settings.notificationsSub')}
              chevron={false}
              rightElement={
                <Switch
                  value={notifsEnabled}
                  onValueChange={(v) => {
                    setSetting('notifications_enabled', v ? 'true' : 'false');
                    setNotifsEnabled(v);
                    if (v) setupNotifications().catch(() => {});
                    else cancelAllNotifications().catch(() => {});
                  }}
                  trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
                  thumbColor={notifsEnabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </View>

          {/* ── Data & Privacy ── */}
          <SectionHeader label={t('settings.dataPrivacy')} />

          {/* Rate Network flywheel — show the driver they're building something */}
          <View style={styles.netCard}>
            <View style={styles.netHeaderRow}>
              <View style={styles.netIcon}>
                <Ionicons name="git-network-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.netTitle}>{t('settings.rateNetworkTitle')}</Text>
            </View>

            <View style={styles.netStatsRow}>
              <View style={styles.netStat}>
                <Text style={styles.netStatNum}>{contribCount.toLocaleString()}</Text>
                <Text style={styles.netStatLabel}>{t('settings.rateNetworkYou')}</Text>
              </View>
              {networkCount != null && networkCount > 0 && (
                <>
                  <View style={styles.netStatSep} />
                  <View style={styles.netStat}>
                    <Text style={styles.netStatNum}>{networkCount.toLocaleString()}</Text>
                    <Text style={styles.netStatLabel}>{t('settings.rateNetworkPool')}</Text>
                  </View>
                </>
              )}
            </View>

            <Text style={styles.netBlurb}>
              {shareData ? t('settings.rateNetworkBlurbOn') : t('settings.rateNetworkBlurbOff')}
            </Text>
          </View>

          <View style={styles.card}>
            <Row
              icon="shield-checkmark-outline"
              iconBg={Colors.primaryDim}
              iconColor={Colors.primary}
              label={t('settings.shareRateData')}
              sublabel={t('settings.shareRateDataSub')}
              chevron={false}
              rightElement={
                <Switch
                  value={shareData}
                  onValueChange={(v) => {
                    setSetting('share_rate_data', v ? 'true' : 'false');
                    setShareData(v);
                  }}
                  trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
                  thumbColor={shareData ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </View>

          {/* ── About ── */}
          <SectionHeader label={t('settings.about')} />
          <View style={styles.card}>
            <Row
              icon="phone-portrait-outline"
              label={t('settings.appVersion')}
              rightLabel={APP_VERSION}
              chevron={false}
            />
            <RowDivider />
            <Row
              icon="document-text-outline"
              iconBg={Colors.surfaceHigh}
              label={t('settings.terms')}
              onPress={() => Linking.openURL(URL_TERMS)}
            />
            <RowDivider />
            <Row
              icon="shield-checkmark-outline"
              iconBg={Colors.surfaceHigh}
              label={t('settings.privacy')}
              onPress={() => Linking.openURL(URL_PRIVACY)}
            />
          </View>

          {/* ── Sign Out ── */}
          {!isGuest && (
            <>
              <View style={styles.signOutSpacer} />
              <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={18} color={Colors.secondary} />
                <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Delete Account ── */}
          {!isGuest && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color={Colors.textTertiary} />
              ) : (
                <Text style={styles.deleteText}>{t('settings.deleteAccount')}</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  flex:  { flex: 1 },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenH,
    paddingTop:     20,
    paddingBottom:  8,
  },
  headerTitle: {
    fontFamily: FontFamily.monoBold,
    fontSize:   FontSize.subtitle,
    color:      Colors.textPrimary,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingTop: 16 },

  // Profile card
  profileCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.md,
    padding:         Spacing.cardPad,
    marginBottom:    32,
    gap:             16,
  },
  avatarCircle: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: Colors.primaryMid,
    borderWidth:     1,
    borderColor:     Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  avatarInitial: {
    fontFamily: FontFamily.monoBold,
    fontSize:   FontSize.subtitle,
    color:      Colors.primary,
  },
  profileInfo:  { flex: 1 },
  profileEmail: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize:   FontSize.body,
    color:      Colors.textPrimary,
    marginBottom: 5,
  },
  profileSub: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
  },
  profileBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
  },
  profileBadgeDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.primary,
  },
  profileBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.caption,
    color:      Colors.primary,
  },

  // Pro active pill
  proPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondaryDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  proPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.secondary },
  proPillText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.secondary },

  // Section header
  sectionHeader: {
    ...sectionLabel(Colors),
    marginBottom:  10,
    marginTop:     0,
    paddingLeft:   4,
  },

  // Card container (groups rows)
  card: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.md,
    marginBottom:    28,
    overflow:        'hidden',
  },

  // Rate Network flywheel card
  netCard: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.primaryMid,
    borderRadius:    Radius.md,
    padding:         Spacing.cardPad,
    marginBottom:    12,
  },
  netHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  netIcon: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  netTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  netStatsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  netStat: { flex: 1, alignItems: 'center' },
  netStatNum: { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -0.5 },
  netStatLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  netStatSep: { width: 1, height: 36, backgroundColor: Colors.border, marginHorizontal: 12 },
  netBlurb: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center' },

  // Row
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical:   14,
    paddingHorizontal: Spacing.cardPad,
    gap:           14,
  },
  rowDisabled: { opacity: 0.5 },

  iconBox: {
    width:          36,
    height:         36,
    borderRadius:   Radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  rowContent: { flex: 1 },
  rowLabel: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.body,
    color:      Colors.textPrimary,
    marginBottom: 2,
  },
  rowLabelDanger: { color: Colors.danger },
  rowSublabel: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
    lineHeight: 16,
  },
  rowRight: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
  },
  rowRightLabel: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.label,
    color:      Colors.textSecondary,
  },

  rowDivider: {
    height:          1,
    backgroundColor: Colors.borderSubtle,
    marginLeft:      Spacing.cardPad + 36 + 14, // align with text, past icon
  },

  // Weekly miles inline edit
  milesEditRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  milesInput: {
    fontFamily:      FontFamily.monoBold,
    fontSize:        FontSize.body,
    color:           Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    minWidth:        52,
    textAlign:       'right',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  milesUnit: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
  },
  milesSaveBtn: {
    width:           28,
    height:          28,
    borderRadius:    Radius.sm,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  milesCancelBtn: {
    width:           28,
    height:          28,
    borderRadius:    Radius.sm,
    backgroundColor: Colors.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Goal period toggle
  goalPeriodRow: {
    flexDirection:  'row',
    gap:            6,
    marginBottom:   6,
    justifyContent: 'flex-end',
  },
  goalPeriodBtn: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  goalPeriodBtnActive: {
    backgroundColor: Colors.secondary,
    borderColor:     Colors.secondary,
  },
  goalPeriodText: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
  },
  goalPeriodTextActive: {
    color: Colors.onPrimary,
  },

  // Appearance segmented control
  segRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  segChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 13,
  },
  segChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  segText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.textSecondary, letterSpacing: 0.3 },
  segTextActive: { color: Colors.primary },

  // Language rows
  langRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   14,
    paddingHorizontal: Spacing.cardPad,
  },
  langRowActive: {
    backgroundColor: Colors.primaryDim,
  },
  langLabels: { gap: 2 },
  langNative: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.body,
    color:      Colors.textPrimary,
  },
  langNativeActive: { color: Colors.primary },
  langEnglish: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
  },
  langCheck: {
    width:           28,
    height:          28,
    borderRadius:    Radius.pill,
    backgroundColor: Colors.primaryMid,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Sign out
  signOutSpacer: { height: 8 },
  signOutBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    backgroundColor: Colors.secondaryDim,
    borderWidth:    1,
    borderColor:    Colors.secondary + '30',
    borderRadius:   Radius.md,
    paddingVertical: 15,
    marginBottom:   12,
  },
  signOutText: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize:   FontSize.body,
    color:      Colors.secondary,
  },

  // Delete account
  deleteBtn: {
    alignItems:     'center',
    paddingVertical: 12,
  },
  deleteText: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.label,
    color:      Colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
