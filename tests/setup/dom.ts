import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement matchMedia; components reading prefers-reduced-motion
// (e.g. useCountUp) need a stub. Only patch when a window exists (jsdom suites).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
   window.matchMedia = (query: string): MediaQueryList =>
      ({
         matches: false,
         media: query,
         onchange: null,
         addListener: () => {},
         removeListener: () => {},
         addEventListener: () => {},
         removeEventListener: () => {},
         dispatchEvent: () => false,
      }) as MediaQueryList;
}

// Runs for every suite. The node-environment suites have no DOM, so only
// unmount React trees when a document actually exists (jsdom suites).
afterEach(() => {
   if (typeof document !== 'undefined') cleanup();
});
