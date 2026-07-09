// Which entry types exist on a given calendar day, driving the multi-colour
// day markers in the History week/month calendars.
//   load    → teal  (Colors.primary)
//   fuel    → amber (Colors.secondary)
//   expense → red   (Colors.danger)
export interface DayMarks {
  load?:    boolean;
  fuel?:    boolean;
  expense?: boolean;
}

export type MarksByDate = Record<string, DayMarks>;
