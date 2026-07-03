import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

/**
 * Swipe-left a list row to reveal Edit + Delete actions. Wraps any row content.
 * The action handlers are the caller's — Delete typically shows a confirm Alert
 * first, then removes + resyncs. Auto-closes the swipe after either tap.
 */
export default function SwipeableRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const ref = useRef<Swipeable>(null);

  const close = () => ref.current?.close();

  function renderRightActions() {
    return (
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.editAction]}
          onPress={() => { close(); onEdit(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil" size={17} color={Colors.onPrimary} />
          <Text style={[styles.actionText, { color: Colors.onPrimary }]}>{t('common.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.action, styles.deleteAction]}
          onPress={() => { close(); onDelete(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="trash" size={17} color="#FFFFFF" />
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  actions: { flexDirection: 'row' },
  action: {
    width: 76, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  editAction:   { backgroundColor: Colors.primary },
  deleteAction: { backgroundColor: Colors.danger },
  actionText:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption },
});
