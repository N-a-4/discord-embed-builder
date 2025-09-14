// save_export_handler.js — modal with 3 actions: Export current JSON / Paste JSON / Paste CV2 code
import * as exp from './discord_bot_cv2_exporter.js';
const exportJSON = exp.exportDiscordBotCV2 || exp.default;
const exportCV2 = exp.exportDiscordBotFromCV2Code;

function mkEl(tag, css, text){ const el=document.createElement(tag); if(css) el.style.cssText=css; if(text!=null) el.textContent=text; return el; }

function showModal(currentJson){
  const overlay = mkEl('div','position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;');
  const card = mkEl('div','width:min(900px,94vw);max-height:92vh;background:#111827;color:#e5e7eb;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;');
  const header = mkEl('div','padding:14px 18px;border-bottom:1px solid #374151;font-weight:700;','Экспорт Discord Bot (CV2)');
  const body = mkEl('div','padding:14px 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px;');
  const leftWrap = mkEl('div','display:flex;flex-direction:column;gap:8px;');
  const rightWrap = mkEl('div','display:flex;flex-direction:column;gap:8px;');
  const leftLabel = mkEl('div','font-size:12px;color:#9ca3af;','Текущее JSON (read‑only)');
  const leftArea = mkEl('textarea','width:100%;height:44vh;resize:vertical;background:#0b1220;color:#e2e8f0;border:1px solid #374151;border-radius:10px;padding:10px;font-family:ui-monospace,monospace;font-size:12px;');
  leftArea.value = JSON.stringify(currentJson||{}, null, 2); leftArea.readOnly = true;
  const rightTabs = mkEl('div','display:flex;gap:8px;');
  const btnTabJSON = mkEl('button','background:#374151;color:#e5e7eb;padding:6px 10px;border-radius:8px;border:none;cursor:pointer;','Вставить JSON');
  const btnTabCV2  = mkEl('button','background:#374151;color:#e5e7eb;padding:6px 10px;border-radius:8px;border:none;cursor:pointer;','Вставить CV2 код');
  const rightLabel = mkEl('div','font-size:12px;color:#9ca3af;','Вставка');
  const rightArea = mkEl('textarea','width:100%;height:38vh;resize:vertical;background:#0b1220;color:#e2e8f0;border:1px solid #374151;border-radius:10px;padding:10px;font-family:ui-monospace,monospace;font-size:12px;');
  rightArea.placeholder = '{ "embeds":[{ "items":[ ... ] }] } — или код .embed.v2.js';
  rightWrap.append(rightTabs, rightLabel, rightArea);
  rightTabs.append(btnTabJSON, btnTabCV2);
  leftWrap.append(leftLabel,leftArea);
  body.append(leftWrap,rightWrap);
  const footer = mkEl('div','display:flex;gap:10px;justify-content:flex-end;padding:12px 18px;border-top:1px solid #374151;');
  const btnCancel = mkEl('button','background:#374151;color:#e5e7eb;padding:8px 14px;border-radius:10px;border:none;cursor:pointer;','Отмена');
  const btnExportCurrent = mkEl('button','background:#60a5fa;color:#0b1220;padding:8px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:600;','Экспортировать текущее JSON');
  const btnUsePastedJSON = mkEl('button','background:#22c55e;color:#0b1220;padding:8px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:700;','Подтянуть JSON и экспортировать');
  const btnUsePastedCV2  = mkEl('button','background:#34d399;color:#0b1220;padding:8px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:700;','Подтянуть CV2 и экспортировать');
  footer.append(btnCancel, btnExportCurrent, btnUsePastedJSON, btnUsePastedCV2);
  const overlayHint = mkEl('div','padding:8px 18px;color:#94a3b8;font-size:12px;','Поддерживается два формата: JSON (кнопка “JSON” в редакторе) и CV2-код (.embed.v2.js).');
  card.append(header, body, overlayHint, footer); overlay.append(card); document.body.append(overlay);
  btnTabJSON.onclick = () => { rightLabel.textContent = 'Вставьте JSON (из кнопки “JSON”)'; rightArea.placeholder='{ "embeds":[{ "items":[ ... ] }] }'; };
  btnTabCV2.onclick  = () => { rightLabel.textContent = 'Вставьте CV2 код (.embed.v2.js)'; rightArea.placeholder='// const container = new ContainerBuilder()...'; };

  return new Promise(resolve => {
    function cleanup(){ overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e){ if(e.key==='Escape'){ cleanup(); resolve({action:'cancel'}); } }
    document.addEventListener('keydown', esc);
    btnCancel.onclick = ()=>{ cleanup(); resolve({action:'cancel'}); };
    btnExportCurrent.onclick = ()=>{ cleanup(); resolve({action:'current'}); };
    btnUsePastedJSON.onclick = ()=>{
      const raw = rightArea.value.trim();
      if(!raw){ alert('Поле пустое — вставьте JSON.'); return; }
      try{ resolve({action:'json', json: JSON.parse(raw) }); cleanup(); }
      catch(e){ alert('JSON не распознан: ' + (e?.message || e)); }
    };
    btnUsePastedCV2.onclick = ()=>{
      const raw = rightArea.value.trim();
      if(!raw){ alert('Поле пустое — вставьте CV2 код.'); return; }
      resolve({action:'cv2', code: raw}); cleanup();
    };
  });
}

function getItemsArray(json){
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.embeds) && Array.isArray(json.embeds[0]?.items)) return json.embeds[0].items;
  return [];
}

export async function handleExportDiscordBotCV2Click(projectJson, filenameBase='discord-bot-from-json'){
  console.log('[ui] export click (dual-mode modal)');
  const choice = await showModal(projectJson || {});
  if(!choice || choice.action==='cancel'){ console.log('[ui] cancelled'); return; }

  let blob;
  if (choice.action === 'current'){
    const json = projectJson || {};
    const itemsCount = getItemsArray(json).length;
    if(itemsCount===0){
      const ok = window.confirm('Текущее JSON пустое. Экспортировать каркас?');
      if(!ok) return;
    }
    blob = await exportJSON(json);
  } else if (choice.action === 'json'){
    const itemsCount = getItemsArray(choice.json).length;
    if(itemsCount===0){
      const ok = window.confirm('Вставленный JSON без items. Экспортировать каркас?');
      if(!ok) return;
    }
    blob = await exportJSON(choice.json);
  } else if (choice.action === 'cv2'){
    blob = await exportCV2(choice.code);
  } else {
    return;
  }

  const filename = (filenameBase || 'discord-bot-from-json').replace(/\s+/g,'_') + '.zip';
  if (typeof window !== 'undefined' && typeof window.saveAs === 'function'){
    window.saveAs(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },0);
  }
  console.log('[ui] exported', { mode: choice.action, filename });
}
