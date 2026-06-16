import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

type Filter = 'week' | 'month' | 'all';

const DEMO_LOADS = [
  { id: '1', date: 'Jun 14', from: 'Chicago, IL',   to: 'Dallas, TX',    miles: 921,  gross: 2100, net: 1432,  rpm: 2.28, positive: true  },
  { id: '2', date: 'Jun 11', from: 'Atlanta, GA',   to: 'Miami, FL',     miles: 662,  gross: 1850, net: 1198,  rpm: 2.79, positive: true  },
  { id: '3', date: 'Jun 8',  from: 'Memphis, TN',   to: 'Houston, TX',   miles: 560,  gross:  980, net:  287,  rpm: 1.75, positive: false },
  { id: '4', date: 'Jun 5',  from: 'Nashville, TN', to: 'Atlanta, GA',   miles: 248,  gross:  720, net:  488,  rpm: 2.90, positive: true  },
  { id: '5', date: 'Jun 2',  from: 'Houston, TX',   to: 'Chicago, IL',   miles: 1092, gross: 2650, net: 1741,  rpm: 2.43, positive: true  },
  { id: '6', date: 'May 29', from: 'Miami, FL',     to: 'Nashville, TN', miles: 882,  gross: 1980, net: 1253,  rpm: 2.25, positive: true  },
];

const TOTALS: Record<Filter, { gross: number; net: number; miles: number; rpm: number; count: number }> = {
  week:  { gross:  5620, net: 2917, miles: 2231,  rpm: 2.15, count: 3 },
  month: { gross: 21800, net: 7640, miles: 9183,  rpm: 2.15, count: 11 },
  all:   { gross: 21800, net: 7640, miles: 9183,  rpm: 2.15, count: 11 },
};

export default function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('month');
  const totals = TOTALS[filter];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>RECORDS</Text>
            <Text style={styles.title}>History</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {([['week','This Week'],['month','This Month'],['all','All Time']] as [Filter,string][]).map(([key,label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
              onPress={() => setFilter(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary totals */}
        <View style={styles.totalsCard}>
          {[
            { label: 'GROSS', value: `$${(totals.gross/1000).toFixed(1)}k` },
            { label: 'NET',   value: `$${(totals.net/1000).toFixed(1)}k`   },
            { label: 'MILES', value: totals.miles.toLocaleString()          },
            { label: 'AVG RPM', value: `$${totals.rpm.toFixed(2)}`         },
          ].map(({ label, value }, i, arr) => (
            <React.Fragment key={label}>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text style={[styles.totalValue, label === 'NET' && { color: Colors.primary }]}>{value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.totalDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Load list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{totals.count} LOADS</Text>
          <View style={styles.loadsCard}>
            {DEMO_LOADS.map((load, i) => (
              <React.Fragment key={load.id}>
                <TouchableOpacity style={styles.loadRow} activeOpacity={0.7}>
                  <View style={styles.loadLeft}>
                    <Text style={styles.loadRoute} numberOfLines={1}>
                      {load.from.split(',')[0]} → {load.to.split(',')[0]}
                    </Text>
                    <Text style={styles.loadMeta}>
                      {load.date} · {load.miles.toLocaleString()} mi · ${load.rpm.toFixed(2)}/mi
                    </Text>
                  </View>
                  <View style={styles.loadRight}>
                    <Text style={[styles.loadNet, { color: load.positive ? Colors.primary : Colors.danger }]}>
                      {load.positive ? '+' : ''}${load.net.toLocaleString()}
                    </Text>
                    <Text style={styles.loadGross}>${load.gross.toLocaleString()} gross</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                {i < DEMO_LOADS.length - 1 && <View style={styles.loadDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24 },
  eyebrow: { ...SectionLabel, marginBottom: 4 },
  title:   { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },
  exportBtn: {
    width: 38, height: 38, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: {
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterChipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  filterChipText:       { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary, fontFamily: FontFamily.semiBold },

  totalsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, flexDirection: 'row',
    paddingVertical: 18, paddingHorizontal: 16, marginBottom: 24,
  },
  totalCell:    { flex: 1, alignItems: 'center', gap: 5 },
  totalLabel:   { ...SectionLabel, fontSize: 9, marginBottom: 0 },
  totalValue:   { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  totalDivider: { width: 1, backgroundColor: Colors.border },

  section:      { marginBottom: 24 },
  sectionLabel: { ...SectionLabel, marginBottom: 12 },

  loadsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  loadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.cardPad,
  },
  loadLeft:   { flex: 1, marginRight: 12 },
  loadRoute:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  loadMeta:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadRight:  { alignItems: 'flex-end' },
  loadNet:    { fontFamily: FontFamily.bold, fontSize: FontSize.body, marginBottom: 2 },
  loadGross:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadDivider:{ height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
});
