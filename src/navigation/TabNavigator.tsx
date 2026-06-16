import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize } from '../theme/theme';

import DashboardScreen from '../screens/DashboardScreen';
import FuelScreen      from '../screens/FuelScreen';
import IFTAScreen      from '../screens/IFTAScreen';
import ExpensesScreen  from '../screens/ExpensesScreen';
import HistoryScreen   from '../screens/HistoryScreen';

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
  return (
    <View style={styles.tabItem}>
      {/* Active indicator — green bar at top */}
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
        <Tab.Screen key={tab.name} name={tab.name} component={
          tab.name === 'Dashboard' ? DashboardScreen :
          tab.name === 'Fuel'      ? FuelScreen      :
          tab.name === 'IFTA'      ? IFTAScreen      :
          tab.name === 'Expenses'  ? ExpensesScreen  :
                                     HistoryScreen
        } />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0D0D0D',
    borderTopWidth: 0,
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
    borderRadius: 10,
    marginBottom: 3,
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryGlow,
  },

  // Label
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
});
