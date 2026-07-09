import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { MarksByDate } from './dayMarks';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface Props {
  weekDates:   string[];                  // 7 ISO dates Mon → Sun
  marksByDate: MarksByDate;               // ISO date → which entry types exist
  selectedDay: string | null;
  onSelectDay: (iso: string | null) => void;
  today:       string;                    // YYYY-MM-DD
}

export default function WeekCalendar({ weekDates, marksByDate, selectedDay, onSelectDay, today }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.row}>
      {weekDates.map((iso, i) => {
        const day      = parseInt(iso.split('-')[2], 10);
        const isToday  = iso === today;
        const isSel    = iso === selectedDay;
        const marks    = marksByDate[iso];
        const dots: string[] = [];
        if (marks?.load)    dots.push(isSel ? Colors.onPrimary : Colors.primary);
        if (marks?.fuel)    dots.push(isSel ? Colors.onPrimary : Colors.secondary);
        if (marks?.expense) dots.push(isSel ? Colors.onPrimary : Colors.danger);
        const hasMarks = dots.length > 0;

        return (
          <TouchableOpacity
            key={iso}
            style={styles.cell}
            onPress={() => onSelectDay(isSel ? null : iso)}
            activeOpacity={0.7}
          >
            {/* Day label */}
            <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
              {DAY_LABELS[i]}
            </Text>

            {/* Day number with selection/today states */}
            <View style={[
              styles.dayCircle,
              isSel   && styles.dayCircleSelected,
              isToday && !isSel && styles.dayCircleToday,
            ]}>
              <Text style={[
                styles.dayNum,
                isSel                      && styles.dayNumSelected,
                isToday && !isSel          && styles.dayNumToday,
                !hasMarks && !isToday && !isSel && styles.dayNumDim,
              ]}>
                {day}
              </Text>
            </View>

            {/* Per-type indicator dots (teal load / amber fuel / red expense) */}
            {hasMarks ? (
              <View style={styles.indicatorRow}>
                {dots.map((color, idx) => (
                  <View key={idx} style={[styles.dot, { backgroundColor: color }]} />
                ))}
              </View>
            ) : (
              <View style={styles.indicatorRow} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
  },

  cell: {
    flex:           1,
    alignItems:     'center',
    gap:            4,
  },

  dayLabel: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.caption,
    color:      Colors.textTertiary,
    letterSpacing: 0.3,
  },
  dayLabelToday: {
    color: Colors.primary,
  },

  dayCircle: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  dayCircleSelected: {
    backgroundColor: Colors.primary,
  },
  dayCircleToday: {
    borderWidth:  1,
    borderColor:  Colors.primary,
  },

  dayNum: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.label,
    color:      Colors.textPrimary,
  },
  dayNumSelected: {
    color:      Colors.background,
    fontFamily: FontFamily.monoBold,
  },
  dayNumToday: {
    color:      Colors.primary,
    fontFamily: FontFamily.monoSemiBold,
  },
  dayNumDim: {
    color: Colors.textTertiary,
  },

  indicatorRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            3,
    height:         12,
  },
  dot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: Colors.primary,
  },
  dotSelected: {
    backgroundColor: Colors.background,
  },
  countText: {
    fontFamily: FontFamily.monoBold,
    fontSize:   8,
    color:      Colors.primary,
    lineHeight: 10,
  },
  countTextSelected: {
    color: Colors.onPrimary,
  },
});
