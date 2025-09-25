// Patch: auto-URL for link-style buttons -> https://discord.gg/rustify

// Debug logging helpers
const __DBG__ = (typeof window !== 'undefined') ? (window.__RUSTIFY_DEBUG_EXPORT__ ?? true) : true;
function dbg(...args){ if(__DBG__) try{ console.log('[EXPORTER]', ...args); }catch{} }
function dbgGroup(title){ if(__DBG__) try{ console.groupCollapsed('[EXPORTER]', title); }catch{} }
function dbgGroupEnd(){ if(__DBG__) try{ console.groupEnd(); }catch{} }


// rustify_embed_export_v1.js — Components V2 JSON + Etalon-style codegen
// Version: 2.8 (fix media.addItems closing paren)
// Public API:
//   exportEmbedV2(editorEmbed, meta?)         -> Container JSON (etalon structure)
//   exportDiscordV2CodeTs(v2Json, varNames?)  -> Etalon-style TS/JS code string
//   exportEmbedCode(editorEmbed, meta?)       -> Alias: exportDiscordV2CodeTs(exportEmbedV2(...))
//   downloadText(text, filename?)             -> save helper

// ---------------- Emoji & utils ----------------
function normalizeUrl(u){
  try{ const url = new URL(String(u)); url.search=''; return url.toString(); }
  catch{ return String(u || ''); }
}
function extractEmojiIdFromUrl(u){
  const m = String(u||'').match(/\/emojis\/(\d{15,22})\./);
  return m ? m[1] : null;
}
function getCustomEmojisSource(editorEmbed, meta){
  if (meta && Array.isArray(meta.customEmojis)) return meta.customEmojis;
  if (editorEmbed && Array.isArray(editorEmbed.customEmojis)) return editorEmbed.customEmojis;
  try {
    if (typeof window !== 'undefined') {
      if (Array.isArray(window.__RUSTIFY_CUSTOM_EMOJIS__)) return window.__RUSTIFY_CUSTOM_EMOJIS__;
      if (window.RustifyApp && Array.isArray(window.RustifyApp.customEmojis)) return window.RustifyApp.customEmojis;
    }
  } catch {}
  return [];
}
function resolveEmojiName(source, env){
  if(!source) return undefined;
  const s = String(source).trim();
  // Unicode (no URL / no <:name:id>)
  if(!/^https?:\/\//i.test(s) && !/^<a?:/.test(s)){
    return s;
  }
  const list = Array.isArray(env?.customEmojis) ? env.customEmojis : [];
  if(!list.length) return undefined;

  // Exact URL
  let hit = list.find(e => e && e.url && String(e.url) === s);
  if(hit && hit.name) return String(hit.name);

  // Normalized URL
  const norm = normalizeUrl(s);
  hit = list.find(e => e && e.url && normalizeUrl(e.url) === norm);
  if(hit && hit.name) return String(hit.name);

  // By ID
  const id = extractEmojiIdFromUrl(s);
  if(id){
    hit = list.find(e => e && e.url && /\/emojis\/(\d{15,22})\./.test(String(e.url)) && String(e.url).includes('/emojis/' + id));
    if(hit && hit.name) return String(hit.name);
  }

  // <:name:id> fallback
  const m = s.match(/^<a?:([a-zA-Z0-9_~]+):(\d{15,22})>$/);
  if(m) return m[1];
  return undefined;
}

// Replace :emoji_name: -> ${emojis.emoji_name} (only textual content in Text/Text+button)
function transformEmojiShortcodes(s){
  if (typeof s !== 'string' || !s) return s;
  return s.replace(/:([a-z0-9_]+):/gi, (_m, name) => {
    const isIdent = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
    if (isIdent) return `\${emojis.${name}}`;
    const safe = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `\${emojis['${safe}']}`;
  });
}

// ---------------- V2 JSON (Etalon Container) ----------------

