import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize } from '../theme/theme';

import DashboardScreen from '../screens/DashboardScreen';
import FuelScreen from '../screens/FuelScreen';
import IFTAScreen from '../screens/IFTAScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard: { active: 'grid',          inactive: 'grid-outline' },
  Fuel:      { active: 'flash',         inactive: 'flash-outline' },
  IFTA:      { active: 'document-text', inactive: 'document-text-outline' },
  Expenses:  { active: 'wallet',        inactive: 'wallet-outline' },
  History:   { active: 'time',          inactive: 'time-outline' },
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Header
        headerStyle: {
          backgroundColor: Colors.background,
          borderBottomWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontFamily: FontFamily.semiBold,
          fontSize: 17,
        },
        headerShown: false, // Each screen manages its own header

        // Tab bar
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 82,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: 10,
          marginTop: 2,
          letterSpacing: 0.2,
        },

        // Icons
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Fuel"      component={FuelScreen} />
      <Tab.Screen name="IFTA"      component={IFTAScreen} />
      <Tab.Screen name="Expenses"  component={ExpensesScreen} />
      <Tab.Screen name="History"   component={HistoryScreen} />
    </Tab.Navigator>
  );
}
