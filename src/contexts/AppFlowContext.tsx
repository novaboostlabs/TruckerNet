import { createContext } from 'react';

// Lets in-app screens (e.g. the Expenses/Settings tab) jump back into the
// onboarding flow to review or redo their setup. Provided by RootNavigator.
export interface AppFlow {
  replayOnboarding: () => void;
  replayWalkthrough: () => void;
}

export const AppFlowContext = createContext<AppFlow>({
  replayOnboarding: () => {},
  replayWalkthrough: () => {},
});