function parseListToSelectActionRow(listItem, env){
  const getArr = (obj, keys) => {
    for (const k of keys) {
      if (Array.isArray(obj?.[k])) return obj[k];
    }
    return null;
  };
  const placeholder =
    String(listItem.placeholder || listItem.hint || listItem.title || 'Выберите вариант');

  // Accept arrays under common keys
  const optsSrc =
    getArr(listItem, ['listItems','options','items','values']) ||
    [];

  // Normalize to {label, value, description?, emoji?}
  const opts = [];
  for (let idx = 0; idx < Math.min(optsSrc.length, 25); idx++) {
    const raw = optsSrc[idx];

    // 1) Object form
    if (raw && typeof raw === 'object') {
      const label = String(raw.label ?? raw.text ?? `Вариант ${idx+1}`).slice(0, 100);
      const value = String((raw.value ?? label.toLowerCase().replace(/\s+/g,'_')) || `opt_${idx+1}`).slice(0, 100);
      const description = raw.description ? String(raw.description).slice(0, 100) : undefined;

      let emoji = undefined;
      const emojiSrc = raw.emoji?.name || raw.emoji?.url || raw.emojiUrl || raw.leftEmojiUrl;
      const name = resolveEmojiName(emojiSrc, env);
      if (name) emoji = { name };

      const def = !!(raw.default || raw.selected || raw.isDefault);
      const out = { label, value };
      if (description) out.description = description;
      if (emoji) out.emoji = emoji;
      if (def) out.default = true;
      opts.push(out);
      continue;
    }

    // 2) String form: "Label|Description|:emoji:|selected|value"
    const s = String(raw || '');
    if (!s) continue;
    const parts = s.split('|');
    const label = (parts[0] || `Вариант ${idx+1}`).trim().slice(0, 100);
    const description = (parts[1] || '').trim() || undefined;
    const emojiSrc = (parts[2] || '').trim();
    const selectedToken = (parts[3] || '').trim().toLowerCase();
    const valueToken = (parts[4] || '').trim();

    const name = resolveEmojiName(emojiSrc, env);
    const isDefault = (selectedToken === 'selected' || selectedToken === 'true' || selectedToken === '1');
    let value = valueToken || label.toLowerCase().replace(/\s+/g,'_');
    if (!value) value = `opt_${idx+1}`;

    const out = { label, value };
    if (description) out.description = description.slice(0,100);
    if (name) out.emoji = { name };
    if (isDefault) out.default = true;
    opts.push(out);
  }

  return {
    type: 'string_select_action_row',
    custom_id: String(listItem.custom_id || listItem.customId || listItem.id || 'select'),
    placeholder,
    options: opts
  };
}
function parseTextRatingsToSelectActionRow(text, customId){
  const lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const options = [];
  for(const line of lines){
    const m = line.match(/^\s*([1-5])\s*[—-]\s*(.+)$/u);
    if(!m) continue;
    const grade = m[1];
    const rest = m[2].trim();
    let labelCore = rest, description;
    const idxDash = rest.indexOf('—') >= 0 ? rest.indexOf('—') : rest.indexOf('-');
    if(idxDash >= 0){
      labelCore = rest.slice(0, idxDash).trim();
      description = rest.slice(idxDash+1).trim() || undefined;
    }
    const label = `${grade} — ${labelCore}`.slice(0,100);
    const value = `rate_${grade}`;
    const opt = { label, value };
    if(description) opt.description = description.slice(0,100);
    options.push(opt);
  }
  if(!options.length) return null;
  return {
    type: 'string_select_action_row',
    custom_id: String(customId || 'select:rating'),
    placeholder: 'Выберите оценку',
    options
  };
}

