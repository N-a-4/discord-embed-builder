
// src/lib/sendToBot.js
// Works in Vite (ESM). Supports BOTH named and default import styles.
export async function sendToBot({ code, filename, projectId, embedId, notifyUserId }) {
  const url = import.meta.env.VITE_BOT_EMBED_IMPORT_URL;
  const token = import.meta.env.VITE_BOT_EMBED_TOKEN;
  if (!url || !token) {
    throw new Error('Missing VITE_BOT_EMBED_IMPORT_URL or VITE_BOT_EMBED_TOKEN');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-embed-token': token
    },
    body: JSON.stringify({ filename, code, projectId, embedId, notifyUserId })
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || !data.ok) {
    const err = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(`SendToBot failed: ${err}`);
  }
  return data;
}

export default sendToBot;
