import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import * as haptics from '../lib/haptics';

import DashboardScreen from '../screens/DashboardScreen';
import FuelScreen      from '../screens/FuelScreen';
import IFTAScreen      from '../screens/IFTAScreen';
import ExpensesScreen  from '../screens/ExpensesScreen';
import HistoryScreen   from '../screens/HistoryScreen';
import { capture } from '../lib/analytics';

const Tab = createBottomTabNavigator();
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: {
  name: string;
  active: IoniconsName;
  inactive: IoniconsName;
  label: string;
}[] = [
  { name: 'Dashboard', active: 'grid',          inactive: 'grid-outline',          label: 'Home'     },
  { name: 'Fuel',      active: 'flash',         inactive: 'flash-outline',         label: 'Fuel'     },
  { name: 'IFTA',      active: 'document-text', inactive: 'document-text-outline', label: 'IFTA'     },
  { name: 'Expenses',  active: 'wallet',        inactive: 'wallet-outline',        label: 'Expenses' },
  { name: 'History',   active: 'time',          inactive: 'time-outline',          label: 'History'  },
];

// Custom tab icon with active indicator bar
function TabIcon({
  focused,
  iconActive,
  iconInactive,
  label,
}: {
  focused: boolean;
  iconActive: IoniconsName;
  iconInactive: IoniconsName;
  label: string;
}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.tabItem}>
      {/* Active indicator — teal bar at top */}
      <View style={[styles.indicator, focused && styles.indicatorActive]} />

      {/* Icon with optional glow background */}
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Ionicons
          name={focused ? iconActive : iconInactive}
          size={22}
          color={focused ? Colors.primary : Colors.textSecondary}
        />
      </View>

      {/* Label */}
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabNavigator() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name)!;
        return {
          headerShown: false,

          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false, // We render our own label inside TabIcon

          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconActive={tab.active}
              iconInactive={tab.inactive}
              label={tab.label}
            />
          ),

          // Disable the default press ripple/highlight
          tabBarItemStyle: styles.tabBarItem,
        };
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          listeners={{
            tabPress: () => haptics.tapLight(),
            focus:    () => capture('tab_viewed', { tab: tab.name.toLowerCase() }),
          }}
          component={
            tab.name === 'Dashboard' ? DashboardScreen :
            tab.name === 'Fuel'      ? FuelScreen      :
            tab.name === 'IFTA'      ? IFTAScreen      :
            tab.name === 'Expenses'  ? ExpensesScreen  :
                                       HistoryScreen
          }
        />
      ))}
    </Tab.Navigator>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.chrome,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 82,
    // Shadow above tab bar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  tabBarItem: {
    paddingTop: 0,
    paddingBottom: 0,
  },

  // Each tab's content column
  tabItem: {
    alignItems: 'center',
    paddingTop: 6,
    width: 56,
  },

  // Green bar at very top of tab bar for active tab
  indicator: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: Colors.primary,
  },

  // Icon container — subtle green pill when active
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 3,
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryGlow,
  },

  // Label
  tabLabel: {
    fontFamily: FontFamily.monoRegular,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: FontFamily.monoSemiBold,
  },
});