function itemToContainerComponent(item, env){
  if(!item || !item.type) return null;

  if(item.type === 'image' && item.url){
    return { type: 'media', media: [{ url: String(item.url) }] };
  }

  if(item.type === 'hr'){
    return { type: 'separator' };
  }

  // Text → Section
  if(item.type === 'text' && item.content){
    const content = transformEmojiShortcodes(String(item.content));
    const sec = { type: 'section', texts: [ content ] };
    if(item.thumbUrl) sec.thumbUrl = String(item.thumbUrl);
    return sec;
  }

  // Text + Button → Section with accessory
  if(item.type === 'text-with-button' && item.content){
    const b = item.button || {};
    const style = (b.style || 'secondary');
    const isLink = !!b.href;
    const customId = (!isLink && (b.linkToModalId || b.linkToMiniEmbedId || b.linkToEmbedId))
      ? (b.linkToModalId ? `modal:${b.linkToModalId}`
        : b.linkToMiniEmbedId ? `mini:${b.linkToMiniEmbedId}`
        : `embed:${b.linkToEmbedId}`)
      : `btn:${b.id || 'x'}`;
    const __emojiSrc = b.leftEmojiUrl || b.rightEmojiUrl || b.emojiUrl;
    const name = resolveEmojiName(__emojiSrc, env);
    const sec = {
      type: 'section',
      texts: [ transformEmojiShortcodes(String(item.content)) ],
      button: {
        style,
        ...(b.label ? { label: b.label } : {}),
        ...(isLink ? { url: String(b.href) } : { custom_id: String(customId) }),
      }
    };
    if(__emojiSrc){ if(name){ sec.button.emoji = { name }; } }
    if(item.thumbUrl) sec.thumbUrl = String(item.thumbUrl);
        if(b && btnIsDisabled(b)) sec.button.disabled = true;
return sec;
  }

  // Buttons → action row
  if(item.type === 'buttons' && Array.isArray(item.buttons)){
    const row = { type: 'action_row', components: [] };
    for(const b of item.buttons){
      const style = (b.style || 'secondary');
      const isLink = !!b.href;
      const customId = (!isLink && (b.linkToModalId || b.linkToMiniEmbedId || b.linkToEmbedId))
        ? (b.linkToModalId ? `modal:${b.linkToModalId}`
          : b.linkToMiniEmbedId ? `mini:${b.linkToMiniEmbedId}`
          : `embed:${b.linkToEmbedId}`)
        : `btn:${b.id || 'x'}`;
      const __emojiSrc = b.leftEmojiUrl || b.rightEmojiUrl || b.emojiUrl;
      const name = resolveEmojiName(__emojiSrc, env);
      const btn = {
        type: 'button',
        style,
        ...(b.label ? { label: b.label } : {}),
        ...(isLink ? { url: String(b.href) } : { custom_id: String(customId) })
      };
      if(name){ btn.emoji = { name }; }
            if(b && btnIsDisabled(b)) btn.disabled = true;
row.components.push(btn);
    }
    row.components = row.components.slice(0,5);
    return row;
  }

  // 'list' handled at top-level
  if(item.type === 'list' && Array.isArray(item.listItems)){
    return null;
  }

  return null;
}

function exportContainerJSON(editorEmbed, meta){
  const e = editorEmbed || {};
  const items = Array.isArray(e.items) ? e.items : [];
  const env = { customEmojis: getCustomEmojisSource(e, meta) };

  const container = { type: 'container', components: [] };
  const topLevel = [];

  if (Number.isFinite(e?.color)) container.accentColor = (e.color >>> 0);

  for (const it of items) {
    const isFooter = (it.position === 'footer' || it.pos === 'footer' || it.area === 'footer');

    // Footer buttons stay below
    if (it.type === 'buttons' && isFooter) {
      const row = itemToContainerComponent(it, env);
      if (row) topLevel.push(row);
      continue;
    }

    // Lists -> inline in container; footer lists -> bottom
    if (
      it.type === 'list' ||
      it.type === 'dropdown' || it.type === 'select' || it.type === 'string_select' || it.type === 'select_menu' ||
      Array.isArray(it?.listItems) || Array.isArray(it?.options) || Array.isArray(it?.items) || Array.isArray(it?.values)
    ) {
      const selectRow = parseListToSelectActionRow(it, env);
      if (selectRow && Array.isArray(selectRow.options) && selectRow.options.length) {
        if (isFooter) {
          topLevel.push(selectRow);
        } else {
          container.components.push(selectRow);
        }
        continue;
      }
    }

    // Rating text -> select
    if ((it.type === 'text' || it.type === 'section') && it.content) {
      const ratingRow = parseTextRatingsToSelectActionRow(it.content, it.custom_id || 'select:rating');
      if (ratingRow) {
        topLevel.push(ratingRow);
        continue;
      }
    }

    // Generic mapping
    const mapped = itemToContainerComponent(it, env);
    if (mapped) container.components.push(mapped);
  }

  const out = { components: [container, ...topLevel] };
  try { dbg('container.components len', container.components?.length || 0, 'topLevel len', topLevel.length); } catch {}
  dbg('exportEmbedV2 out types', Array.isArray(out?.components) ? out.components.map(c => c?.type) : []);
  dbgGroupEnd();
  return out;
}

// Public JSON API
export function exportEmbedV2(editorEmbed, meta={}){ dbgGroup('exportEmbedV2 start'); dbg({items_len: Array.isArray(editorEmbed?.items)?editorEmbed.items.length:0, color: editorEmbed?.color}); 
  return exportContainerJSON(editorEmbed, meta);
}

