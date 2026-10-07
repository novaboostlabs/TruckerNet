// Builders for realistic driver data. Every helper writes through the app's
// own database API, so tests exercise the same paths the screens do.
import {
  mergeFuelEntries,
  replaceUserExpenses,
  saveLoad,
  setSetting,
  type FuelEntryRow,
  type LoadInsert,
  type StateMileageInsert,
} from '../../src/db/database';

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

/** Onboarding answers: weekly miles + weekly fuel spend. */
export function onboard({ weeklyMiles, weeklyFuel }: { weeklyMiles: number; weeklyFuel?: number }) {
  setSetting('weekly_miles', String(weeklyMiles));
  if (weeklyFuel !== undefined) setSetting('weekly_fuel_cost', String(weeklyFuel));
}

/** Fixed monthly costs (truck payment, insurance, …) as the Expenses tab saves them. */
export function monthlyExpenses(items: Record<string, number>) {
  replaceUserExpenses(
    Object.entries(items).map(([label, amount]) => ({
      id: nextId('exp'), label, category: label, amount, frequency: 'monthly', monthly_equivalent: amount,
    })),
  );
}

export function fuelEntry(e: Partial<FuelEntryRow> & { date: string }) {
  const gallons = e.gallons ?? 100;
  const dollars = e.dollars_spent ?? gallons * 4;
  const miles   = e.miles_driven ?? 0;
  mergeFuelEntries([{
    id: e.id ?? nextId('fuel'),
    date: e.date,
    dollars_spent: dollars,
    gallons,
    miles_driven: miles,
    cost_per_mile: miles > 0 ? dollars / miles : 0,
    price_per_gallon: dollars / gallons,
    mpg: miles > 0 ? miles / gallons : 0,
    odometer_reading: e.odometer_reading ?? 0,
    state_purchased: e.state_purchased ?? 'TX',
  }]);
}

export function load(
  l: Partial<LoadInsert> & { gross_pay: number; total_miles: number },
  states: StateMileageInsert[] = [{ state: 'TX', miles: l.total_miles }],
) {
  return saveLoad({
    pickup_address: '', pickup_city: 'Dallas', pickup_state: 'TX',
    delivery_address: '', delivery_city: 'Houston', delivery_state: 'TX',
    equipment_type: 'dry_van', is_backhaul: 0, status: 'completed',
    fuel_cost_for_load: 0, fixed_cost_for_load: 0, net_pay: 0,
    gross_rate_per_mile: l.gross_pay / l.total_miles, net_rate_per_mile: 0,
    ...l,
  }, states);
}
