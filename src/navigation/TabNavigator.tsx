import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Colors, FontFamily } from '../theme/theme';

import DashboardScreen from '../screens/DashboardScreen';
import FuelScreen from '../screens/FuelScreen';
import IFTAScreen from '../screens/IFTAScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Tab = createBottomTabNavigator();

// Simple text icons — will be swapped for proper icons in a later phase
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '⊞',
    Fuel: '⛽',
    IFTA: '📋',
    Expenses: '💰',
    History: '🕐',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
      {icons[label]}
    </Text>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.background, borderBottomWidth: 0, shadowOpacity: 0 },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontFamily: FontFamily.semiBold, fontSize: 17 },
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: FontFamily.regular,
          fontSize: 11,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Fuel" component={FuelScreen} />
      <Tab.Screen name="IFTA" component={IFTAScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
