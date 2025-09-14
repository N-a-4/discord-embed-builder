// src/exporters/discord_bot_cv2_exporter.js
// SAFE dual‑mode exporter:
// 1) exportDiscordBotCV2(projectJson) – reads JSON from the editor and generates a bot ZIP
// 2) exportDiscordBotFromCV2Code(cv2CodeStr) – takes CV2 .embed.v2.js code as text and generates a bot ZIP
// Includes a simple logger bridge via setExporterLogger(fn)

import JSZip from 'jszip';

// ---------------- Logger ----------------
let LOG = {
  info: (...a) => console.log('[exporter]', ...a),
  warn: (...a) => console.warn('[exporter]', ...a),
  error: (...a) => console.error('[exporter]', ...a),
};
export function setExporterLogger(fn){
  if (typeof fn === 'function') {
    LOG.info = (...a) => { try{ fn('info', ...a); }catch(_){ } console.log('[exporter]', ...a); };
    LOG.warn = (...a) => { try{ fn('warn', ...a); }catch(_){ } console.warn('[exporter]', ...a); };
    LOG.error = (...a) => { try{ fn('error', ...a); }catch(_){ } console.error('[exporter]', ...a); };
  }
}

// ---------------- Small utils ----------------

function stripCv2Imports(code){
  if (typeof code !== 'string') return '';
  const lines = code.split(/\r?\n/);
  const filtered = lines.filter(l =>
    !/^\s*import\s+.+from\s+['"]discord\.js['"]\s*;?\s*$/i.test(l) &&
    !/^\s*import\s+['"]dotenv\/config['"]\s*;?\s*$/i.test(l)
  );
  return filtered.join('\n');
}

// No shortcode conversions – safest variant (does not affect runtime)
function transformEmojiShortcodes(s){ return s; }

function tsStr(raw){
  // Wrap text into a template literal for the generated TS code
  const x = String(raw).replace(/`/g, '\\`');
  return '`' + x + '`';
}

function styleToEnum(s){
  switch (String(s || 'secondary').toLowerCase()) {
    case 'primary': return 'ButtonStyle.Primary';
    case 'success': return 'ButtonStyle.Success';
    case 'danger':  return 'ButtonStyle.Danger';
    case 'link':    return 'ButtonStyle.Link';
    default:        return 'ButtonStyle.Secondary';
  }
}

// ---------------- JSON -> CV2 container (minimal safe mapping) ----------------

function itemToContainerComponent(item){
  if (!item || !item.type) return null;

  if (item.type === 'image' && item.url) {
    return { type: 'media', media: [{ url: String(item.url) }] };
  }
  if (item.type === 'hr') {
    return { type: 'separator' };
  }
  if ((item.type === 'text' || item.type === 'section') && item.content) {
    const sec = { type: 'section', texts: [ transformEmojiShortcodes(String(item.content)) ] };
    if (item.thumbUrl) sec.thumbUrl = String(item.thumbUrl);
    if (item.button) {
      const b = item.button;
      const isLink = !!b.href;
      const customId = isLink ? undefined : String(b.custom_id || b.id || 'btn:x');
      sec.button = {
        style: b.style || 'secondary',
        ...(b.label ? { label: String(b.label) } : {}),
        ...(isLink ? { url: String(b.href) } : { custom_id: customId })
      };
    }
    return sec;
  }
  if (item.type === 'buttons' && Array.isArray(item.buttons)) {
    const row = { type: 'action_row', components: [] };
    for (const b of item.buttons) {
      const isLink = !!b.href;
      const customId = isLink ? undefined : String(b.custom_id || b.id || 'btn:x');
      const btn = {
        type: 'button',
        style: b.style || 'secondary',
        ...(b.label ? { label: String(b.label) } : {}),
        ...(isLink ? { url: String(b.href) } : { custom_id: customId })
      };
      row.components.push(btn);
    }
    row.components = row.components.slice(0, 5);
    return row;
  }

  return null;
}

function exportContainerJSON(editorEmbed){
  const e = editorEmbed || {};
  const items = Array.isArray(e.items) ? e.items : [];
  const container = { type: 'container', components: [] };
  const extras = []; // here we could add selects later

  for (const it of items) {
    const comp = itemToContainerComponent(it);
    if (comp) container.components.push(comp);
  }
  return { components: [container, ...extras] };
}

// ---------------- CV2 TS code generator ----------------

function buildButtonsInlineTS(buttons){
  const parts = [];
  for (const b of (buttons || []).slice(0, 5)) {
    const lab = b.label ? `.setLabel(${JSON.stringify(String(b.label))})` : '';
    const idOr = b.url ? `.setURL(${JSON.stringify(String(b.url))})` : `.setCustomId(${JSON.stringify(String(b.custom_id || 'btn:x'))})`;
    const sty = `.setStyle(${styleToEnum(b.style)})`;
    parts.push(`new ButtonBuilder()${lab}${idOr}${sty}`);
  }
  return parts.join(',\n      ');
}

function exportDiscordV2CodeTs(v2){
  const comps = Array.isArray(v2?.components) ? v2.components : [];
  const container = comps.find(c => c?.type === 'container') || { type:'container', components: [] };
  const lines = [];
  lines.push(`const mainContainer = new ContainerBuilder()`);

  for (const c of (container.components || [])) {
    if (c.type === 'media') {
      const gallery = (Array.isArray(c.media) ? c.media.slice(0, 10) : []).map(m => `new MediaGalleryItemBuilder().setURL(${JSON.stringify(String(m.url))})`).join(',\n      ');
      lines.push(`  .addMediaGalleryComponents(mediaGallery => mediaGallery`);
      if (gallery) {
        lines.push(`    .addItems(`);
        lines.push(`      ${gallery}`);
        lines.push(`    )`);
      }
      lines.push(`  )`);
      continue;
    }
    if (c.type === 'separator') {
      lines.push(`  .addSeparatorComponents(separator => separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large))`);
      continue;
    }
    if (c.type === 'action_row') {
      const buttons = (Array.isArray(c.components) ? c.components : []).filter(x => x?.type === 'button');
      if (buttons.length) {
        lines.push(`  .addActionRowComponents(row => row`);
        lines.push(`    .addComponents(`);
        lines.push(`      ${buildButtonsInlineTS(buttons)}`);
        lines.push(`    )`);
        lines.push(`  )`);
      }
      continue;
    }
    if (c.type === 'section') {
      const texts = Array.isArray(c.texts) ? c.texts : [];
      if (c.thumbUrl) {
        lines.push(`  .addSectionComponents(section => section`);
        for (const t of texts.slice(0, 3)) {
          lines.push(`    .addTextDisplayComponents(textDisplay => textDisplay.setContent(${tsStr(String(t))}))`);
        }
        lines.push(`    .setThumbnailAccessory(thumb => thumb.setURL(${JSON.stringify(String(c.thumbUrl))}))`);
        if (c.button) {
          const b = c.button;
          const lab = b.label ? `.setLabel(${JSON.stringify(String(b.label))})` : '';
          const idOr = b.url ? `.setURL(${JSON.stringify(String(b.url))})` : `.setCustomId(${JSON.stringify(String(b.custom_id || 'btn:x'))})`;
          const sty = `.setStyle(${styleToEnum(b.style)})`;
          lines.push(`    .setButtonAccessory(btn => btn${lab}${idOr}${sty})`);
        }
        lines.push(`  )`);
        continue;
      }
      for (const t of texts.slice(0, 3)) {
        lines.push(`  .addTextDisplayComponents(textDisplay => textDisplay.setContent(${tsStr(String(t))}))`);
      }
      if (c.button) {
        const b = c.button;
        const lab = b.label ? `.setLabel(${JSON.stringify(String(b.label))})` : '';
        const idOr = b.url ? `.setURL(${JSON.stringify(String(b.url))})` : `.setCustomId(${JSON.stringify(String(b.custom_id || 'btn:x'))})`;
        const sty = `.setStyle(${styleToEnum(b.style)})`;
        lines.push(`  .addActionRowComponents(row => row.addComponents(new ButtonBuilder()${lab}${idOr}${sty}))`);
      }
      continue;
    }
    if (c.type === 'text') {
      lines.push(`  .addSectionComponents(section => section`);
      lines.push(`    .addTextDisplayComponents(textDisplay => textDisplay.setContent(${tsStr(String(c.text || ''))}))`);
      lines.push(`  )`);
      continue;
    }
  }

  const sendLine = [
    'await interaction.editReply({',
    '  flags: MessageFlags.IsComponentsV2,',
    '  components: [mainContainer]',
    '})',
  ].join('\n');

  return [lines.join('\n'), sendLine].join('\n');
}

// ---------------- Bot file makers ----------------

function makeIndexFromJSON(projectJson){
  const v2 = exportContainerJSON(projectJson || {});
  const uiCode = exportDiscordV2CodeTs(v2);

  const code =
`import 'dotenv/config';
import {
  Client, GatewayIntentBits, Partials,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle,
  ContainerBuilder, MediaGalleryItemBuilder,
  SeparatorSpacingSize,
  MessageFlags
} from 'discord.js';
import { REST as DiscordREST } from '@discordjs/rest';
import { Routes } from 'discord.js';

console.log('[boot] generated by exporter (JSON mode)');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', () => console.log('[ready]', client.user.tag));

async function ensureCommands(){
  const token = process.env.DISCORD_TOKEN, appId = process.env.APPLICATION_ID, guildId = process.env.GUILD_ID;
  if (!token || !appId || !guildId) return;
  const rest = new DiscordREST({ version:'10' }).setToken(token);
  const body = [{ name: "rustify", description: "Открыть проект Rustify (CV2)", options: [] }];
  try { await rest.put(Routes.applicationGuildCommands(appId, guildId), { body }); console.log('[commands] registered', guildId); }
  catch(e){ console.warn('[commands] register failed', (e && e.rawError) ? e.rawError : e); }
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'rustify') {
      await interaction.deferReply({ ephemeral: false });
${uiCode.split('\n').map(l => '      ' + l).join('\n')}
      return;
    }
  } catch (err) {
    console.error('[interaction] error', err);
    try { await interaction.reply({ content: 'Ошибка обработки', ephemeral: true }); } catch {}
  }
});

await ensureCommands();
await client.login(process.env.DISCORD_TOKEN);

// --- keepalive for Render Web Service ---
import http from 'node:http';
const port = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(port, () => console.log('[http] keepalive on', port));
`;

  return code;
}

function makeIndexFromCV2Code(cv2CodeRaw){
  const cleaned = stripCv2Imports(String(cv2CodeRaw || ''));
  const mod =
`export async function renderEmbed(interaction, deps){
  const { ContainerBuilder, MediaGalleryItemBuilder, ButtonBuilder, ButtonStyle, SeparatorSpacingSize, MessageFlags } = deps;
${cleaned.split('\n').map(l => '  ' + l).join('\n')}
}`;

  const index =
`import 'dotenv/config';
import {
  Client, GatewayIntentBits, Partials,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle,
  ContainerBuilder, MediaGalleryItemBuilder,
  SeparatorSpacingSize,
  MessageFlags
} from 'discord.js';
import { REST as DiscordREST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import { renderEmbed } from './embed.v2.code.js';

console.log('[boot] generated by exporter (CV2 mode)');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', () => console.log('[ready]', client.user.tag));

async function ensureCommands(){
  const token = process.env.DISCORD_TOKEN, appId = process.env.APPLICATION_ID, guildId = process.env.GUILD_ID;
  if (!token || !appId || !guildId) return;
  const rest = new DiscordREST({ version:'10' }).setToken(token);
  const body = [{ name: "rustify", description: "Открыть проект Rustify (CV2)", options: [] }];
  try { await rest.put(Routes.applicationGuildCommands(appId, guildId), { body }); console.log('[commands] registered', guildId); }
  catch(e){ console.warn('[commands] register failed', (e && e.rawError) ? e.rawError : e); }
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'rustify') {
      await interaction.deferReply({ ephemeral: false });
      await renderEmbed(interaction, { ContainerBuilder, MediaGalleryItemBuilder, ButtonBuilder, ButtonStyle, SeparatorSpacingSize, MessageFlags });
      return;
    }
  } catch (err) {
    console.error('[interaction] error', err);
    try { await interaction.reply({ content: 'Ошибка обработки', ephemeral: true }); } catch {}
  }
});

await ensureCommands();
await client.login(process.env.DISCORD_TOKEN);

// --- keepalive for Render Web Service ---
import http from 'node:http';
const port = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\\n');
}).listen(port, () => console.log('[http] keepalive on', port));
`;

  return { index, mod };
}

// ---------------- ZIP builders ----------------

async function buildZipCommon(zip){
  zip.file('register-commands.js',
`import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
async function main(){
  const token = process.env.DISCORD_TOKEN, appId = process.env.APPLICATION_ID, guildId = process.env.GUILD_ID;
  if (!token || !appId || !guildId) { console.log('Missing env'); return; }
  const rest = new REST({ version:'10' }).setToken(token);
  const body = [{ name: "rustify", description: "Открыть проект Rustify (CV2)", options: [] }];
  await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
  console.log('commands registered', guildId);
}
main().catch(console.error);
`);

  zip.file('package.json', JSON.stringify({
    name: "discord-bot-from-json-or-cv2",
    private: true,
    type: "module",
    version: "1.2.1",
    scripts: { start: "node index.cv2.js", register: "node register-commands.js" },
    dependencies: { "discord.js": "^14.15.3", "@discordjs/rest": "^2.2.1", "dotenv": "^16.4.5" }
  }, null, 2));

  zip.file('.gitignore', "node_modules\n.env\n");
  zip.file('README.md',
`# Discord Bot (CV2 / JSON)

## Быстрый старт
1) npm i
2) Создай .env с переменными: DISCORD_TOKEN, APPLICATION_ID, GUILD_ID
3) npm run register
4) npm start

## Режимы экспорта
- JSON: index.cv2.js с UI-кодом, собранным из JSON
- CV2: index.cv2.js использует embed.v2.code.js (вставленный код)
`);
}

// ---------------- Public API ----------------

export async function exportDiscordBotCV2(projectJson){
  LOG.info('start JSON export');
  const zip = new JSZip();
  zip.file('exported_project.json', JSON.stringify(projectJson || {}, null, 2));
  const indexCode = makeIndexFromJSON(projectJson || {});
  zip.file('index.cv2.js', indexCode);
  await buildZipCommon(zip);
  const blob = await zip.generateAsync({ type: 'blob' });
  LOG.info('ZIP blob generated');
  return blob;
}

export async function exportDiscordBotFromCV2Code(cv2CodeStr){
  LOG.info('start CV2 code export');
  const zip = new JSZip();
  const { index, mod } = makeIndexFromCV2Code(cv2CodeStr || '');
  zip.file('index.cv2.js', index);
  zip.file('embed.v2.code.js', mod);
  await buildZipCommon(zip);
  const blob = await zip.generateAsync({ type: 'blob' });
  LOG.info('ZIP blob generated');
  return blob;
}

export default exportDiscordBotCV2;