// ---------------- Code export: Discord V2 (Etalon-like TS/JS) ----------------
function isJsIdent(s){ return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s||'')); }
function emojiIdRef(name){
  if(!name) return null;
  const n = String(name);
  return isJsIdent(n) ? `emojis.${n}.id` : `emojis[${JSON.stringify(n)}].id`;
}

// ---- Helper: determine disabled state for buttons (broad schema support) ----
function btnIsDisabled(b){
  if (!b || b.url) return false; // link buttons cannot be disabled in Discord
  if (b.disabled === true || b.isDisabled === true || b.inactive === true) return true;
  if (b.enabled === false || b.isEnabled === false) return true;
  if (b.active === false || b.isActive === false) return true;
  if (b.state === 'disabled' || b.status === 'disabled') return true;
  return false;
}

function tsStrKeepTemplates(raw){
  // Keep template placeholders like ${emojis.*} intact by wrapping in a template literal and escaping backticks
  return '`' + String(raw).replace(/`/g,'\\`') + '`';
}
function jsSingleQuoted(raw){
  const s = String(raw);
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g,'\\n') + "'";
}
function strContentLiteral(raw){
  // If the content contains a ${...} placeholder, keep it as a template literal; otherwise emit a single-quoted string.
  if (/\$\{/.test(String(raw))) return tsStrKeepTemplates(raw);
  return jsSingleQuoted(raw);
}

function styleToEnum(s){
  switch(String(s||'secondary').toLowerCase()){
    case 'primary': return 'ButtonStyle.Primary';
    case 'success': return 'ButtonStyle.Success';
    case 'danger':  return 'ButtonStyle.Danger';
    case 'link':    return 'ButtonStyle.Link';
    default:        return 'ButtonStyle.Secondary';
  }
}

function buildButtonsInlineTS(buttons){
  const parts = [];
  for (const b of (buttons || []).slice(0, 5)) {
    const lab = b?.label ? `.setLabel(${JSON.stringify(String(b.label))})` : '';
    const isLinkStyle = String(b?.style || '').toLowerCase() === 'link';
    const url = isLinkStyle ? (b?.url ? String(b.url) : 'https://discord.gg/rustify') : (b?.url ? String(b.url) : null);
    const idOr = url ? `.setURL(${JSON.stringify(url)})` : `.setCustomId(${JSON.stringify(String(b.custom_id || 'btn:x'))})`;
    const sty = `.setStyle(${styleToEnum(b.style)})`;
    const emn = b?.emoji?.name ? emojiIdRef(b.emoji.name) : null;
    const emo = emn ? `.setEmoji({ id: ${emn} })` : '';
    const dis = btnIsDisabled(b) ? `.setDisabled(true)` : '';
    parts.push(`new ButtonBuilder()${lab}${idOr}${sty}${emo}${dis}`);
  }
  return parts.join(',\n      ');
}
function buildSelectVarTS(varName, row){
  const cid = row.custom_id ? `.setCustomId(${JSON.stringify(String(row.custom_id))})` : `.setCustomId("select")`;
  const placeholder = row.placeholder ? `.setPlaceholder(${JSON.stringify(String(row.placeholder))})` : '';
  const opts = Array.isArray(row.options) ? row.options.slice(0,25) : [];
  const optLines = opts.map(o => {
    const lab = JSON.stringify(String(o.label||'—'));
    const val = JSON.stringify(String(o.value||'val'));
    const desc = o.description ? `, description: ${JSON.stringify(String(o.description))}` : '';
    const emn = o?.emoji?.name ? emojiIdRef(o.emoji.name) : null;
    const emo = emn ? `, emoji: { id: ${emn} }` : '';
    const def = o.default ? `, default: true` : '';
    return `{ label: ${lab}, value: ${val}${desc}${emo}${def} }`;
  }).join(', ');
  const options = opts.length ? `.addOptions(${optLines})` : '';

  // No block-scope, no const; assign into outer "let varName"
  return [
    `// ${varName}`,
    `  ${varName} = new ActionRowBuilder();`,
    `  const sel = new StringSelectMenuBuilder()${cid}${placeholder}${options};`,
    `  ${varName}.addComponents(sel);`
  ].join('\n');
}
function buildSelectInlineTS(row){
  const cid = row.custom_id ? `.setCustomId(${JSON.stringify(String(row.custom_id))})` : `.setCustomId("select")`;
  const placeholder = row.placeholder ? `.setPlaceholder(${JSON.stringify(String(row.placeholder))})` : '';
  const opts = Array.isArray(row.options) ? row.options.slice(0,25) : [];
  const optLines = opts.map(o => {
    const lab = JSON.stringify(String(o.label||'—'));
    const val = JSON.stringify(String(o.value||'val'));
    const desc = o.description ? `, description: ${JSON.stringify(String(o.description))}` : '';
    const emn = o?.emoji?.name ? emojiIdRef(o.emoji.name) : null;
    const emo = emn ? `, emoji: { id: ${emn} }` : '';
    const def = o.default ? `, default: true` : '';
    return `{ label: ${lab}, value: ${val}${desc}${emo}${def} }`;
  }).join(', ');
  const options = opts.length ? `.addOptions(${optLines})` : '';
  return `new StringSelectMenuBuilder()${cid}${placeholder}${options}`;
}


