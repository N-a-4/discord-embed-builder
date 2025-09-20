// src/lib/sendToBot.js (verbose debug build)
// Exports both named and default. Logs detailed diagnostics to console.
export async function sendToBot({ code, filename, projectId, embedId, notifyUserId }) {
  const url = import.meta.env.VITE_BOT_EMBED_IMPORT_URL;
  const token = import.meta.env.VITE_BOT_EMBED_TOKEN;

  // Basic presence checks
  if (!url || !token) {
    const miss = !url && !token ? 'URL and TOKEN' : !url ? 'URL' : 'TOKEN';
    console.error('[sendToBot] Missing', miss, {
      url,
      tokenLen: token ? String(token).length : 0
    });
    throw new Error('Missing VITE_BOT_EMBED_IMPORT_URL or VITE_BOT_EMBED_TOKEN');
  }

  const payload = { filename, code, projectId, embedId, notifyUserId };
  try {
    console.debug('[sendToBot] POST', url, {
      filename,
      hasCode: typeof code === 'string' && code.length > 0,
      projectId,
      embedId,
      notifyUserId,
      tokenLen: String(token).length
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-embed-token': token
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok || !data || data.ok !== true) {
      console.error('[sendToBot] HTTP Error', {
        status: res.status,
        statusText: res.statusText,
        body: data
      });
      const err = data && data.error ? data.error : `HTTP ${res.status} ${res.statusText}`;
      throw new Error(`SendToBot failed: ${err}`);
    }

    console.debug('[sendToBot] OK', data);
    return data;
  } catch (e) {
    console.error('[sendToBot] Exception', e);
    throw e;
  }
}

export default sendToBot;

// Optional: tiny helper for manual console tests
export async function __debugSendToBot(url, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json','x-embed-token': token},
    body: JSON.stringify({ filename: 'probe.js', code: 'module.exports={ok:true};' })
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}
