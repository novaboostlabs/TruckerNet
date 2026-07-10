import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, Spacing, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import {
  getUserExpenses, markExpensesReviewed,
  confirmExpense, confirmAllExpenses,
  getStaleCategoryAlerts, StaleCategoryAlert,
  CATEGORY_AGING_DAYS,
} from '../db/database';
import { rescheduleExpenseReviewAfterCompletion } from '../lib/notifications';
import AccentRule from './AccentRule';

interface Props {
  visible: boolean;
  onClose: () => void;
  onGoToExpenses: () => void;   // "Edit expenses" → Expenses tab
}

function money(n: number): string {
  // Pre-round: RN/Hermes doesn't reliably apply toLocaleString's fraction-digit
  // options, so rounding the number is what actually caps the decimals.
  return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function ExpenseReviewModal({ visible, onClose, onGoToExpenses }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const expenses = useMemo(() => getUserExpenses(), [visible]);
  const staleAlerts = useMemo(() => {
    const map: Record<string, StaleCategoryAlert> = {};
    getStaleCategoryAlerts().forEach((a) => { map[a.expenseId] = a; });
    return map;
  }, [visible]);

  const staleCategoryLabel: Record<string, string> = {
    insurance: 'Annual renewal?',
    truck:     'Payment changed?',
    eld:       'Subscription renewed?',
    loadboard: 'Subscription renewed?',
    maintenance: 'Still accurate?',
    parking:   'Rate changed?',
    other:     'Still accurate?',
  };

  function handleConfirmOne(id: string) {
    confirmExpense(id);
    setConfirmedIds((prev) => new Set([...prev, id]));
  }

  function handleConfirm() {
    confirmAllExpenses();
    markExpensesReviewed();
    rescheduleExpenseReviewAfterCompletion().catch(() => {});
    setConfirmed(true);
    setTimeout(() => { setConfirmed(false); setConfirmedIds(new Set()); onClose(); }, 900);
  }

  function handleEdit() {
    onClose();
    onGoToExpenses();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('expenses.reviewModalEyebrow')}</Text>
            <Text style={styles.title}>{t('expenses.reviewModalTitle')}</Text>
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subheading}>{t('expenses.reviewModalSub')}</Text>

        {/* Expense list */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {expenses.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('expenses.reviewModalEmpty')}</Text>
            </View>
          ) : (
            expenses.map((e, i) => {
              const alert = staleAlerts[e.id];
              const isStale = !!alert && !confirmedIds.has(e.id);
              const rowConfirmed = confirmedIds.has(e.id);
              return (
                <View key={e.id} style={[styles.expRow, i > 0 && styles.expRowBorder, isStale && styles.expRowStale]}>
                  <View style={styles.expLeft}>
                    <Text style={styles.expLabel} numberOfLines={1}>{e.label}</Text>
                    <Text style={styles.expMeta}>${money(e.amount)} · {e.frequency}</Text>
                    {isStale && (
                      <Text style={styles.expStaleHint}>
                        {staleCategoryLabel[e.category] ?? 'Still accurate?'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.expRight}>
                    <Text style={styles.expMonthly}>
                      ${money(e.monthly_equivalent)}<Text style={styles.expPerMo}>/mo</Text>
                    </Text>
                    {isStale && (
                      <TouchableOpacity
                        style={styles.rowConfirmBtn}
                        onPress={() => handleConfirmOne(e.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={13} color={Colors.primary} />
                        <Text style={styles.rowConfirmText}>Still correct</Text>
                      </TouchableOpacity>
                    )}
                    {rowConfirmed && (
                      <Text style={styles.rowConfirmedText}>✓ Confirmed</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* CTAs */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={16} color={Colors.textPrimary} />
            <Text style={styles.editBtnText}>{t('expenses.reviewModalEdit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, confirmed && styles.confirmBtnDone]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Ionicons
              name={confirmed ? 'checkmark-circle' : 'checkmark'}
              size={18}
              color={Colors.onPrimary}
            />
            <Text style={styles.confirmBtnText}>
              {confirmed ? t('expenses.reviewModalConfirmed') : t('expenses.reviewModalConfirm')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.screenH,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: Colors.border,
    marginTop: 10, marginBottom: 6,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 12, paddingBottom: 6,
  },
  eyebrow: { ...sectionLabel(Colors), marginBottom: 4 },
  title: { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, letterSpacing: -0.4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  subheading: {
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary,
    lineHeight: 22, marginBottom: 20,
  },

  list: { flex: 1, marginBottom: 20 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  expRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  expRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  expRowStale: {
    backgroundColor: Colors.secondaryDim,
    borderRadius: Radius.sm, paddingHorizontal: 10, marginHorizontal: -10,
  },
  expLeft: { flex: 1, marginRight: 12 },
  expLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  expMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  expStaleHint: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.secondary, marginTop: 4, fontStyle: 'italic',
  },
  expRight: { alignItems: 'flex-end', gap: 6 },
  expMonthly: { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary },
  expPerMo: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },
  rowConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  rowConfirmText: { fontFamily: FontFamily.monoSemiBold, fontSize: 11, color: Colors.primary },
  rowConfirmedText: { fontFamily: FontFamily.monoRegular, fontSize: 11, color: Colors.primary },

  footer: { flexDirection: 'row', gap: 12 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 15,
  },
  editBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  confirmBtnDone: { backgroundColor: Colors.primary + 'CC' },
  confirmBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
});
