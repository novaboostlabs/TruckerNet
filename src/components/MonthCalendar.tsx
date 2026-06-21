import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '../theme/theme';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Props {
  year:        number;
  month:       number; // 0-indexed (Jan = 0)
  loadsByDate: Record<string, number>; // 'YYYY-MM-DD' → count
  selectedDay: string | null;
  onSelectDay: (iso: string | null) => void;
  today:       string; // YYYY-MM-DD
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function MonthCalendar({
  year, month, loadsByDate, selectedDay, onSelectDay, today,
}: Props) {
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun

  // Build flat array of day numbers (null = padding)
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Split into weeks
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.wrap}>
      {/* Day-of-week headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map(h => (
          <View key={h} style={styles.headerCell}>
            <Text style={styles.headerText}>{h}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;

            const iso      = `${year}-${pad(month + 1)}-${pad(day)}`;
            const count    = loadsByDate[iso] ?? 0;
            const isToday  = iso === today;
            const isSel    = iso === selectedDay;
            const hasLoads = count > 0;

            return (
              <TouchableOpacity
                key={di}
                style={styles.cell}
                onPress={() => onSelectDay(isSel ? null : iso)}
                activeOpacity={0.7}
              >
                {/* Selected background */}
                {isSel && <View style={styles.selectedBg} />}

                {/* Today ring */}
                {isToday && !isSel && <View style={styles.todayRing} />}

                {/* Day number */}
                <Text style={[
                  styles.dayNum,
                  isSel     && styles.dayNumSelected,
                  isToday && !isSel && styles.dayNumToday,
                  !hasLoads && !isToday && !isSel && styles.dayNumDim,
                ]}>
                  {day}
                </Text>

                {/* Load indicator dot */}
                {hasLoads && (
                  <View style={styles.dotRow}>
                    <View style={[styles.dot, isSel && styles.dotSelected]} />
                    {count > 1 && (
                      <Text style={[styles.countLabel, isSel && styles.countLabelSelected]}>
                        {count}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },

  headerRow: { flexDirection: 'row', marginBottom: 4 },
  headerCell: { width: CELL_SIZE, alignItems: 'center', paddingVertical: 6 },
  headerText: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.caption,
    color:      Colors.textTertiary,
    letterSpacing: 0.5,
  },

  weekRow: { flexDirection: 'row', marginBottom: 2 },

  cell: {
    width:          CELL_SIZE,
    height:         CELL_SIZE + 10,
    alignItems:     'center',
    justifyContent: 'center',
  },

  selectedBg: {
    position:        'absolute',
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: Colors.primary,
  },

  todayRing: {
    position:    'absolute',
    width:       36,
    height:      36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  dayNum: {
    fontFamily: FontFamily.medium,
    fontSize:   FontSize.label,
    color:      Colors.textPrimary,
  },
  dayNumSelected: {
    color:      Colors.background,
    fontFamily: FontFamily.bold,
  },
  dayNumToday: {
    color:      Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  dayNumDim: {
    color: Colors.textTertiary,
  },

  dotRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            3,
    position:       'absolute',
    bottom:         4,
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
  countLabel: {
    fontFamily: FontFamily.bold,
    fontSize:   8,
    color:      Colors.primary,
    lineHeight: 10,
  },
  countLabelSelected: {
    color: Colors.background,
  },
});
