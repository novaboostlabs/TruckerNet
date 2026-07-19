import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { searchAddress, isMapboxConfigured, AddressSuggestion } from '../lib/mapbox';
import * as haptics from '../lib/haptics';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder: string;
  icon: IoniconName;
  iconColor?: string;
  /**
   * Fires when the suggestion dropdown appears (or grows). Hosts whose field
   * sits near the bottom of a ScrollView use this to scroll the list into
   * view — otherwise the dropdown renders below the fold / under the footer
   * button and looks broken.
   */
  onSuggestionsOpen?: () => void;
}

const DEBOUNCE_MS = 300;

// Debounced address type-ahead. Suggestions render inline below the field
// (rather than an overlay) so it behaves correctly inside a ScrollView.
export default function AddressAutocomplete({
  value, onChangeText, onSelect, placeholder, icon, iconColor, onSuggestionsOpen,
}: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
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
    haptics.tapMedium();
    onSelect(s);
  }

  function handleBlur() {
    // Generous grace so a tap on a suggestion row always wins the race against
    // the field blurring — 150ms was too tight on slower devices.
    blurTimer.current = setTimeout(() => setFocused(false), 300);
  }

  const showList = focused && suggestions.length > 0 && value.trim() !== selectedText.current;

  // Announce the dropdown appearing/growing so a bottom-of-screen host can
  // scroll it into view. Waits a frame so the rows have laid out first.
  useEffect(() => {
    if (!showList || !onSuggestionsOpen) return;
    const t = setTimeout(onSuggestionsOpen, 50);
    return () => clearTimeout(t);
  }, [showList, suggestions.length]); // eslint-disable-line

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
            // Capture-phase responder: pick() runs the instant the finger
            // touches DOWN, before the ScrollView / keyboard-tap logic can
            // claim or cancel the gesture. TouchableOpacity onPressIn was
            // intermittently swallowed on device (tap read as a micro-drag →
            // dropdown closed with nothing selected).
            <View
              key={s.id}
              style={styles.option}
              onStartShouldSetResponderCapture={() => true}
              onResponderGrant={() => pick(s)}
            >
              <Ionicons name="location-outline" size={16} color={Colors.textSecondary} style={styles.optionIcon} />
              <Text style={styles.optionText} numberOfLines={2}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 14,
  },
  inputCardOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: Colors.border },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary, padding: 0 },

  dropdown: {
    backgroundColor: Colors.surface, borderWidth: 1, borderTopWidth: 0, borderColor: Colors.border,
    borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden',
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  optionIcon: { marginRight: 10 },
  optionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textPrimary, lineHeight: 19 },
});
