import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius } from '../theme/theme';
import { searchAddress, isMapboxConfigured, AddressSuggestion } from '../lib/mapbox';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder: string;
  icon: IoniconName;
  iconColor?: string;
}

const DEBOUNCE_MS = 300;

// Debounced address type-ahead. Suggestions render inline below the field
// (rather than an overlay) so it behaves correctly inside a ScrollView.
export default function AddressAutocomplete({
  value, onChangeText, onSelect, placeholder, icon, iconColor,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  // The exact text of the address the user just picked. While the field still
  // holds it, we never search or show the list — that's what keeps the dropdown
  // closed after a selection, regardless of any in-flight request resolving.
  const selectedText = useRef<string | null>(null);

  useEffect(() => {
    if (!isMapboxConfigured()) return;

    const q = value.trim();
    // Just-selected, or too short → nothing to show.
    if (q === selectedText.current || q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setSuggestions(await searchAddress(q, ctrl.signal));
      } catch (err: any) {
        if (err?.name !== 'AbortError') setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [value]);

  // Small delay before hiding on blur so an onPress on a suggestion fires first.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pick(s: AddressSuggestion) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    selectedText.current = s.label.trim();
    onChangeText(s.label);
    setSuggestions([]);
    setFocused(false);
    Keyboard.dismiss();
    onSelect(s);
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => setFocused(false), 150);
  }

  const showList = focused && suggestions.length > 0 && value.trim() !== selectedText.current;

  return (
    <View>
      <View style={[styles.inputCard, showList && styles.inputCardOpen]}>
        <Ionicons name={icon} size={16} color={iconColor ?? Colors.textSecondary} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={Colors.textSecondary} />}
      </View>

      {showList && (
        <View style={styles.dropdown}>
          {suggestions.map((s) => (
            // onPressIn fires on touch-DOWN, before keyboard-dismissal layout
            // shifts can cancel the gesture. onPress (touch-UP) is unreliable
            // here because the dropdown can unmount before the finger lifts.
            <TouchableOpacity key={s.id} style={styles.option} onPressIn={() => pick(s)} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={16} color={Colors.textSecondary} style={styles.optionIcon} />
              <Text style={styles.optionText} numberOfLines={2}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 14,
  },
  inputCardOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: Colors.border },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary, padding: 0 },

  dropdown: {
    backgroundColor: Colors.surface, borderWidth: 1, borderTopWidth: 0, borderColor: Colors.border,
    borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg, overflow: 'hidden',
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  optionIcon: { marginRight: 10 },
  optionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textPrimary, lineHeight: 19 },
});
