// src/appconfig.js
// Single source of truth for your appId + debug logging in the client.
// IMPORTANT: no fallback to 'default-app-id' — fail closed if env is empty.

// Read from Vite env (define in .env/.env.local)
const RAW = (import.meta.env?.VITE_APP_ID || '').trim();

if (!RAW) {
  // Explicit crash to avoid silently writing into 'default-app-id'.
  // Set VITE_APP_ID=rustify (or another canonical id) in your .env.local
  throw new Error('[APP_ID] Missing VITE_APP_ID. Set VITE_APP_ID=rustify in your .env.local');
}

// Canonical app id (runtime value)
export const APP_ID = RAW;

// Debug logs toggle (opt-in): set VITE_DEBUG_LOGS=1 in .env.local to enable
export const DEBUG_LOGS = (import.meta.env?.VITE_DEBUG_LOGS === '1');

// Safe debug logger (prints only when DEBUG_LOGS is enabled)
export const dlog = (...args) => { if (DEBUG_LOGS) try { console.log(...args); } catch {} };

// Debug helper: log the path we write to (used in places where we save globals)
export function logGlobalEmojiPath(ref) {
  if (!DEBUG_LOGS) return;
  try { console.log('[APP_ID] writing to:', ref?.path ?? '<unknown>'); } catch {}
}
