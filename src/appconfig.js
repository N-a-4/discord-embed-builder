// src/appconfig.js
// Single source of truth for your appId in the client.
// IMPORTANT: no fallback to 'default-app-id' — we fail closed if env is empty.

// Read from Vite env (define in .env/.env.local)
const RAW = (import.meta.env.VITE_APP_ID || '').trim();

if (!RAW) {
  // Explicit crash to avoid silently writing into 'default-app-id'.
  // Set VITE_APP_ID=rustify (or another canonical id) in your .env.local
  throw new Error('[APP_ID] Missing VITE_APP_ID. Set VITE_APP_ID=rustify in your .env.local');
}

// Canonical app id (runtime value)
export const APP_ID = RAW;

// Optional guard: warn if differs from the expected 'rustify'
// (kept as a warning, not throwing, so you can reuse the app with another id if needed)
if (APP_ID !== 'rustify') {
  console.warn('[APP_ID] Unexpected value:', APP_ID, '— expected "rustify"');
}

// Debug helper: log the path we write to (use in places where we save globals)
export function logGlobalEmojiPath(ref) {
  try { console.log('[APP_ID] writing to:', ref?.path || '<unknown>'); } catch {}
}