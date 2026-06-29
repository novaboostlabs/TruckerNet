// TypeScript resolution stub — Metro overrides this with sqlite.native.ts (iOS/Android)
// or sqlite.web.ts (web) at bundle time. This file exists only so tsc can resolve the
// import in database.ts without platform-specific module resolution.
export { db } from './sqlite.native';
