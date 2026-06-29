<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into TruckerNet. The existing `posthog-react-native` package was already installed and a stub `src/lib/analytics.ts` existed. The wizard upgraded that file so the PostHog instance is always created (disabled gracefully when the key is absent), added `PostHogProvider` to `App.tsx` so `usePostHog()` works everywhere, wired the environment variables into `.env`, and added 7 new business-critical events across 5 screens.

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully signs in (email, Google, or Apple) | `src/screens/auth/SignInScreen.tsx` |
| `user_signed_up` | User creates a new account (email, Google, or Apple) | `src/screens/auth/SignUpScreen.tsx` |
| `fuel_logged` | User saves a fuel fill-up entry | `src/screens/FuelEntryScreen.tsx` |
| `subscription_purchased` | User completes a Pro subscription purchase | `src/screens/PaywallScreen.tsx` |
| `subscription_restored` | User successfully restores a prior purchase | `src/screens/PaywallScreen.tsx` |
| `bol_scan_used` | User scans a Bill of Lading to auto-fill the load form | `src/screens/AddLoadScreen.tsx` |
| `ifta_viewed` | User opens the IFTA quarterly report tab | `src/screens/IFTAScreen.tsx` |

Pre-existing events left untouched: `guest_mode_entered`, `onboarding_started`, `onboarding_completed`, `load_added`, `check_load_used`, `paywall_shown`, `upgrade_tapped`, `paywall_dismissed`, `ifta_export_tapped`.

User identification was already wired in `AuthContext.tsx` via `identify(session.user.id, { email })` on Supabase auth state change and `reset()` on sign-out.

## Next steps

We've built some insights and a dashboard to track key user behavior:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/485860/dashboard/1760372)
- [New Signups (wizard)](https://us.posthog.com/project/485860/insights/8mBYU6wY) — Weekly unique signups over 90 days
- [Paywall → Purchase Funnel (wizard)](https://us.posthog.com/project/485860/insights/VyRFESSx) — Paywall shown → upgrade tapped → subscribed conversion
- [Loads Logged Per Day (wizard)](https://us.posthog.com/project/485860/insights/mhgTajfY) — Daily core engagement metric
- [Onboarding Completion Rate (wizard)](https://us.posthog.com/project/485860/insights/hgarwQEo) — Started vs completed onboarding
- [Paywall Dismissed vs Purchased (wizard)](https://us.posthog.com/project/485860/insights/BYkn5Pny) — Weekly churn signal

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` to `.env.example` (and any CI/CD secrets) so collaborators know what to set. The `.env.example` already has the placeholder line for the key but lacks `EXPO_PUBLIC_POSTHOG_HOST`.
- [ ] Confirm the returning-visitor path also calls `identify` — the current `AuthContext.tsx` identifies on every auth state change (including session restore on cold start), so this should be covered, but verify by signing out, restarting the app, and signing in again then checking PostHog person profiles.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