export function exportDiscordV2CodeTs(v2, varNames={}){ dbgGroup('exportDiscordV2CodeTs start'); try{ dbg('v2 keys', Object.keys(v2||{})); }catch{} 
  function __dedupeIdsInCode(text){
    const used = new Map();
    return String(text).replace(/\.setCustomId\s*\(\s*"([^"]+)"\s*\)/g, (m, id) => {
      const n = (used.get(id) || 0) + 1;
      used.set(id, n);
      const nid = n === 1 ? id : `${id}#${n}`;
      return `.setCustomId(${JSON.stringify(nid)})`;
    });
  }

  const comps = Array.isArray(v2?.components) ? v2.components : [];
  const container = comps.find(c => c?.type === 'container') ?? { type: 'container', components: [] };
  const extras = comps.filter(c => c && c !== container);

  const contName = varNames.container || 'exampleContainer';
  const selectName = varNames.select || 'selectRow';
  const buttonsName = varNames.buttons || 'buttonsRow';

  const lines = [];
  // Container builder
  lines.push(`const ${contName} = new ContainerBuilder()`);

  for(const c of (container.components || [])){
    if (c.type === 'string_select_action_row') {
      lines.push(`  .addActionRowComponents(row => row`);
      lines.push(`    .addComponents(`);
      lines.push(`      ${buildSelectInlineTS(c)}`);
      lines.push(`    )`);
      lines.push(`  )`);
      continue;
    }
if(c.type === 'media'){
      lines.push(`  .addMediaGalleryComponents(mediaGallery => mediaGallery`);
      const media = Array.isArray(c.media) ? c.media.slice(0,10) : [];
      if(media.length){
        lines.push(`    .addItems(`);
        lines.push(`      ${media.map(m => `new MediaGalleryItemBuilder().setURL(${JSON.stringify(String(m.url))})`).join(',\n      ')}`);
        lines.push(`    )`);
      }
      lines.push(`  )`);
      continue;
    }
    if(c.type === 'action_row'){
      const buttons = (c.components || []).filter(x => x?.type === 'button');
      if(buttons.length){
        lines.push(`  .addActionRowComponents(row => row`);
        lines.push(`    .addComponents(`);
        lines.push(`      ${buildButtonsInlineTS(buttons)}`);
        lines.push(`    )`);
        lines.push(`  )`);
      }
      continue;
    }
    if(c.type === 'separator'){
      lines.push(`  .addSeparatorComponents(separator => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large))`);
      continue;
    }
        if(c.type === 'section'){
      const texts = Array.isArray(c.texts) ? c.texts : [];
      const hasThumb = !!c.thumbUrl;
      const hasBtn = !!c.button;

      if(!hasThumb && !hasBtn){
        // Pure text-only: emit TextDisplay components without a Section wrapper
        for(const t of texts.slice(0,3)){
          lines.push(`  .addTextDisplayComponents(`);
          lines.push(`    textDisplay => textDisplay`);
          lines.push(`      .setContent(${strContentLiteral(String(t))}),`);
          lines.push(`  )`);
        }
        continue;
      }

      // With thumbnail and/or button accessory, keep Section wrapper
      lines.push(`  .addSectionComponents(section => section`);
      for(const t of texts.slice(0,3)){
        lines.push(`    .addTextDisplayComponents(`);
        lines.push(`      textDisplay => textDisplay`);
        lines.push(`        .setContent(${strContentLiteral(String(t))}),`);
        lines.push(`    )`);
      }
      if (hasThumb) {
        lines.push(`    .setThumbnailAccessory(thumb => thumb.setURL(${JSON.stringify(String(c.thumbUrl))}))`);
      }
      if (hasBtn) {
        const b = c.button;
        const lab = b.label ? `.setLabel(${JSON.stringify(String(b.label))})` : '';
        const isLinkStyle = String(b?.style || '').toLowerCase() === 'link';
        const url = isLinkStyle ? (b?.url ? String(b.url) : 'https://discord.gg/rustify') : (b?.url ? String(b.url) : null);
        const idOr = url ? `.setURL(${JSON.stringify(url)})` : `.setCustomId(${JSON.stringify(String(b.custom_id||'btn:x'))})`;
        const sty = `.setStyle(${styleToEnum(b.style)})`;
        const emn = b?.emoji?.name ? emojiIdRef(b.emoji.name) : null;
        const emo = emn ? `.setEmoji({ id: ${emn} })` : '';
        const dis = btnIsDisabled(b) ? `.setDisabled(true)` : '';
        lines.push(`    .setButtonAccessory(btn => btn${lab}${idOr}${sty}${emo}${dis})`);
      }
      lines.push(`  )`);
      continue;
    }
    if(c.type === 'text'){
      lines.push(`  .addTextDisplayComponents(`);
      lines.push(`    textDisplay => textDisplay`);
      lines.push(`      .setContent(${strContentLiteral(String(c.text||''))}),`);
      lines.push(`  )`);
      continue;
    }
  }

  // Declare outer lets to avoid block scoping issues
  const afterBlocks = []; dbg('extras', extras?.map(e=>e?.type));
  let haveButtonsRow = false;
  let haveSelectRow = false;

  afterBlocks.push(`let ${selectName};`);
  afterBlocks.push(`let ${buttonsName};`);

  for(const r of extras){
    if(r.type === 'string_select_action_row' && !haveSelectRow){
      afterBlocks.push(buildSelectVarTS(selectName, r));
      haveSelectRow = true;
      continue;
    }
    if(r.type === 'action_row' && !haveButtonsRow){
      const buttons = (r.components || []).filter(x => x?.type === 'button');
      if(buttons.length){
        afterBlocks.push(`// ${buttonsName}`);
        afterBlocks.push(`  ${buttonsName} = new ActionRowBuilder();`);
        for(const b of buttons){
          afterBlocks.push(`  ${buttonsName}.addComponents(${buildButtonsInlineTS([b])});`);
        }
        haveButtonsRow = true;
      }
      continue;
    }
  }

  const sendLine = `await interaction.editReply({
  flags: MessageFlags.IsComponentsV2,
  components: [exampleContainer, selectRow, buttonsRow].filter(Boolean)
})`;

  const __code = __dedupeIdsInCode([
    lines.join('\n'),
    ...afterBlocks,
    sendLine
  ].join('\n'));
  dbg('code length', __code?.length);
  dbgGroupEnd();
  return __code;

}

// ---- Back-compat alias ----
export function exportEmbedCode(editorEmbed, meta={}){ dbgGroup('exportEmbedCode start'); 
  dbg('editorEmbed items', Array.isArray(editorEmbed?.items)?editorEmbed.items.length:0);
  const v2 = exportEmbedV2(editorEmbed, meta); dbg('v2 components', Array.isArray(v2?.components)?v2.components.length:0);
  try { const code = exportDiscordV2CodeTs(v2); dbg('final code length', code?.length); dbgGroupEnd(); return code; } catch(e){ console.error('[EXPORTER] exportEmbedCode ERROR', e); dbgGroupEnd(); throw e; }
}

// ---------------- Download helper ----------------
export function downloadText(text, filename='export.ts'){ dbg('downloadText', {filename, length: (text? String(text).length : 0)}); 
  try{
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }catch{ /* noop */ }
}

// Optional global expose for quick testing
try {
  if (typeof window !== 'undefined') {
    window.RustifyExport = Object.assign({}, window.RustifyExport || {}, {
      exportEmbedV2,
      exportDiscordV2CodeTs,
      exportEmbedCode,
      downloadText,
    });
  }
} catch {}