// Vitest global test setup.
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement window.scrollTo (it exists but just logs a
// "Not implemented" error when called) - App.tsx calls it on every step
// change to reset scroll position, which happens in essentially every
// test that renders <App />. A real browser implements this fully; this
// stub just keeps test output free of noise from a jsdom limitation that
// has nothing to do with whether the app itself is correct.
window.scrollTo = () => {};