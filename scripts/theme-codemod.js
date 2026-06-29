// One-off codemod: convert "simple" screens/components to the themed makeStyles
// pattern. Only run on files whose StyleSheet is consumed solely by the default
// component (no module-scope sub-component uses `styles`).
const fs = require('fs');
const path = require('path');

const FILES = [
  'src/screens/DashboardScreen.tsx',
  'src/screens/ExpensesScreen.tsx',
  'src/screens/CheckLoadScreen.tsx',
  'src/screens/IFTAScreen.tsx',
  'src/screens/HistoryScreen.tsx',
  'src/screens/FuelScreen.tsx',
  'src/screens/AddLoadScreen.tsx',
  'src/screens/auth/SignInScreen.tsx',
  'src/screens/auth/SignUpScreen.tsx',
  'src/screens/onboarding/ProfileSetupScreen.tsx',
  'src/screens/onboarding/OnboardingFuelScreen.tsx',
  'src/screens/onboarding/OnboardingMilesScreen.tsx',
  'src/screens/onboarding/OnboardingResultScreen.tsx',
  'src/screens/onboarding/OnboardingExpensesScreen.tsx',
  'src/components/FirstLoadCelebration.tsx',
  'src/components/FairMarketLock.tsx',
  'src/components/FreeUsageMeter.tsx',
  'src/components/GoalProgressCard.tsx',
  'src/components/AddressAutocomplete.tsx',
  'src/components/MonthCalendar.tsx',
  'src/components/WeekCalendar.tsx',
];

let failed = [];
for (const rel of FILES) {
  const file = path.resolve(rel);
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;

  // 1) React import: ensure useMemo.
  if (!/\buseMemo\b/.test(s)) {
    if (/import React, \{([^}]*)\} from 'react';/.test(s)) {
      s = s.replace(/import React, \{([^}]*)\} from 'react';/, (m, g) => `import React, {${g.replace(/\s*$/, '')}, useMemo } from 'react';`);
    } else if (/import React from 'react';/.test(s)) {
      s = s.replace(/import React from 'react';/, `import React, { useMemo } from 'react';`);
    } else {
      failed.push(`${rel}: no React import`); continue;
    }
  }

  // 2) Theme import: ensure ThemeColors + sectionLabel in the destructure; capture path prefix.
  const themeRe = /import\s*\{([^}]*)\}\s*from\s*'((?:\.\.\/)+)theme\/theme';/;
  const tm = s.match(themeRe);
  if (!tm) { failed.push(`${rel}: no theme import`); continue; }
  const prefix = tm[2];
  let members = tm[1].split(',').map(x => x.trim()).filter(Boolean);
  if (!members.includes('ThemeColors')) members.push('ThemeColors');
  if (!members.includes('sectionLabel')) members.push('sectionLabel');
  s = s.replace(themeRe, `import { ${members.join(', ')} } from '${prefix}theme/theme';`);

  // 3) Add useTheme import right after the theme import (same path depth).
  if (!/from '.*theme\/ThemeContext'/.test(s)) {
    s = s.replace(themeRe.test(s) ? new RegExp(`import \\{ ${members.join(', ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\} from '${prefix.replace(/\//g,'\\/')}theme\\/theme';`) : themeRe,
      (m) => `${m}\nimport { useTheme } from '${prefix}theme/ThemeContext';`);
  }

  // 4) Insert hook + memoised styles as the first lines of the default component.
  const compRe = /(export default function [A-Za-z0-9_]+\([^)]*\)(?::[^ {]+)?\s*\{)/;
  if (!compRe.test(s)) { failed.push(`${rel}: no default component`); continue; }
  s = s.replace(compRe, `$1\n  const { colors: Colors } = useTheme();\n  const styles = useMemo(() => makeStyles(Colors), [Colors]);`);

  // 5) styles → makeStyles factory.
  if (!/const styles = StyleSheet\.create\(\{/.test(s)) { failed.push(`${rel}: no 'const styles = StyleSheet.create'`); continue; }
  s = s.replace(/const styles = StyleSheet\.create\(\{/, 'const makeStyles = (Colors: ThemeColors) => StyleSheet.create({');

  // 6) Themed section labels + on-primary text.
  s = s.replace(/\.\.\.SectionLabel/g, '...sectionLabel(Colors)');
  s = s.replace(/color: Colors\.background/g, 'color: Colors.onPrimary');
  s = s.replace(/color=\{Colors\.background\}/g, 'color={Colors.onPrimary}');

  if (s === orig) { failed.push(`${rel}: no change`); continue; }
  fs.writeFileSync(file, s);
  console.log('converted', rel);
}
if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f)); process.exit(0); }
console.log('\nall converted');
