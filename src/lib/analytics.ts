import PostHog from 'posthog-react-native';

const key  = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;
const isConfigured = !!key && key !== 'phc_your-project-api-key';

// Always create an instance so PostHogProvider receives a non-null client.
// When the key is absent/placeholder the instance runs in disabled mode and
// captures nothing — safe for development and CI environments.
export const posthog = new PostHog(key ?? 'placeholder', {
  ...(host ? { host } : {}),
  disabled: !isConfigured,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

export function capture(event: string, props?: Props): void {
  posthog.capture(event, props);
}

export function identify(userId: string, traits?: Props): void {
  posthog.identify(userId, traits);
}

export function reset(): void {
  posthog.reset();
}
