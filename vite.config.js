import { defineConfig } from 'vite';

// Samsung 2021 Tizen 6.0 uses Chromium M76, which cannot parse optional chaining.
// The same production build still serves Chrome, Android TV and all modern browsers.
export default defineConfig({
  build: { target: 'chrome76', cssTarget: 'chrome76' },
});
