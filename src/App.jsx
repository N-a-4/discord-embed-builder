import { APP_ID, logGlobalEmojiPath, dlog } from './appconfig.js';
import { handleExportDiscordBotCV2Click } from './exporters/save_export_handler.js';
// == Build note ==// --- 3-state pill toggle for statuses: "Готово" | "В работе" | "Ожидание"

// ---- auto-prune helpers (remove empty blocks) ----
const isEmptyRichText = (v) => {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  try {
    const s = JSON.stringify(v);
    return !s || s === "[]" || s === "{}";
  } catch { return false; }
};
const isEmptyItem = (item) => {
  if (!item) return true;
  const t = item.type || item.mode;
  switch (t) {
    case "text":
    case "paragraph":
    case "header":
    case "title":
      return isEmptyRichText(item.text || item.value || item.content);
    case "buttons":
      if (!Array.isArray(item.buttons) || item.buttons.length === 0) return true;
      return item.buttons.every((b) => !b || (!String(b.text || b.label || "").trim() && !b.linkToEmbedId && !b.href));
    case "image":
      return !(item.url && String(item.url).trim());
    case "divider":
    case "spacer":
      return item.height === 0 || item.size === 0;
    case "group":
    case "container":
      return !Array.isArray(item.items) || item.items.length === 0;
    default:
      return false;
  }
};
const pruneEmptyItems = (items) => {
  if (!Array.isArray(items)) return items;
  const out = [];
  for (const raw of items) {
    if (!raw) continue;
    let item = raw;
    if (Array.isArray(item.items)) {
      item = { ...item, items: pruneEmptyItems(item.items) };
    }
    if (!isEmptyItem(item)) out.push(item);
  }
  return out;
};
// ---- end auto-prune helpers ----


function StatusToggle3({ value, onChange, disabled = false }) {
  const toIndex = (s) => {
    if (!s) return 1;
    if (s === 'done' || s === 'Готово') return 0;
    if (s === 'inprogress' || s === 'В работе') return 1;
    return 2; // waiting | pending | Ожидание
  };
  const i = toIndex(value);
 const pillColor = (i === 0 ? "bg-[#93d36f]" : i === 1 ? "bg-[#e8ab5c]" : "bg-gradient-to-r from-slate-400 to-slate-500");
const translate = i === 0
    ? "translate-x-0"
    : i === 1
    ? "translate-x-[calc(100%+2px)]"
    : "translate-x-[calc(200%+2px)]";

  const pillBg = i === 0 ? "#93d36f" : i === 1 ? "#e8ab5c" : "#6366F1";
  const glow = i === 0 ? "0 2px 14px rgba(147,211,111,0.35)" : i === 1 ? "0 2px 14px rgba(232,171,92,0.35)" : "0 2px 14px rgba(106,138,236,0.35)";


  return (
    <div className="relative inline-grid grid-cols-3 items-center rounded-[0.75rem] bg-[#1f2226] border border-[#33363a] select-none">
      <span
        className={`pointer-events-none absolute top-[2px] left-[2px] bottom-[2px] w-[calc(33.333%-2px)] rounded-[0.75rem] transition-transform transition-colors duration-200 ease-out ${translate} ${pillColor}`}
        style={{ backgroundColor: pillBg, boxShadow: glow }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange("Готово")}
        className={`relative z-10 h-8 px-3 text-xs font-medium rounded-none bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:border-none active:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 focus:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${i===0 ? "text-white" : "text-white/70"}`}
        style={{ backgroundColor: "transparent", border: "none" }}
      >
        Готово
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange("В работе")}
        className={`relative z-10 h-8 px-3 text-xs font-medium rounded-none bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:border-none active:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 focus:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${i===1 ? "text-white" : "text-white/70"}`}
        style={{ backgroundColor: "transparent", border: "none" }}
      >
        В работе
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange("Ожидание")}
        className={`relative z-10 h-8 px-3 text-xs font-medium rounded-none bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:border-none active:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 focus:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${i===2 ? "text-white" : "text-white/70"}`}
        style={{ backgroundColor: "transparent", border: "none" }}
      >
        Ожидание
      </button>
    </div>
  );
}


// --- helpers: treat both localized and canonical codes ---
function isDoneStatus(s) {
  return s === 'done' || s === 'Готово';
}
function isInProgressStatus(s) {
  return s === 'inprogress' || s === 'В работе';
}
function isPendingStatus(s) {
  return s === 'pending' || s === 'Ожидание';
}
// Date: 2025-08-19
// Change: Wrap the main JSX of InnerApp with <AuthUiContext.Provider> so AuthProfileBar always receives auth context.
// File tag: mini-profile-fix_v2
import React, { useEffect, useMemo, useRef, useState } from "react";
import { exportEmbedV2, exportEmbedCode, downloadText } from "./rustify_embed_export_v1.js"; // [EXPORTER]
import './emoji_store.js'; // Global Emoji Store init
// --- Lightweight toast utility (DOM-based, no JSX changes) ---
(function(){
  try{
    if (typeof window==='undefined') return;
    const ensure = () => {
      let el = document.getElementById('rustify-toasts');
      if (!el){
        el = document.createElement('div');
        el.id = 'rustify-toasts';
        el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none';
        if (document.body) document.body.appendChild(el);
        else document.addEventListener('DOMContentLoaded', () => {
          if (!document.getElementById('rustify-toasts') && document.body) document.body.appendChild(el);
        });
      }
      return el;
    };
    const show = (kind, message) => {
      try{
        const el = ensure();
        const item = document.createElement('div');
        item.style.cssText = 'pointer-events:auto;border-radius:12px;padding:8px 14px;color:white;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:92vw;font-weight:500;';
        item.style.background = (kind === 'error') ? '#dc2626' : '#059669';
        item.textContent = message;
        el.appendChild(item);
        setTimeout(() => {
          item.style.transition = 'all .25s';
          item.style.opacity = '0';
          item.style.transform = 'translateY(-6px)';
        }, 2000);
        setTimeout(() => { try{ el.removeChild(item); }catch{} }, 2300);
      }catch{}
    };
    window.RustifyToast = { show };
  }catch{}
})();
// --- Lightweight toast utility (DOM-based, no JSX changes) ---
(function(){try{if(typeof window==='undefined') return;const id='rustify-toasts';if(!document.getElementById(id)){const el=document.createElement('div');el.id=id;el.style.cssText='position:fixed;top:12px;right:12px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none';document.addEventListener('DOMContentLoaded',()=>{if(!document.getElementById(id)) document.body.appendChild(el);});if(document.body) document.body.appendChild(el);}window.RustifyToast={show:(kind,msg)=>{try{const el=document.getElementById(id);if(!el) return;const b=document.createElement('div');b.textContent=msg;b.style.cssText='background:'+ (kind==='error'?'#dc2626':'#059669') +';color:white;padding:8px 12px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.25);font-size:13px;pointer-events:auto';el.appendChild(b);setTimeout(()=>{b.style.opacity='0';b.style.transition='opacity .35s';setTimeout(()=>{b.remove();},380);},2200);}catch{}}};}catch{}})();
const DEV_EXPORT = true; // [EXPORTER] toggle dev tools
// removed duplicate isReadOnlyDev var
import { onAuthStateChanged, getAuth, signInWithCustomToken, signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth as firebaseAuth, db as firebaseDb } from "../firebase.js";
import { getApps, getApp, initializeApp } from "firebase/app";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { query, limit, collection, deleteDoc, doc, getDocs, getFirestore, onSnapshot, setDoc, updateDoc, getDoc } from "firebase/firestore";
// --- Firebase Config (placeholders, will be populated by the environment) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = APP_ID;

// --- Global default banner ---
const DEFAULT_BANNER_URL = "https://i.ibb.co/gM3ZJYGt/vidget.png?ex=689d27e1&is=689bd661&hm=0ba370ab75ace8478cbcc6c596b0dda51c9a9dc41b055f881c3ef83371f7e094&=&format=webp&quality=lossless&width=1100&height=330";

// Avatar for Rustify bot in preview forms (leave empty to show "R")
const RUSTIFY_BOT_AVATAR_URL = "";

/** Add a cache-busting param that changes when embed image version changes */
const withCacheBust = (url, ver) => {
 if (!url) return '';
 const sep = url.includes('?') ? '&' : '?';
 return `${url}${sep}_v=${ver || 0}`;
};

/** 1x1 transparent pixel to replace "stuck" images when URL is empty */
const TRANSPARENT_PX = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

// --- Types (JSDoc) ---
/** @typedef {{ id: string, type: 'image', url: string }} ImageItem */
/** @typedef {{ id: string, label?: string, leftEmojiUrl?: string, rightEmojiUrl?: string, emojiUrl?: string, style?: 'secondary'|'link', active?: boolean, linkToEmbedId?: string }} Btn */
/** @typedef {{ id: string, type: 'buttons', buttons: Btn[] }} ButtonsItem */
/** @typedef {{ id: string, type: 'hr' }} HrItem */
/** @typedef {{ id: string, type: 'text', content: string, thumbUrl?: string }} TextItem */
/** @typedef {{ id: string, type: 'text-with-button', content: string, button: Btn }} TextWithButtonItem */
/** @typedef {{ id: string, type: 'list', listItems: string[] }} ListItem */
/** @typedef {(ImageItem|ButtonsItem|HrItem|TextItem|TextWithButtonItem|ListItem)} Item */
/** @typedef {{ name: string, url: string }} CustomEmoji */
/** @typedef {{ id: string, name: string, items: Item[], imageUrl: string, parentId?: string|null }} Embed */
/** @typedef {{ id: string, embeds: Embed[], activeEmbedId: string, customEmojis: CustomEmoji[] }} SaveState */

// --- Data Sanitization ---
const sanitizeButton = (btn = {}) => ({
 id: btn.id || `btn-${Date.now()}`,
 label: btn.label || "",
 leftEmojiUrl: btn.leftEmojiUrl || "",
 rightEmojiUrl: btn.rightEmojiUrl || "",
 style: (['primary','success','danger','link','secondary'].includes(btn.style) ? btn.style : 'secondary'),
 active: btn.active !== false,
 linkToEmbedId: btn.linkToEmbedId || "",
 linkToModalId: btn.linkToModalId || "",
 linkToMiniEmbedId: (typeof btn?.linkToMiniEmbedId === 'string' ? btn.linkToMiniEmbedId : ''),
});

const sanitizeItems = (items, defaultUrl) => {
 if (!Array.isArray(items)) return [];
 return items.map(item => {
 if (!item || typeof item.type !== 'string') return null; // Remove invalid items
 switch (item.type) {
 case 'buttons': {
 const sanitizedButtons = Array.isArray(item.buttons) ? item.buttons.map(sanitizeButton) : [];
 return { ...item, buttons: sanitizedButtons };
 }
 case 'image': {
 const url = (typeof item.url === 'string') ? item.url
 : (typeof defaultUrl === 'string' ? defaultUrl : '');
 return { ...item, url };
 }
 case 'text': return { ...item, content: (typeof item.content === 'string' ? item.content : (item.content != null ? String(item.content) : '')), thumbUrl: item.thumbUrl || '' };
 case 'text-with-button': return { ...item, content: (typeof item.content === 'string' ? item.content : (item.content != null ? String(item.content) : '')), button: sanitizeButton(item.button || {}) };
case 'list': {
 const list = Array.isArray(item.listItems) ? item.listItems.filter(x => typeof x === 'string') : [];
 return { ...item, listItems: list };
}
default:
 return item;
 }
 }).filter(Boolean); // Filter out null items
};

const sanitizeEmbed = (embed) => {
 if (!embed) return null;
 const imageUrl = (typeof embed.imageUrl === 'string') ? embed.imageUrl : DEFAULT_BANNER_URL;
 return {
 id: embed.id || `embed-${Date.now()}`,
 name: embed.name || "Untitled Embed",
 items: sanitizeItems(embed.items, imageUrl),
 imageUrl: imageUrl,
 miniEmbeds: Array.isArray(embed.miniEmbeds) ? embed.miniEmbeds.map((me) => ({
 id: (me && typeof me.id === 'string' && me.id) ? me.id : ('mini_' + Math.random().toString(36).slice(2,9)),
 name: (me && typeof me.name === 'string') ? me.name : 'Sub',
 imageUrl: (me && me.imageUrl) ? me.imageUrl : imageUrl,
 items: sanitizeItems(me && Array.isArray(me.items) ? me.items : [], (me && me.imageUrl) ? me.imageUrl : imageUrl),
 parentId: (typeof me?.parentId === 'string' || me?.parentId === null) ? me.parentId : (embed.id || null),
 })) : [],

 modals: Array.isArray(embed.modals) ? embed.modals.map(m => ({
 id: (m && typeof m.id === 'string' && m.id) ? m.id : ('m_' + Math.random().toString(36).slice(2,9)),
 title: (m && typeof m.title === 'string') ? m.title : 'Окно',
 submitLinkToMiniEmbedId: (typeof m?.submitLinkToMiniEmbedId === 'string' && m.submitLinkToMiniEmbedId) ? m.submitLinkToMiniEmbedId : undefined,
 fields: Array.isArray(m?.fields) ? m.fields.map(f => ({
 id: (f && typeof f.id === 'string' && f.id) ? f.id : ('f_' + Math.random().toString(36).slice(2,9)),
 type: f?.type === 'multiline' ? 'multiline' : 'single',
 label: typeof f?.label === 'string' ? f.label : '',
 placeholder: typeof f?.placeholder === 'string' ? f.placeholder : '',
 rows: (typeof f?.rows === 'number' && f.rows > 0) ? f.rows : 4,
 })) : []
 })) : [],
 parentId: (typeof embed.parentId === 'string' || embed.parentId === null) ? embed.parentId : null,
 };
}

// --- Default initial state for first-time users ---
const createDefaultEmbed = (name = "Главный эмбед") => {
 const defaultImageUrl = DEFAULT_BANNER_URL;
 return {
 id: `embed-${Date.now()}`,
 name,
 imageUrl: defaultImageUrl,
 items: [
 { id: "img", type: "image", url: defaultImageUrl },
 {
 id: "grp-1",
 type: "buttons",
 buttons: [
 { id: "b1", label: "Кнопка", style: "secondary", active: true, leftEmojiUrl: "", rightEmojiUrl: "" },
 ],
 },
 {
 id: 'txt-1',
 type: 'text',
 thumbUrl: '',
 content: `# Заголовок\n\nЭто *пример* **текстового блока**`,
 },
 ]
 }
};

function stripUndefinedDeep(val) {
  if (Array.isArray(val)) return val.map(stripUndefinedDeep);
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      const v = val[k];
      if (v === undefined) continue; // Firestore forbids undefined
      out[k] = stripUndefinedDeep(v);
    }
    return out;
  }
  return val;
}

// ===== Auth Gate (Stage 1, wrapper) =====
const REQUIRE_AUTH = true; // set false to bypass auth

function useAuthUser() {
 const [authUser, setAuthUser] = React.useState(() => (firebaseAuth && firebaseAuth.currentUser) || null);
 React.useEffect(() => {
 if (!firebaseAuth) return;
 const unsub = onAuthStateChanged(firebaseAuth, (u) => setAuthUser(u));
  

 return () => unsub && unsub();
 }, []);
 return authUser;
}

function ProfileBar({ user, onLogout }) {
 if (!user) return null;
 return (
 <div className="w-full mb-3 rounded-xl border border-white/10 bg-[#1A1B1E] text-[#DBDEE1] p-3 flex items-center justify-between">
 <div className="text-sm">
 Вошли как: <span className="font-medium">{user.email || "user"}</span>
 </div>
 <button data-btn-id={(btn && btn.id) || (b && b.id) || (safeButton && safeButton.id)} onClickCapture={(e)=>{ if (previewMode && isSelectingComment) {  const _bid = (block && block.id) || (typeof blockId !== "undefined" ? blockId : null);  const _pid = (btn && btn.id) || (b && b.id) || (safeButton && safeButton.id);  if (_bid && _pid) { onBlockOrButtonCommentCreate?.({ blockId: _bid, buttonId: _pid }); e.preventDefault(); e.stopPropagation(); } }}} className="h-8 px-3 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium flex items-center justify-center leading-none" onClick={onLogout}>
 Выйти
 </button>
 </div>
 );
}

function LoginForm() {
 const [email, setEmail] = React.useState("");
 const [password, setPassword] = React.useState("");
 const [err, setErr] = React.useState("");
 const [loading, setLoading] = React.useState(false);

 const onSubmit = async (e) => {
 e.preventDefault();
 setErr("");
 setLoading(true);
 try {
 await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
 } catch (e) {
 setErr(e?.code === "auth/invalid-credential" ? "Неверная почта или пароль" : (e?.message || "Ошибка входа"));
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-[#0b1020] text-white p-4">
 <form onSubmit={onSubmit} className="w-[360px] p-5 rounded-2xl border border-white/10 bg-[#0f172a]/90 shadow-xl">
 <div className="text-lg font-semibold mb-1">Вход в конструктор</div>
 <div className="text-xs opacity-70 mb-4">Введите email и пароль</div>
 <label className="block mb-3">
 <div className="text-xs opacity-80 mb-1">Email</div>
 <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-white/20 bg-white/5 outline-none" placeholder="you@example.com" />
 </label>
 <label className="block mb-3">
 <div className="text-xs opacity-80 mb-1">Пароль</div>
 <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-white/20 bg-white/5 outline-none" placeholder="••••••••" />
 </label>
 {err && <div className="mb-2 text-xs text-red-300">{err}</div>}
 <button type="submit" disabled={loading} className="w-full h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">
 {loading ? "Входим…" : "Войти"}
 </button>
 </form>
 </div>
 );
}

// ===== Context to pass auth UI into InnerApp =====
const AuthUiContext = React.createContext({ user: null, onLogout: () => {} });

function AuthProfileBar() {
 const { user, onLogout } = React.useContext(AuthUiContext);
 if (!user) return null;
 const letter = user.email ? user.email.charAt(0).toUpperCase() : "?";
 return (
 <div className="mb-3 w-full max-w-full">
 <div className="rounded-xl border border-white/10 bg-[#1A1B1E] text-[#DBDEE1] p-2.5 flex items-center justify-between">
 <div className="flex items-center gap-3 overflow-hidden">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-600 text-white font-bold text-sm shrink-0">
 {letter}
 </div>
 <span className="text-xs font-medium truncate max-w-[140px]">{user.email || "user"}</span>
 </div>
 <button
 className="h-7 px-2.5 rounded-md bg-red-600 hover:bg-red-700 text-xs font-medium shrink-0 flex items-center justify-center leading-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={onLogout}
 >
 Выйти
 </button>
 </div>
 </div>
 );
}

function InnerApp() {
  // --- Live subscribe for embed statuses ---
  const [remoteEmbedStatuses, setRemoteEmbedStatuses] = React.useState({});
  React.useEffect(() => {
    try {
      const _db = db || firebaseDb;
      const current = (firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
      const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
      const _uid = devNow ? OWNER_UID : (current ? current.uid : null);
      if (!_db || !_uid) return;
      const colRef = collection(_db, `artifacts/${APP_ID}/users/${_uid}/embedStatuses`);
      const unsub = onSnapshot(colRef, (qs) => {
        const m = {};
        qs.forEach(docSnap => {
          const d = docSnap.data();
          if (d && typeof d.status === "string") m[docSnap.id] = d.status;
        });
        setRemoteEmbedStatuses(m);
      });
      return () => { try { unsub && unsub(); } catch {} };
    } catch (e) { console.error("subscribe embedStatuses:", e); }
  }, [appId]);


 // --- Firebase State ---
 const [db, setDb] = useState(null);
 const OWNER_UID = "CbDBpHybZeebVrj3BpeRUxrXBhq1";
 const DEV_UID = "lWJt6ja2LUdoYZ6NQ2PJorspQNl1";
 const DEV_EMAIL = "limai9999@gmail.com";
 const [isReadOnlyDev, setIsReadOnlyDev] = useState(false);
 const [userId, setUserId] = useState(null);
 const [loadingStatus, setLoadingStatus] = useState('initializing'); // 'initializing', 'loading', 'ready', 'error'
 const savesCollectionRef = useRef(null);
 
 // --- Save/Load State ---
 const [savedStates, setSavedStates] = useState/** @type {SaveState[]} */([]);
 const [isLoadedProject, setIsLoadedProject] = useState(false);
 const [showLoadModal, setShowLoadModal] = useState(false);

 // Ensure collection ref exists whenever Load modal opens (after reloads)
 useEffect(() => {
 const _db = db || firebaseDb;
 const current = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
 const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
 const _uid = devNow ? OWNER_UID : (current ? current.uid : null);
 if (showLoadModal && _db && _uid && !savesCollectionRef.current) {
 const path = `artifacts/${APP_ID}/users/${_uid}/embedBuilderSaves`;
 savesCollectionRef.current = collection(_db, path);
 
 }
 }, [showLoadModal, db, userId]);

 const [showSaveModal, setShowSaveModal] = useState(false);
 const [saveName, setSaveName] = useState("");
 const [statusMessage, setStatusMessage] = useState("");
 const [deleteConfirmId, setDeleteConfirmId] = useState(null);
 const [currentSaveName, setCurrentSaveName] = useState("");
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [showNewEmbedModal, setShowNewEmbedModal] = useState(false);
 const [newEmbedName, setNewEmbedName] = useState("");
 const [deletingEmbed, setDeletingEmbed] = useState(null); // {id, name}
 const [renamingEmbed, setRenamingEmbed] = useState(null); // {id, name}

 // --- Project State ---
 
 // Cache-bust version per embed (for hosted environments/CDNs)
 const [imageBust, setImageBust] = useState({});
const [embeds, setEmbeds] = useState(() => [createDefaultEmbed()]);
 const [activeEmbedId, setActiveEmbedId] = useState(embeds[0].id);

 // Centralized parent selection: always exit mini-mode first
 const handleSelectEmbed = (id) => { 
 setActiveMiniEmbedId(null);
 setActiveEmbedId(id);
 // NOTE: intentionally not calling setMiniEmbeds here to avoid overwriting previous embed mini list

 };

 // Centralized handler: clicking a parent in the left list always exits mini-mode first
 const [activeMiniEmbedId, setActiveMiniEmbedId] = useState(null);
 const onMiniEmbedLinkClick = (id) => { if (!id) return; if (id === '__parent__') { setActiveMiniEmbedId(null); return; } setActiveMiniEmbedId(id); };

 useEffect(() => {
 
 }, [activeEmbedId]);

 useEffect(() => {
 
 }, [activeMiniEmbedId]);
const [customEmojis, setCustomEmojis] = useState([]);
const customEmojisRef = React.useRef([]);
React.useEffect(()=>{ customEmojisRef.current = customEmojis; }, [customEmojis]);

  // === Global emoji sync helpers ===
  const debounce = (fn, ms=600) => { let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  const syncFromGlobal = React.useCallback(() => {
    try{
      if (!window?.RustifyEmojiStore) return;
      const all = window.RustifyEmojiStore.getAll();
      const flat = Array.isArray(all) ? all.map(e => ({ name: e?.name || '', url: (e?.urls && e.urls[0]) || '' })) : [];
      setCustomEmojis(flat.filter(x => x.name && x.url));
    }catch{}
  }, []);

  // app-level Firestore doc
  const getAppGlobalRef = React.useCallback(() => doc(firebaseDb, 'artifacts', APP_ID, 'globals', 'globalEmojis'), [firebaseDb]);

  

const setGlobalFromStore = React.useCallback(async (explicitList=null) => {
  try{
    // Prefer React state (customEmojis) — в нём есть ручной id
    const storeAll = (window && window.RustifyEmojiStore && typeof window.RustifyEmojiStore.getAll === 'function')
      ? window.RustifyEmojiStore.getAll() : [];
    const list = Array.isArray(explicitList) ? explicitList : (Array.isArray(customEmojis) && customEmojis.length ? customEmojis : (Array.isArray(storeAll) ? storeAll : []));
    dlog(' counts',{ ui: Array.isArray(customEmojis)?customEmojis.length:0, store: Array.isArray(storeAll)?storeAll.length:0, explicit: Array.isArray(explicitList)?explicitList.length:null });

    // Собираем плоский массив без undefined-полей (Firestore их не принимает)
    const flat = (list || []).map(e => {
      const obj = {
        name: e?.name ? String(e.name) : '',
        url:  e?.url ? String(e.url) : (e?.urls && e.urls[0] ? String(e.urls[0]) : ''),
      };
      if (e && e.id != null && String(e.id).trim() !== '') {
        obj.id = String(e.id).trim();
      }
      return obj;
    }).filter(x => x.name && x.url);

    const payload = { emojis: flat, updatedAt: Date.now() };
    dlog(' flat', flat);
    dlog(flat);
    dlog(' payload', payload); // TEMP LOG
    const ref = getAppGlobalRef(); logGlobalEmojiPath(ref); dlog(' writing to', ref.path, 'payload size', flat.length);
    await setDoc(ref, payload);
    try { const snap = await getDoc(ref); dlog(' persisted doc len', Array.isArray(snap.data()?.emojis) ? snap.data().emojis.length : null); } catch {}
    try { const snap = await getDoc(getAppGlobalRef()); dlog(' doc', snap.exists() ? snap.data() : null); } catch(err) { console.warn('post-save getDoc failed', err); }
    window.RustifyToast && window.RustifyToast.show('success', 'Глобальные эмодзи сохранены');
  }catch(e){
    console.error('setGlobalFromStore failed', e);
    window.RustifyToast && window.RustifyToast.show('error', 'Ошибка сохранения глобальных эмодзи');
  }
}, [getAppGlobalRef, customEmojis]);



  const queueSaveGlobal = React.useMemo(() => debounce(setGlobalFromStore, 600), [setGlobalFromStore]);

  // On mount: always sync from global store and subscribe to Firestore (APP-LEVEL ONLY)
  React.useEffect(() => {
    // Local storage → UI
    try{
      syncFromGlobal();
      const onStorage = (ev) => { if (ev.key === 'RUSTIFY_GLOBAL_EMOJIS_V1') syncFromGlobal(); };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }catch{}
  }, [syncFromGlobal]);

  React.useEffect(() => {
    let unsub = null;
    (async () => {
      try{
        const ref = getAppGlobalRef();
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        if (data && Array.isArray(data.emojis) && data.emojis.length){
          if (window?.RustifyEmojiStore?.setAll){
            window.RustifyEmojiStore.setAll(data.emojis.map(e => ({ id: null, name: e?.name || '', urls: [e?.url || ''], aliases: [] })));
          }
          syncFromGlobal();
        } else {
          if (window?.RustifyEmojiStore && (window.RustifyEmojiStore.getAll()?.length || 0) > 0){
            await setGlobalFromStore();
          }
        }
        unsub = onSnapshot(ref, (snap) => {
          const d = snap.exists() ? snap.data() : null;
          if (d && Array.isArray(d.emojis)){
            if (window?.RustifyEmojiStore?.setAll){
              window.RustifyEmojiStore.setAll(d.emojis.map(e => ({ id: null, name: e?.name || '', urls: [e?.url || ''], aliases: [] })));
              syncFromGlobal();
            }
          }
        });
      }catch(e){ console.error('global emojis subscription failed', e); }
    })();
    return () => { try{ unsub && unsub(); }catch{} };
  }, [getAppGlobalRef, syncFromGlobal, setGlobalFromStore]);
  
  // Bridge for exporter
  React.useEffect(() => {
    try{
      if (typeof window !== 'undefined' && window.RustifyEmojiStore) {
        const all = window.RustifyEmojiStore.getAll();
        const flat = Array.isArray(all) ? all.map(e => ({ name: e?.name || '', url: (e?.urls && e.urls[0]) || '' })) : [];
        window.__RUSTIFY_CUSTOM_EMOJIS__ = flat.filter(x => x.name && x.url);
        window.__RUSTIFY_PROJECT_EMOJIS__ = Array.isArray(customEmojis) ? customEmojis : [];
      }
    }catch(e){}
  }, [customEmojis]);

 // --- Emoji search state (live filter) ---
 const [emojiQuery, setEmojiQuery] = useState('');
 const visibleEmojis = useMemo(() => {
 const q = (emojiQuery || '').trim().toLowerCase();
 if (!q) return customEmojis;
 return customEmojis.filter(e => ((e?.name || '').toLowerCase().includes(q)));
 }, [emojiQuery, customEmojis]);

 // --- Derived State ---
 const parentEmbed = useMemo(() => embeds.find(e => e.id === activeEmbedId) || embeds[0], [embeds, activeEmbedId]);
 const currentEmbed = useMemo(() => {
 if (activeMiniEmbedId && parentEmbed && Array.isArray(parentEmbed.miniEmbeds)) {
 return parentEmbed.miniEmbeds.find(m => m.id === activeMiniEmbedId) || parentEmbed;

 }
 return parentEmbed;
 }, [parentEmbed, activeMiniEmbedId]);
  const effectiveCurrentStatus = (remoteEmbedStatuses?.[activeMiniEmbedId ?? activeEmbedId]) ?? (currentEmbed ? currentEmbed.status : undefined) ?? "Ожидание";
// Hide statuses for brand-new projects (no saved docs yet)
const [hasSavedProjects, setHasSavedProjects] = React.useState(false);
React.useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const _db = db || firebaseDb;
      const current = (firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
      const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
      const _uid = devNow ? OWNER_UID : (current ? current.uid : null);
      const appId = APP_ID;
      if (!_db || !_uid) { if (!cancelled) setHasSavedProjects(false); return; }
      const savesCol = collection(_db, "artifacts", APP_ID, "users", _uid, "embedBuilderSaves");
      try {
        const snap = await getDocs(query(savesCol, limit(1)));
        if (!cancelled) setHasSavedProjects(!snap.empty);
      } catch {
        const snap = await getDocs(savesCol);
        if (!cancelled) setHasSavedProjects(!snap.empty);
      }
    } catch {
      if (!cancelled) setHasSavedProjects(false);
    }
  })();
  return () => { cancelled = true; };
}, []);


 useEffect(() => { }, [parentEmbed, currentEmbed, activeMiniEmbedId]);
 useEffect(() => {
 const src = activeMiniEmbedId ? 'mini' : 'parent';
 
 }, [activeEmbedId, activeMiniEmbedId, currentEmbed]);
 const footerBlocks = useMemo(() => (
 currentEmbed && Array.isArray(currentEmbed.items)
 ? currentEmbed.items.filter(it => it && it.position === 'footer' && (it.type === 'buttons' || it.type === 'list'))
 : []
 ), [currentEmbed]);

 const itemsForCanvas = useMemo(() => (
  currentEmbed && Array.isArray(currentEmbed.items)
    ? currentEmbed.items.filter(it => {
        if (!it) return false;
        if (it.position === 'footer' && (it.type === 'buttons' || it.type === 'list')) return false;
        if (it.type === 'image') {
          const u = (it.url != null) ? String(it.url) : '';
          if (u.trim().length === 0) return false;
        }
        return true;
      })
    : []
), [currentEmbed]);


 const canvasIndexMap = useMemo(() => {
 if (!currentEmbed || !Array.isArray(currentEmbed.items)) return [];
 const map = [];
 currentEmbed.items.forEach((it, i) => {
 if (!(it && it.position === 'footer' && (it.type === 'buttons' || it.type === 'list'))) map.push(i);
 });
 return map;
 }, [currentEmbed]);

 const updateCurrentEmbed = (patch) => {
 if (activeMiniEmbedId) {
 setEmbeds(prev => prev.map(e => {
 if (e.id !== activeEmbedId) return e;
 const list = Array.isArray(e.miniEmbeds) ? e.miniEmbeds : [];
 const nextList = list.map(m => {
  if (m.id !== activeMiniEmbedId) return m;
  const updated = { ...m, ...patch };
  updated.items = pruneEmptyItems(updated.items);
  return updated;
});
 return { ...e, miniEmbeds: nextList };

 }));
 } else {
 setEmbeds(prev => prev.map(e => {
  if (e.id !== activeEmbedId) return e;
  const updated = { ...e, ...patch };
  updated.items = pruneEmptyItems(updated.items);
  return updated;
}));
 }
 };
 
 
// --- Modals (right sidebar) ---
 // Per-embed modals (derived from currentEmbed)
let modals = (currentEmbed && Array.isArray(currentEmbed.modals)) ? currentEmbed.modals : [];
if ((!modals || !modals.length) && parentEmbed && Array.isArray(parentEmbed.modals)) modals = parentEmbed.modals;
if ((!modals || !modals.length) && typeof window !== 'undefined') {
 const w = window;
 modals = (w.__modalsList && Array.isArray(w.__modalsList)) ? w.__modalsList : modals;
}
const setModals = (updater) => {
 const next = (typeof updater === 'function') ? updater(modals) : updater;
 updateCurrentEmbed({ modals: Array.isArray(next) ? next : [] });
};

// === Status helper: updates 'status' in the current embed ===
function setEmbedStatus(status) {
  const ok = ['done','inprogress','waiting',null,undefined];
  const s = ok.includes(status) ? status : 'waiting';
  updateCurrentEmbed({ status: s });
}

// --- Per-embed status: minimal Firestore write (no full project overwrite) ---
async function persistEmbedStatus(nextStatus) {
  try {
    const _db = db || firebaseDb;
    const current = (firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
    const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
    const _uid = devNow ? OWNER_UID : (current ? current.uid : null);
    const appId = APP_ID;

    // Stable embed id (mini first, else parent)
    const embedId = (activeMiniEmbedId ?? activeEmbedId);
    if (!_db || !_uid || !embedId) return;

    // Guard: only if there's at least one saved project
    const savesCol = collection(_db, `artifacts/${APP_ID}/users/${_uid}/embedBuilderSaves`);
    const savesSnap = await getDocs(savesCol);
    if (savesSnap.empty) {
      try { showToast && showToast("Сначала сохраните проект", "error"); } catch {}
      return;
    }

    // Normalize status to canonical form for rules
    const map = { "Готово": "done", "В работе": "inprogress", "Ожидание": "pending" };
    const canonical = map[nextStatus] || nextStatus;

    // Write to lightweight subcollection
    const statusDocRef = doc(collection(_db, `artifacts/${APP_ID}/users/${_uid}/embedStatuses`), embedId);
    await setDoc(statusDocRef, { status: canonical, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error("persistEmbedStatus failed:", e);
    throw e;
  }
}

/**
 * Click handler for status chips: optimistic local update + minimal Firestore write.
 * Keeps global "Сохранить" behavior intact for full project saves.
 */
async function handleStatusClick(nextStatus) {
  // Optimistic UI
  setEmbedStatus(nextStatus);
  try {
    await persistEmbedStatus(nextStatus);
  try { setStatusMessage && setStatusMessage("Новый статус Embed сохранен"); setTimeout(() => setStatusMessage && setStatusMessage(""), 1400); } catch {}
  } catch (e) {
    try { setStatusMessage && setStatusMessage("Не удалось сохранить статус"); } catch {}
  } finally {
    try { setTimeout(() => setStatusMessage && setStatusMessage(""), 1500); } catch {}
  }
}

 // [{id, title}] // [{id, title}]
// --- Mini-Embeds (right sidebar) ---
const miniEmbeds = (parentEmbed && Array.isArray(parentEmbed.miniEmbeds)) ? parentEmbed.miniEmbeds : [];
const setMiniEmbeds = (updater) => {
 const next = (typeof updater === 'function') ? updater(miniEmbeds) : updater;
 updateCurrentEmbedMiniOnly(next);
};

const handleDeleteMiniEmbed = (id) => {
 if (!id) return;
 setMiniEmbeds(prev => {
 const arr = Array.isArray(prev) ? prev.filter(m => m && m.id !== id) : [];
 return arr;
 });
 try {
 if (typeof setActiveMiniEmbedId === 'function') {
 setActiveMiniEmbedId(prev => (prev === id ? null : prev));
 }
 } catch {}
};

const handleReorderMiniEmbed = (id, delta) => {
 if (!id || !delta) return;
 setMiniEmbeds(prev => {
 const arr = Array.isArray(prev) ? [...prev] : [];
 const idx = arr.findIndex(m => m && m.id === id);
 if (idx === -1) return arr;
 const newIdx = idx + (delta > 0 ? 1 : -1);
 if (newIdx < 0 || newIdx >= arr.length) return arr;
 const [item] = arr.splice(idx, 1);
 arr.splice(newIdx, 0, item);
 return arr;
 });
};

const handleRenameMiniEmbed = (id, newName) => {
 if (!id) return;
 const name = (newName || "").trim();
 setMiniEmbeds(prev => (Array.isArray(prev) ? prev.map(m => (m && m.id === id ? { ...m, name } : m)) : []));
};

const updateCurrentEmbedMiniOnly = (nextList) => { // force write to parent regardless of activeMiniEmbedId
 setEmbeds(prev => prev.map(e => {
 if (e.id !== activeEmbedId) return e;
 return { ...e, miniEmbeds: Array.isArray(nextList) ? nextList : [] };
 }));
};

const handleCreateMiniEmbed = () => {
 // Create a mini-embed by cloning the current (parent) embed just like "Дочерний эмбед"
 const parent = embeds.find(e => e.id === activeEmbedId);
 if (!parent) return;

 const reId = (prefix="") => () => `${prefix}${Math.random().toString(36).slice(2,8)}`;
 const cloneItemsWithNewIds = (items) => {
 if (!Array.isArray(items)) return [];
 const nid = reId("it-");
 const nbid = reId("btn-");
 return items.map((it) => {
 if (!it || typeof it !== "object") return it;
 if (it.type === "buttons") {
 const buttons = Array.isArray(it.buttons) ? it.buttons.map(b => ({ ...b, id: nbid() })) : [];
 return { ...it, id: nid(), buttons };
 }
 if (it.type === "text-with-button") {
 const newButton = it.button ? { ...it.button, id: nbid() } : undefined;
 return { ...it, id: nid(), button: newButton };
 }
 if (it.type === "list" || it.type === "text" || it.type === "image" || it.type === "hr") {
 return { ...it, id: nid() };
 }
 return { ...it, id: nid() };
 });
 };

 const clonedItems = cloneItemsWithNewIds(parent.items || []);

 const cnt = Array.isArray(parent.miniEmbeds) ? parent.miniEmbeds.length + 1 : 1;
 const miniName = `${parent.name || "Sub"} — копия ${cnt}`;

 const newMini = {
 id: 'mini-' + Math.random().toString(36).slice(2,9),
 name: miniName,
 imageUrl: parent.imageUrl || '',
 items: clonedItems,
 parentId: parent.id
 };

 const nextMini = Array.isArray(parent.miniEmbeds) ? [...parent.miniEmbeds, newMini] : [newMini];
 setMiniEmbeds(nextMini);

};

function handleOpenMiniEmbed(id) {
 
 setActiveMiniEmbedId(id);
}

const [viewText, setViewText] = useState("");
const [proofs, setProofs] = useState(["", "", ""]);
 
useEffect(() => {
 const onOpenEmbedModal = (e) => {
 
 const id = e?.detail?.id;
 if (typeof id === 'string' && id) {
 setActiveModalId(id);
 setModalMode('view');
 }
 };
 window.addEventListener('openEmbedModal', onOpenEmbedModal);
 return () => window.removeEventListener('openEmbedModal', onOpenEmbedModal);
}, []);
const [activeModalId, setActiveModalId] = useState(null);
const [modalMode, setModalMode] = useState(null); // 'create' | 'view' | 'settings'
const [newModalTitle, setNewModalTitle] = useState('');
const handleCreateModal = () => { setNewModalTitle(''); setModalMode('create'); };
const handleOpenModal = (id) => { setActiveModalId(id); setModalMode('view'); };
const handleOpenModalSettings = (id) => { setActiveModalId(id); setModalMode('settings'); };
const handleCloseModal = () => { setModalMode(null); setActiveModalId(null); };
// --- Local UI State ---
 const [newEmojiName, setNewEmojiName] = useState('');
 const [newEmojiUrl, setNewEmojiUrl] = useState('');

 const [emojiRename, setEmojiRename] = useState(null); // { old: string, value: string }
// --- Effects for Firebase ---
 useEffect(() => {
 if (Object.keys(firebaseConfig).length > 0) {
 const app = initializeApp(firebaseConfig);
 const firestore = getFirestore(app);
 const authInstance = getAuth(app);
 setDb(firestore);

 onAuthStateChanged(authInstance, async (user) => {
 if (user) {
 const devNow = (user.uid === DEV_UID || user.email === DEV_EMAIL);
 setIsReadOnlyDev(devNow);
 setUserId(user.uid);
 setLoadingStatus('ready');
 } else {
 // No automatic login in dev or prod
 setIsReadOnlyDev(false);
 setUserId(null);
 setLoadingStatus('ready');
 }
});
 } else {
 setLoadingStatus('ready'); // No firebase, app is ready
 }
 }, []);

 // Effect to set up collection reference and load saved states
 useEffect(() => {
 const _db = db || firebaseDb;
 if (!userId || !_db) return;

 setLoadingStatus('loading');
 const path = `artifacts/${APP_ID}/users/${userId}/embedBuilderSaves`;
 savesCollectionRef.current = collection(_db, path);
 
 const unsubscribe = onSnapshot(savesCollectionRef.current, (snapshot) => {
 const saves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setSavedStates(saves);
 setLoadingStatus('ready');
 }, (error) => {
 console.error("Failed to fetch saved states:", error);
 setLoadingStatus('error');
 });

 return () => unsubscribe();
}, [userId, db]);// Sync banner image URL with the image block inside items
 useEffect(() => {
  if (!currentEmbed) return;
  const items = Array.isArray(currentEmbed.items) ? currentEmbed.items : [];
  const idx = items.findIndex(it => it && it.type === 'image');
  const nextUrl = (currentEmbed.imageUrl && String(currentEmbed.imageUrl).trim().length > 0) ? currentEmbed.imageUrl : '';

  if (idx !== -1) {
    if (nextUrl) {
      if (items[idx]?.url !== nextUrl) {
        updateCurrentEmbed({
          items: items.map((it, i) => i === idx ? { ...it, url: nextUrl } : it)
        });
      }
    } else {
      updateCurrentEmbed({
        items: items.filter((_, i) => i !== idx)
      });
    }
  } else if (nextUrl) {
    const newImg = { id: 'img-' + Math.random().toString(36).slice(2,8), type: 'image', url: nextUrl };
    updateCurrentEmbed({ items: [newImg, ...items] });
  }
}, [currentEmbed?.imageUrl, activeEmbedId]);
// Bump image cache-bust when banner URL changes or tab switches
 useEffect(() => {
 if (!activeEmbedId) return;
 setImageBust(prev => ({ ...prev, [activeEmbedId]: (prev[activeEmbedId] || 0) + 1 }));
 }, [currentEmbed?.imageUrl, activeEmbedId]);

 // One-time normalization for legacy image blocks (src -> url) and empty urls
 useEffect(() => {
 setEmbeds(prev => prev.map(em => ({
 ...em,
 items: (em.items || []).map(it => {
 if (!it || it.type !== 'image') return it;
 const url = (typeof it.url === 'string' && it.url.trim().length > 0)
 ? it.url
 : (typeof it.src === 'string' && it.src.trim().length > 0 ? it.src : '');
 return { ...it, url };
 })
 })));
 }, []);
// --- Save/Load/Delete Handlers ---
 const handleSave = async () => { if (isReadOnlyDev) { setStatusMessage("Режим только чтение: разработчик не может сохранять изменения в ваших сохранёнках."); return; }
 const _db = db || firebaseDb;
 const current = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
 const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
 const _uid = devNow ? OWNER_UID : (current ? current.uid : null);
 
 if (!_db || !_uid) {
 setStatusMessage('БД/пользователь не готовы');
 setTimeout(() => setStatusMessage(""), 2500);
 return;
 }
 if (!saveName.trim()) return;

 try {
 if (!savesCollectionRef?.current) {
 const path = `artifacts/${APP_ID}/users/${_uid}/embedBuilderSaves`;
 savesCollectionRef.current = collection(_db, path);
 
 }

 const docRef = doc(savesCollectionRef.current, saveName.trim());
 const payload = {
 embeds: embeds.map(sanitizeEmbed).filter(Boolean),
 activeEmbedId,
 customEmojis,
 commentsByEmbed,
 };
 
 await setDoc(docRef, stripUndefinedDeep(payload));
 setStatusMessage(`Проект "${saveName.trim()}" успешно сохранен!`);
 setCurrentSaveName(saveName.trim());
 } catch (error) {
 console.error("Failed to save state:", error);
 setStatusMessage("Ошибка сохранения: " + (error?.code || error?.message || ""));
 } finally {
 setShowSaveModal(false);
 setTimeout(() => setStatusMessage(""), 3000);
 }
 };

 const handleLoad = (stateToLoad) => {
 if (!stateToLoad) return;
 try {
 try { const all = window?.RustifyEmojiStore?.getAll?.() || []; const flat = Array.isArray(all) ? all.map(e => ({ name: e?.name || '', url: (e?.urls && e.urls[0]) || '' })) : []; setCustomEmojis(flat.filter(x => x.name && x.url)); } catch { setCustomEmojis(Array.isArray(stateToLoad.customEmojis) ? stateToLoad.customEmojis : []); }
 // --- BACKWARD COMPATIBILITY CHECK ---
 if (stateToLoad.items && !stateToLoad.embeds) {
 const convertedEmbed = {
 id: `embed-${Date.now()}`,
 name: stateToLoad.id || "Imported Embed",
 items: sanitizeItems(stateToLoad.items, stateToLoad.imageUrl),
 imageUrl: stateToLoad.imageUrl || DEFAULT_BANNER_URL,
 };
 setEmbeds([sanitizeEmbed(convertedEmbed)].filter(Boolean));
 setActiveEmbedId(convertedEmbed.id);
 setCommentsByEmbed(prev => ({ ...prev, [convertedEmbed.id]: [] }));
 } else {
 const loadedEmbeds = Array.isArray(stateToLoad.embeds) ? stateToLoad.embeds.map(sanitizeEmbed).filter(Boolean) : [];
 if (loadedEmbeds.length > 0) {
 setEmbeds(loadedEmbeds);
 setActiveEmbedId(stateToLoad.activeEmbedId || loadedEmbeds[0].id);
 setCommentsByEmbed(typeof stateToLoad.commentsByEmbed === 'object' && stateToLoad.commentsByEmbed ? stateToLoad.commentsByEmbed : {});
 } else {
 const defaultEmbed = createDefaultEmbed();
 setEmbeds([defaultEmbed]);
 setActiveEmbedId(defaultEmbed.id);
 }
 }
 
 setCurrentSaveName(stateToLoad.id);
 setShowLoadModal(false);
  setIsLoadedProject(true);
 setStatusMessage(`Проект "${stateToLoad.id}" загружен.`);
 } catch (error) {
 console.error("Failed to load and sanitize state:", error);
 setStatusMessage(`Ошибка загрузки проекта "${stateToLoad.id}".`);
 }
 setTimeout(() => setStatusMessage(""), 3000);
 };

 const handleDelete = async () => { if (isReadOnlyDev) { setStatusMessage("Режим только чтение: удаление сохранёнок недоступно этому аккаунту."); return; }
 if (!savesCollectionRef.current || !deleteConfirmId) return;
 const docRef = doc(savesCollectionRef.current, deleteConfirmId);
 try {
 await deleteDoc(docRef);
 setStatusMessage(`Проект "${deleteConfirmId}" удален.`);
 if (currentSaveName === deleteConfirmId) {
 setCurrentSaveName("");
 }
 } catch (error) {
 console.error("Failed to delete state:", error);
 setStatusMessage("Ошибка удаления.");
 }
 setDeleteConfirmId(null);
 setTimeout(() => setStatusMessage(""), 3000);
 };

 const handleRefreshSaves = async () => {
 setIsRefreshing(true);
 try {
 let ref = savesCollectionRef.current;
 const _db = db || firebaseDb;
 const current = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
 const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
 const _uid = devNow ? OWNER_UID : (current ? current.uid : null);
 if (!ref) {
 if (!_db || !_uid) {
 
 setStatusMessage("БД/пользователь не готовы");
 setTimeout(() => setStatusMessage(""), 2500);
 return;
 }
 const path = `artifacts/${APP_ID}/users/${_uid}/embedBuilderSaves`;
 ref = collection(_db, path);
 savesCollectionRef.current = ref;
 
 }
 const snapshot = await getDocs(ref);
 const saves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setSavedStates(saves);
 } catch (error) {
 console.error("Manual refresh failed", error);
 setStatusMessage("Ошибка обновления: " + (error?.code || error?.message || ""));
 } finally {
 setIsRefreshing(false);
 setTimeout(() => setStatusMessage(""), 2000);
 }
 };
 
 
 // Создание основного эмбеда без модалки — с автоименем
 const createNewMainEmbedAuto = () => {
 const base = "Новый Embed";
 const exists = new Set(embeds.map(e => (e.name || "").toLowerCase()));
 let i = 1;
 let candidate = `${base} ${i}`;
 while (exists.has(candidate.toLowerCase())) { i++; candidate = `${base} ${i}`; }
 const newEmbed = createDefaultEmbed(candidate);
 setEmbeds(prev => [...prev, newEmbed]);
 setActiveEmbedId(newEmbed.id);
 };
const handleAddNewEmbed = () => { if (!newEmbedName.trim()) { createNewMainEmbedAuto(); setShowNewEmbedModal(false); return; }
 const newEmbed = createDefaultEmbed(newEmbedName.trim());
 setEmbeds(prev => [...prev, newEmbed]);
 setActiveEmbedId(newEmbed.id);
 setNewEmbedName("");
 setShowNewEmbedModal(false);
 }

 // Создать вторичный эмбед, привязанный к текущему основному
 // Создать дочерний эмбед у текущего выбранного и СКОПИРОВАТЬ блоки родителя
 
// Изменить родителя эмбеда
const handleChangeParent = (childId, newParentId) => {
 setEmbeds(prev => prev.map(e => e.id === childId ? { ...e, parentId: newParentId || null } : e));
};
const handleAddSecondaryEmbed = () => {
 const parent = embeds.find(e => e.id === activeEmbedId);
 if (!parent) {
 const newMain = createDefaultEmbed("Главный эмбед");
 setEmbeds(prev => [...prev, newMain]);
 setActiveEmbedId(newMain.id);
 return;
 }

 // Глубокое копирование items родителя + обновление id, чтобы не конфликтовали внутри нового эмбеда
 const reId = (prefix="") => (id) => `${prefix}${Math.random().toString(36).slice(2,8)}`;

 const cloneItemsWithNewIds = (items) => {
 if (!Array.isArray(items)) return [];
 const nid = reId("it-");
 const nbid = reId("btn-");
 return items.map((it) => {
 if (!it || typeof it !== "object") return it;
 if (it.type === "buttons") {
 const buttons = Array.isArray(it.buttons) ? it.buttons.map(b => ({ 
 ...b, 
 id: nbid(),
 })) : [];
 return { ...it, id: nid(), buttons };
 }
 if (it.type === "text-with-button") {
 const newButton = it.button ? { ...it.button, id: nbid() } : undefined;
 return { ...it, id: nid(), button: newButton };
 }
 if (it.type === "list" || it.type === "text" || it.type === "image" || it.type === "hr") {
 return { ...it, id: nid() };
 }
 return { ...it, id: nid() };
 });
 };

 const clonedItems = cloneItemsWithNewIds(parent.items || []);

 const cnt = embeds.filter(e => e.parentId === parent.id).length + 1;
 const subName = `${parent.name || "Sub"} — копия ${cnt}`;

 const sub = {
 id: `sub-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
 name: subName,
 imageUrl: parent.imageUrl, // тот же баннер, что у родителя
 items: clonedItems, // скопированные блоки родителя
 parentId: parent.id,
 modals: []
 };

 setEmbeds(prev => [...prev, sub]);
 setActiveEmbedId(sub.id);
 };
 
 const handleDeleteEmbed = () => {
 if (!deletingEmbed) return;
 
 setEmbeds(prev => {
 const remaining = prev.filter(e => e.id !== deletingEmbed.id);
 if (remaining.length === 0) {
 const newDefault = createDefaultEmbed();
 setActiveEmbedId(newDefault.id);
 return [newDefault];
 }
 if (activeEmbedId === deletingEmbed.id) {
 setActiveEmbedId(remaining[0].id);
 }
 return remaining;
 });
 setDeletingEmbed(null);
 };

 const handleRenameEmbed = (newName) => {
 if (!renamingEmbed || !newName.trim()) {
 setRenamingEmbed(null);
 return;
 }
 setEmbeds(prev => prev.map(e => e.id === renamingEmbed.id ? { ...e, name: newName.trim() } : e));
 setRenamingEmbed(null);
 };

 // DnD state for blocks

 // DnD state for FOOTER blocks
 const [footerDragIndex, setFooterDragIndex] = useState(null);
 const [footerOverIndex, setFooterOverIndex] = useState(null);
 const [dragIndex, setDragIndex] = useState(null);
 const [overIndex, setOverIndex] = useState(null);
 const [embedDragIndex, setEmbedDragIndex] = useState(null);

 // Selection & edit state
 const [selectedBlockId, setSelectedBlockId] = useState(null);
 const [editingBtn, setEditingBtn] = useState(null);
 const [editingHrId, setEditingHrId] = useState(null);
 const [editingTextId, setEditingTextId] = useState(null);
 const [editingTextWithButtonId, setEditingTextWithButtonId] = useState(null);
 const [editingListId, setEditingListId] = useState(null);
 const [previewMode, setPreviewMode] = useState(false);
 // --- Comments (preview) ---
 const [commentsByEmbed, setCommentsByEmbed] = useState({}); // { [embedId]: Array<{id,x,y,w,h,text}> }
 const [isSelectingComment, setIsSelectingComment] = useState(false);
 
  
  /* === selection-hover highlight for comment mode (outermost, no double outline) === */
  useEffect(() => {
    try {
      if (typeof document === 'undefined') return;
      // ensure CSS (adds rule that disables hover outline if permanent comment highlight exists)
      if (!document.getElementById('__sel_hover_css')) {
        const style = document.createElement('style');
        style.id = '__sel_hover_css';
        style.textContent = `
          .__sel_hover_outline{ outline:2px solid #9ec070 !important; outline-offset:2px; border-radius:10px; }
          .__cmt_hl.__sel_hover_outline{ outline:2px solid #9ec070 !important; outline-offset:2px; border-radius:10px; } /* don't stack outlines */
          /* during comment picking, hide native focus/box-shadows inside work area to avoid double rims */
          .comment-pick *{ box-shadow: none !important; }
          .comment-pick *:not(.__sel_hover_outline){ outline: none !important; }
          
          .comment-pick button, .comment-pick a, .comment-pick [role="button"]{ box-shadow: none !important; }
        `;
        document.head.appendChild(style);
      }
      const root = document.querySelector('[data-work-area]');
      if (root) { root.classList.toggle('comment-pick', !!isSelectingComment); }
      if (!root) return;

      const outermostWithSameId = (el) => {
        try {
          if (!el || !el.getAttribute) return el;
          const id = el.getAttribute('data-item-id');
          if (!id) return el;
          let cur = el;
          while (true) {
            const p = cur.parentElement ? cur.parentElement.closest('[data-item-id]') : null;
            if (!p) break;
            if (p.getAttribute('data-item-id') === id) {
              cur = p; // bubble up to the outermost with same id
            } else {
              break;
            }
          }
          return cur;
        } catch { return el; }
      };

      const clearAllForId = (id) => {
        try {
          root.querySelectorAll('[data-item-id="'+id+'"].__sel_hover_outline').forEach(n => n.classList.remove('__sel_hover_outline'));
        } catch {}
      };

      const add = (e) => {
        try {
          const btn = e.target && e.target.closest ? e.target.closest('[data-btn-id]') : null;
          if (btn) { btn.classList.add('__sel_hover_outline'); return; }
          const el = e.target && e.target.closest ? e.target.closest('[data-item-id]') : null;
          if (!el) return;
          const id = el.getAttribute('data-item-id');
          clearAllForId(id);
          const top = outermostWithSameId(el);
          top && top.classList.add('__sel_hover_outline');
        } catch {}
      };
      const remove = (e) => {
        try {
          const btn = e.target && e.target.closest ? e.target.closest('[data-btn-id]') : null;
          if (btn) { btn.classList.remove('__sel_hover_outline'); }
          const el = e.target && e.target.closest ? e.target.closest('[data-item-id]') : null;
          if (!el) return;
          const id = el.getAttribute('data-item-id');
          clearAllForId(id);
        } catch {}
      };

      if (isSelectingComment) { try{ }catch{}
        root.addEventListener('pointerover', add, true);
        root.addEventListener('pointerout', remove, true);
      }
      return () => { try{ }catch{}
        try {
          root.removeEventListener('pointerover', add, true);
          root.removeEventListener('pointerout', remove, true);
          root.querySelectorAll('.__sel_hover_outline').forEach(el => el.classList.remove('__sel_hover_outline'));
        } catch {}
      };
    } catch {}
  }, [isSelectingComment, activeEmbedId]);
  /* === end selection-hover highlight === */
  /* === global capture: create comment on text/text-with-button click === */
  useEffect(() => {
    try {
      if (!isSelectingComment || !previewMode) return;
      const root = (workAreaRef?.current) || (typeof document !== 'undefined' ? document.querySelector('[data-work-area]') : null);
      if (!root) return;

      const onDown = (e) => {
        try {
          // Prefer button inside any block (including text-with-button)
          const btn = e.target && e.target.closest ? e.target.closest('[data-btn-id]') : null;
          if (btn) {
            const buttonId = btn.getAttribute('data-btn-id');
            const hostBlock = btn.closest('[data-item-id]');
            const blockId = hostBlock ? hostBlock.getAttribute('data-item-id') : null;
            if (blockId && buttonId) {              onBlockOrButtonCommentCreate && onBlockOrButtonCommentCreate({ blockId, buttonId });
              e.preventDefault(); e.stopPropagation();
            }
            return;
          }

          // Then whole text-ish blocks
          const el = e.target && e.target.closest ? e.target.closest('[data-item-id]') : null;
          let rawId = el ? el.getAttribute('data-item-id') : null;
          let blockId = rawId;
          // normalize thumbnails like `${id}::thumb` to the base block id
          if (blockId && blockId.includes('::')) blockId = blockId.split('::')[0];
          const isThumb = !!(rawId && rawId.endsWith('::thumb'));
          if (!blockId) return;
          const items = (currentEmbed && Array.isArray(currentEmbed.items)) ? currentEmbed.items : [];
          const item = items.find(x => x && x.id === blockId);
          const t = item ? item.type : null;
          if (t === 'text' || t === 'text-with-button' || t === 'list') {            onBlockOrButtonCommentCreate && onBlockOrButtonCommentCreate({ blockId, sub: (isThumb ? 'thumb' : undefined) });
            e.preventDefault(); e.stopPropagation();
          }
        } catch (err) { try { } catch {} }
      };

      root.addEventListener('pointerdown', onDown, true);
      return () => { try { root.removeEventListener('pointerdown', onDown, true); } catch {} };
    } catch {}
  }, [isSelectingComment, previewMode, activeEmbedId, activeMiniEmbedId, currentEmbed]);
  /* === end global capture === */
  // === prevent navigation while selecting a comment (buttons/links) ===
  useEffect(() => {
    try {
      if (!isSelectingComment || !previewMode) return;
      const root = (workAreaRef?.current) || (typeof document !== 'undefined' ? document.querySelector('[data-work-area]') : null);
      if (!root) return;

      const stopClick = (e) => {
        try {
          const btn = e.target && e.target.closest ? e.target.closest('[data-btn-id]') : null;
          if (btn) { e.preventDefault(); e.stopPropagation(); return; }
          // optionally block anchors inside preview to avoid accidental nav
          const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (a) { e.preventDefault(); e.stopPropagation(); return; }
        } catch {}
      };

      root.addEventListener('click', stopClick, true);
      return () => { try { root.removeEventListener('click', stopClick, true); } catch {} };
    } catch {}
  }, [isSelectingComment, previewMode]);
  // === end prevent navigation ===



  // === click-pick for buttons (including text-with-button) during comment mode ===
  useEffect(() => {
    try {
      if (!isSelectingComment) return;
      const host = workAreaRef?.current || (typeof document !== 'undefined' ? document.querySelector('[data-work-area]') : null);
      if (!host) return;
      const pick = (e) => {
        try {
          const btn = e.target && e.target.closest ? e.target.closest('[data-btn-id]') : null;
          if (!btn) return;
          const pid = btn.getAttribute('data-btn-id');
          const blk = btn.closest('[data-item-id]');
          const bid = blk ? blk.getAttribute('data-item-id') : null;
          if (bid && pid) {
            e.preventDefault(); e.stopPropagation();
            onBlockOrButtonCommentCreate && onBlockOrButtonCommentCreate({ blockId: bid, buttonId: pid });
            setIsSelectingComment(false);
            setSelectionRect && setSelectionRect(null);
            setActiveCommentId && setActiveCommentId(null);
          }
        } catch {}
      };
      host.addEventListener('click', pick, true);
      return () => { try { host.removeEventListener('click', pick, true); } catch {} };
    } catch {}
  }, [isSelectingComment, activeEmbedId]);


const [selectionRect, setSelectionRect] = useState(null);
 // Compute display rect from relative percentages (if present) anchored to target item; fallback to absolute
 const getCommentClientRect = (c) => {
 try {
 if (c && c.rel && c.targetItemId) {
 const host = workAreaRef?.current || document.querySelector('[data-work-area]');
 const item = host?.querySelector?.(`[data-item-id="${c.targetItemId}"]`);
 if (host && item) {
 const hostRc = host.getBoundingClientRect();
 const r = item.getBoundingClientRect();
 const left = (r.left - hostRc.left) + (c.rel.xPct || 0) * r.width;
 const top = (r.top - hostRc.top) + (c.rel.yPct || 0) * r.height;
 const width = (c.rel.wPct || 0) * r.width;
 const height = (c.rel.hPct || 0) * r.height;
 return { left, top, width, height };
 }
 }
 } catch (e) {}
 return { left: c?.x || 0, top: c?.y || 0, width: c?.w || 0, height: c?.h || 0 };
 };
 // {x,y,w,h}
 const [activeCommentId, setActiveCommentId] = useState(null);
 const [showAllHighlights, setShowAllHighlights] = useState(false);
 const currentComments = commentsByEmbed[activeMiniEmbedId ?? activeEmbedId] || [];
 // Resizing/moving active comment rect
 const [isAdjustingRect, setIsAdjustingRect] = useState(false);
 const [adjustMode, setAdjustMode] = useState(null); // 'move'|'nw'|'ne'|'sw'|'se'|'n'|'s'|'w'|'e'
 const [adjustStart, setAdjustStart] = useState({ x: 0, y: 0 });
 const [adjustOrig, setAdjustOrig] = useState({ x: 0, y: 0, w: 0, h: 0 });

   // Handles clicking on a comment card and logs 1st click after load
  const handleCommentCardClick = (comment) => {setActiveCommentId(comment?.id || null);
    try { requestAnimationFrame(() => setReflowTick(t => t + 1)); } catch (e) {}
  };
/* Reflow after project/comments load */
  useEffect(() => {
    let raf = requestAnimationFrame(() => setReflowTick(t => t + 1));
    return () => cancelAnimationFrame(raf);
  }, [activeEmbedId, currentComments]);

const activeComment = useMemo(
 () => currentComments.find(c => c.id === activeCommentId) || null,
 [currentComments, activeCommentId]
 );

 // --- Highlight target (block or button) from active comment ---
 const [highlightedBlockId, setHighlightedBlockId] = useState(null);
 const [highlightedButtonId, setHighlightedButtonId] = useState(null);
 const [highlightRect, setHighlightRect] = useState(null);
  const [reflowTick, setReflowTick] = useState(0);
 const [highlightBlockRect, setHighlightBlockRect] = useState(null);
 useEffect(() => {
  let raf = 0;
  let tries = 0;
  const MAX_TRIES = 10;
  const run = () => {
    try {
      if (!activeComment) { setHighlightedBlockId(null); setHighlightedButtonId(null); setHighlightRect(null); setHighlightBlockRect?.(null); return; }
      const mode = (activeComment?.mode || '').toLowerCase();
      const bid = activeComment.blockId || activeComment.targetItemId || activeComment.groupId || activeComment.itemId || null;
      const pid = activeComment.buttonId || activeComment.btnId || activeComment.targetButtonId || null;
      setHighlightedBlockId(bid);
      setHighlightedButtonId(pid);
      const host = workAreaRef?.current || (typeof document !== 'undefined' ? document.querySelector('[data-work-area]') : null);
      if (!host || !bid) { setHighlightRect(null); setHighlightBlockRect?.(null); return; }
      const blockEl = host.querySelector(`[data-item-id="${bid}"]`);
      let target = blockEl;
      // if comment targets a sub-element (e.g., thumbnail), redirect target
      try {
        const sub = (activeComment && activeComment.sub) || null;
        if (sub === 'thumb' && host && bid) {
          const thumbEl = host.querySelector(`[data-item-id="${bid}::thumb"]`);
          if (thumbEl) target = thumbEl;
        }
      } catch {}

      if (pid && host) {
        const btnEl = host.querySelector(`[data-btn-id="${pid}"]`);
        if (btnEl) target = btnEl;
      }
      if (!target) { if (tries++ < MAX_TRIES) { raf = requestAnimationFrame(run); } return; }
      const hostRc = host.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      if ((r.width || 0) <= 0 || (r.height || 0) <= 0) { if (tries++ < MAX_TRIES) { raf = requestAnimationFrame(run); } return; }
      setHighlightRect({ left: r.left - hostRc.left, top: r.top - hostRc.top, width: r.width, height: r.height });
      if (typeof setHighlightBlockRect === 'function' && blockEl) {
        const br = blockEl.getBoundingClientRect();
        setHighlightBlockRect({ left: br.left - hostRc.left, top: br.top - hostRc.top, width: br.width, height: br.height });
      }
    } catch (e) { /* noop */ }
  };
  raf = requestAnimationFrame(run);
  return () => { if (raf) cancelAnimationFrame(raf); };
}, [activeCommentId, activeComment, commentsByEmbed, activeEmbedId]);

 const setComments = (updater) => {
 // emulate setState API but scoped to activeEmbedId
 setCommentsByEmbed(prev => {
 const prevArr = prev[activeEmbedId] || [];
 const nextArr = typeof updater === 'function' ? updater(prevArr) : updater;
 return { ...prev, [activeEmbedId]: nextArr };
 });
 };

 const workAreaRef = useRef(null);
 const startCommentSelection = () => {
 if (!previewMode) setPreviewMode(true);
 setIsSelectingComment(true);
 setSelectionRect(null);
 };

 const colors = useMemo(() => ({
appBg: "bg-[#1E1F22]",
 panelBg: "bg-[#1A1B1E]",
 embedBg: "bg-[#2B2D31]",
 text: "text-[#DBDEE1]",
 border: "border-[#202225]",
 accent: "bg-[#424249]",
 subtle: "text-[#A3A6AA]",
 rustify: "#9ec070",
 secondaryBtn: "bg-[#4f545c] hover:bg-[#5d6269]",
 linkBtn: "bg-[#4f545c] hover:bg-[#5d6269]",
 primaryBtn: "bg-[#5865F2] hover:bg-[#4752C4] text-white",
 successBtn: "bg-[#248046] hover:bg-[#1a6336] text-white",
 dangerBtn: "bg-[#D83C3E] hover:bg-[#A12D2E] text-white",
 
}), []);

 // --- Block Manipulation ---
 const modifyItems = (modifier) => {
 updateCurrentEmbed({ items: modifier(currentEmbed.items || []) });
 };

// Move a block (by id) up or down among visible items (footer excluded STRICTLY)
const moveBlock = (blockId, delta) => {
  if (!currentEmbed || !Array.isArray(currentEmbed.items)) return;
  modifyItems(prev => {
    const items = [...prev];
    // Indices of visible (non-footer) items: exclude ANY item with position === 'footer'
    const visibleIdxs = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!(it && it.position === 'footer')) {
        visibleIdxs.push(i);
      }
    }
    // Current position of the block within visible list
    let pos = -1;
    for (let k = 0; k < visibleIdxs.length; k++) {
      const realIdx = visibleIdxs[k];
      if (items[realIdx] && items[realIdx].id === blockId) { pos = k; break; }
    }
    if (pos < 0) return prev;
    const nextPos = pos + (delta < 0 ? -1 : 1);
    if (nextPos < 0 || nextPos >= visibleIdxs.length) return prev; // can't move
    const i = visibleIdxs[pos];
    const j = visibleIdxs[nextPos];
    const next = [...items];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    return next;
  });
  // Keep selection/focus after move
  setSelectedBlockId(blockId);
};
 const onImageCommentCreate = ({ x, y, w, h , itemId, rel}) => {
 const id = 'cmt-' + Math.random().toString(36).slice(2, 8);
 const newC = { id, mode: 'image', targetItemId: itemId || null, rel: rel || null, x, y, w, h, text: '' };
 setCommentsByEmbed(prev => ({...prev, [activeMiniEmbedId ?? activeEmbedId]: [ ...(prev[activeMiniEmbedId ?? activeEmbedId] || []), newC ] }));
 setActiveCommentId(id);
 setIsSelectingComment(false);
 setSelectionRect(null);
 };

// Создание комментария для блока Меню или отдельной кнопки
const onBlockOrButtonCommentCreate = ({ blockId, buttonId, sub }) => {  const id = 'cmt-' + Math.random().toString(36).slice(2, 8);
  const newC = buttonId ? {   id, mode: 'button', blockId, buttonId, text: ''   } : ({ id, mode: 'block', blockId, ...(sub ? { sub } : {}), text: '' });

  setCommentsByEmbed(prev => ({...prev, [activeMiniEmbedId ?? activeEmbedId]: [ ...(prev[activeMiniEmbedId ?? activeEmbedId] || []), newC ] }));
  setActiveCommentId(id);
  setIsSelectingComment(false);
  setSelectionRect(null);
};

 // Reorder blocks inside FOOTER area only
 const onFooterDragStart = (fi) => (e) => {
 if (previewMode) return;
 e.dataTransfer.effectAllowed = 'move';
 e.dataTransfer.setData('text/plain', String(fi));
 setFooterDragIndex(fi);
 };
 const onFooterDragOver = (fi) => (e) => {
 if (previewMode) return;
 e.preventDefault();
 setFooterOverIndex(fi);
 };
 const onFooterDrop = (fi) => (e) => {
 if (previewMode) return;
 e.preventDefault();
 const from = footerDragIndex;
 const to = fi;
 setFooterDragIndex(null);
 setFooterOverIndex(null);
 if (from === null || to === null || from === to) return;
 modifyItems(prev => {
 const next = [...prev];
 const footerIdxs = [];
 for (let i = 0; i < next.length; i++) {
 const it = next[i];
 if (it && it.position === 'footer' && (it.type === 'buttons' || it.type === 'list')) footerIdxs.push(i);
 }
 const i = footerIdxs[from];
 const j = footerIdxs[to];
 if (i == null || j == null) return prev;
 const [moved] = next.splice(i, 1);
 next.splice(j, 0, moved);
 return next;
 });
 };
 const onFooterDragEnd = (fi) => (e) => {
 setFooterDragIndex(null);
 setFooterOverIndex(null);
 };

 
 const addFooterMenu = () => {
 if (!currentEmbed || !Array.isArray(currentEmbed.items)) return;
 const existing = currentEmbed.items.find(it => it && it.type === 'buttons' && it.position === 'footer');
 if (existing) {
 setSelectedBlockId(existing.id);
 return;
 }
 const id = `footer-${Math.random().toString(36).slice(2, 8)}`;
 const newBlock = { id, type: 'buttons', position: 'footer', buttons: [sanitizeButton({ label: 'Кнопка' })] };
 updateCurrentEmbed({ items: [...(currentEmbed.items || []), newBlock] });
 setSelectedBlockId(id);
 };

 const addFooterList = () => {
 if (!currentEmbed || !Array.isArray(currentEmbed.items)) return;
 const existing = currentEmbed.items.find(it => it && it.type === 'list' && it.position === 'footer');
 if (existing) {
 setSelectedBlockId(existing.id);
 setEditingListId && setEditingListId(existing.id);
 return;
 }
 const id = `f-list-${Math.random().toString(36).slice(2, 8)}`;
 const newBlock = {
 id,
 type: 'list',
 position: 'footer',
 placeholder: 'Выберите вариант',
 listItems: [
 'Вариант 1||',
 'Вариант 2||',
 'Вариант 3||'
 ]
 };
 updateCurrentEmbed({ items: [...(currentEmbed.items || []), newBlock] });
 setSelectedBlockId(id);
 setEditingListId && setEditingListId(id);
 };
const addMenu = () => {
 const id = `grp-${Math.random().toString(36).slice(2, 8)}`;
 const newBlock = { id, type: "buttons", buttons: [sanitizeButton({ label: "Кнопка" })] };
 modifyItems(prev => [...prev, newBlock]);
 setSelectedBlockId(id);
 };

 const addHr = () => {
 const id = `hr-${Math.random().toString(36).slice(2, 8)}`;
 modifyItems(prev => [...prev, { id, type: "hr" }]);
 setSelectedBlockId(id);
 };

 const addText = () => {
 const id = `txt-${Math.random().toString(36).slice(2, 8)}`;
 const block = { id, type: 'text', thumbUrl: '', content: `# Заголовок\n\nНовый текстовый блок.` };
 modifyItems(prev => [...prev, block]);
 setSelectedBlockId(id);
 setEditingTextId(id);
 };

 const addTextWithButton = () => {
 const id = `twb-${Math.random().toString(36).slice(2, 8)}`;
 const block = { id, type: 'text-with-button', content: '# Заголовок\n\nТекст с кнопкой справа.', button: sanitizeButton({ label: 'Кнопка' }) };
 modifyItems(prev => [...prev, block]);
 setSelectedBlockId(id);
 setEditingTextWithButtonId(id);
 };

 
 const addList = () => {
 const id = `list-${Math.random().toString(36).slice(2, 8)}`;
 const block = { id, type: 'list', listItems: ['Вариант 1', 'Вариант 2', 'Вариант 3'] };
 modifyItems(prev => [...prev, block]);
 setSelectedBlockId(id);
 setEditingListId(id);
 };
const deleteHr = (hrId) => {
 modifyItems(prev => prev.filter((it) => !(it.type === "hr" && it.id === hrId)));
 setEditingHrId(null);
 if (selectedBlockId === hrId) setSelectedBlockId(null);
 };

 const deleteText = (id) => {
 modifyItems(prev => prev.filter((it) => !(it.type === 'text' && it.id === id)));
 if (selectedBlockId === id) setSelectedBlockId(null);
 setEditingTextId(null);
 };

 const deleteTextWithButton = (id) => {
 modifyItems(prev => prev.filter((it) => it.id !== id));
 if (selectedBlockId === id) setSelectedBlockId(null);
 setEditingTextWithButtonId(null);
 };
const deleteList = (id) => {
 modifyItems(prev => prev.filter((it) => !(it.type === 'list' && it.id === id)));
 if (selectedBlockId === id) setSelectedBlockId(null);
 setEditingListId(null);
};

 const addButtonToBlock = (blockId) => {
 modifyItems(prev => prev.map((it) =>
 it.type === 'buttons' && it.id === blockId ? { ...it, buttons: [...it.buttons, sanitizeButton({ label: 'Кнопка' })] } : it
 ));
 };

 const onReorderButtons = (blockId, from, to) => {
 modifyItems(prev => prev.map((it) => {
 if (it.type !== 'buttons' || it.id !== blockId) return it;
 const nextBtns = [...it.buttons];
 const [moved] = nextBtns.splice(from, 1);
 nextBtns.splice(to, 0, moved);
 return { ...it, buttons: nextBtns };
 }));
 };

 const onDrop = (idx) => (e) => {
 if (previewMode) return;
 e.preventDefault();
 const from = dragIndex;
 const to = idx;
 setDragIndex(null);
 setOverIndex(null);
 if (from === null || to === null || from === to) return;
 modifyItems(prev => {
 const next = [...prev];
 const [moved] = next.splice(from, 1);
 next.splice(to, 0, moved);
 return next;
 });
 };

 const updateButton = (blockId, btnId, patch) => {
 modifyItems(prev => prev.map((it) =>
 it.type === "buttons" && it.id === blockId ? { ...it, buttons: it.buttons.map((b) => (b.id === btnId ? sanitizeButton({ ...b, ...patch }) : b)) } : it
 ));
 };

 const deleteButton = (blockId, btnId) => {
 modifyItems(prev => {
 const next = prev.map((it) =>
 it.type === "buttons" && it.id === blockId ? { ...it, buttons: it.buttons.filter((b) => b.id !== btnId) } : it
 );
 return next.filter((it) => (it.type === "buttons" ? it.buttons.length > 0 : true));
 });
 setEditingBtn(null);
 };

 // Emoji Handlers
 
const addCustomEmoji = (e) => {
  e.preventDefault();
  const name = (newEmojiName || '').trim();
  const url  = (newEmojiUrl || '').trim();
  if (!name || !url) return;
  if (customEmojis.some(em => (em && String(em.name) === name))) { 
    try { window.RustifyToast && window.RustifyToast.show('error','Эмодзи с таким именем уже есть'); } catch {}
    return; 
  }
  const next = [...(Array.isArray(customEmojis)?customEmojis:[]), { name, url }];
  setCustomEmojis(next);

  try{
    const store = (window && window.RustifyEmojiStore && typeof window.RustifyEmojiStore.getAll==='function') ? window.RustifyEmojiStore.getAll() : [];
    const arr   = Array.isArray(store) ? store.slice() : [];
    arr.push({ id: null, name, urls: [url], aliases: [] });
    if (window && window.RustifyEmojiStore && typeof window.RustifyEmojiStore.setAll==='function') { window.RustifyEmojiStore.setAll(arr); }
  }catch{}

  setGlobalFromStore(next);
  try { window.RustifyToast && window.RustifyToast.show('success','Глобальные эмодзи сохранены'); } catch {}
  setNewEmojiName(''); setNewEmojiUrl('');
};


 const deleteCustomEmoji = (name) => {
  try { const target = (Array.isArray(customEmojis) ? customEmojis : []).find(e => e.name === name); if (target?.url) { window.RustifyEmojiStore?.removeByUrl(target.url); } } catch {}
  syncFromGlobal();
  try { queueSaveGlobal(); window.RustifyToast && window.RustifyToast.show('success','Сохраняю глобальные эмодзи…'); } catch {}
};
 const startRenameEmoji = (old) => setEmojiRename({ old, value: old });
 const cancelRenameEmoji = () => setEmojiRename(null);
 const saveRenameEmoji = () => {
  if (!emojiRename) return;
  const newName = (emojiRename.value || '').trim();
  if (!newName) { setEmojiRename(null); return; }
  if (/[^a-z0-9_]/i.test(newName)) { return; }
  try {
    const target = (Array.isArray(customEmojis) ? customEmojis : []).find(e => e.name === emojiRename.old);
    if (target?.url) { window.RustifyEmojiStore?.addOrUpdate(target.url, newName); }
  } catch {}
  syncFromGlobal();
  try { queueSaveGlobal(); window.RustifyToast && window.RustifyToast.show('success','Сохраняю глобальные эмодзи…'); } catch {}
  setEmojiRename(null);
};
const setEmojiIdManual = (name) => {
  try {
    const current = (Array.isArray(customEmojis) ? customEmojis : []).find(e => e.name === name)?.id || '';
    const next = window.prompt('ID эмодзи (Discord Snowflake):', current);
    if (next === null) return; // canceled
    const id = String(next).trim();
    // Optional numeric validation: allow digits only (snowflake)
    if (id && /\D/.test(id)) {
      if (!window.confirm('ID содержит нецифровые символы. Всё равно сохранить?')) return;
    }
    setCustomEmojis((list) => (Array.isArray(list) ? list : []).map(e => e && e.name === name ? ({ ...e, id }) : e));
    try { queueSaveGlobal(); window.RustifyToast && window.RustifyToast.show('success','ID эмодзи сохранён'); } catch {}
  } catch {}
};


 // --- Derived current editing items ---
 const currentBtn = useMemo(() => {
 if (!editingBtn || !currentEmbed) return null;
 const block = currentEmbed.items.find((it) => it.type === "buttons" && it.id === editingBtn.blockId);
 const btn = block && block.buttons.find((b) => b.id === editingBtn.btnId);
 return btn ? { blockId: block.id, data: btn } : null;
 }, [editingBtn, currentEmbed]);

 const currentText = useMemo(() => {
 if (!editingTextId || !currentEmbed) return null;
 const t = currentEmbed.items.find((it) => it.type === 'text' && it.id === editingTextId);
 return t && t.type === 'text' ? t : null;
 }, [editingTextId, currentEmbed]);

 const currentTextWithButton = useMemo(() => {
 if (!editingTextWithButtonId || !currentEmbed) return null;
 const t = currentEmbed.items.find((it) => it.type === 'text-with-button' && it.id === editingTextWithButtonId);
 return t && t.type === 'text-with-button' ? t : null;
 }, [editingTextWithButtonId, currentEmbed]);

 const currentList = useMemo(() => {
 if (!editingListId || !currentEmbed) return null;
 const t = currentEmbed.items.find((it) => it.type === 'list' && it.id === editingListId);
 return t && t.type === 'list' ? t : null;
 }, [editingListId, currentEmbed]);

 if (!currentEmbed) {
 return <div className={`min-h-screen flex items-center justify-center ${colors.appBg} ${colors.text} w-full`}>Загрузка...</div>;
 }

 return (
 <AuthUiContext.Provider value={{ user: (firebaseAuth && firebaseAuth.currentUser) || null, onLogout: () => signOut(firebaseAuth) }}>

 <div
 className={`min-h-screen flex flex-col ${colors.appBg} ${colors.text} p-6 w-full`}
 onClick={() => { if (!previewMode) setSelectedBlockId(null); }}
 >
 {/* Preview */}
 <div className="flex-1 overflow-auto mb-6">
 <div
 className="relative w-full max-w-none" onClick={(e) => { if (!previewMode && e.target === e.currentTarget) setSelectedBlockId(null); }}
 >
 {loadingStatus !== 'ready' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-sm z-50 rounded-lg"><p>Подключение к базе данных...</p></div>}
 
 <div className="flex gap-4">
 <EmbedSidebar embeds={embeds} activeEmbedId={activeEmbedId} setActiveEmbedId={setActiveEmbedId} onSelectParent={(id)=>{ setActiveMiniEmbedId(null); setActiveEmbedId(id); }}
 onDeleteClick={(embed) => setDeletingEmbed(embed)}
 onRenameClick={(embed) => setRenamingEmbed(embed)}
 onReorder={(from, to) => {
 setEmbeds(prev => {
 const next = [...prev];
 const [moved] = next.splice(from, 1);
 next.splice(to, 0, moved);
 return next;
 });
 }}
 onCreateMain={handleAddNewEmbed}
 onCreateSecondary={handleAddSecondaryEmbed}
 onChangeParent={handleChangeParent}
 onRename={(id, name) => setEmbeds(prev => prev.map(e => e.id === id ? { ...e, name } : e))}
  remoteEmbedStatuses={remoteEmbedStatuses} />
 <div ref={workAreaRef} data-work-area className="relative flex-1 min-w-0" onClick={(e) => { if (previewMode && !isSelectingComment) { setActiveCommentId(null); } }}>
 
 <div className="flex items-center gap-2 text-xs opacity-90" onClick={(e)=>e.stopPropagation()}>
 <div className="inline-flex gap-1 rounded-md overflow-hidden border border-[#202225]">
 <div className="flex items-center gap-2">
 {isLoadedProject && (<StatusToggle3 value={effectiveCurrentStatus} onChange={(s) => handleStatusClick(s)} />)}
 <div className="relative inline-grid grid-cols-2 items-center rounded-[0.75rem] bg-[#1f2226] border border-[#33363a] select-none">
  {/* бегунок: ширина ровно 50% контейнера, учтён только бордер */}
  <span
    className={`pointer-events-none absolute top-[2px] left-[2px] bottom-[2px] w-[calc(50%-2px)] rounded-[0.75rem] transition-transform transition-colors duration-200 ease-out ${
      previewMode ? "translate-x-full" : "translate-x-0"
    } bg-[#6a8aec] shadow-[0_2px_14px_rgba(106,138,236,0.35)]`}
  />

  <button
    type="button"
    onClick={() => setPreviewMode(false)}
    className={`relative z-10 h-8 px-4 text-xs font-medium rounded-none bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 border-none hover:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:border-none active:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 active:border-none focus:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 outline-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0 ${
      !previewMode ? "text-white" : "text-white/70 hover:text-white"
    }`}
    style={{ backgroundColor: "transparent", border: "none" }}
  >
    Редакт.
  </button>
  <button
    type="button"
    onClick={() => setPreviewMode(true)}
    className={`relative z-10 h-8 px-4 text-xs font-medium rounded-none bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 border-none hover:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 hover:border-none active:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 active:border-none focus:bg-transparent border-0 hover:border-0 focus:border-0 focus-visible:border-0 active:border-0 outline-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0 ${
      previewMode ? "text-white" : "text-white/70 hover:text-white"
    }`}
    style={{ backgroundColor: "transparent", border: "none" }}
  >
    Предпросм.
  </button>
</div>
 </div>
</div>

 </div>
 <MessageRow colors={colors} footer={footerBlocks.length ? (
 <div className="mt-3 space-y-3" onClick={(e)=>e.stopPropagation()}>
 {footerBlocks.map((fb, fi) => (
 fb.type === 'buttons' ? (
 <ButtonsBlock
 key={fb.id}
 idx={-1}
 block={fb}
 colors={colors}
 selected={selectedBlockId === fb.id}
 setSelectedBlockId={setSelectedBlockId}
 setEditingBtn={setEditingBtn}
 previewMode={previewMode} isSelectingComment={isSelectingComment} highlightedButtonId={highlightedButtonId} setHighlightedButtonId={setHighlightedButtonId}
 onAddButton={addButtonToBlock}
 onReorderButtons={onReorderButtons} onMiniEmbedLinkClick={onMiniEmbedLinkClick}
 onEmbedLinkClick={handleSelectEmbed} onModalLinkClick={(id)=>{ window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id}})); }}
 onDragStart={(idx) => onFooterDragStart(fi)}
 onDragOver={(idx) => onFooterDragOver(fi)}
 onDrop={(idx) => onFooterDrop(fi)}
 onDragEnd={(idx) => onFooterDragEnd(fi)}
 />
 ) : (
 <ListBlock
 key={fb.id}
 idx={-1}
 block={fb}
 colors={colors}
 selected={selectedBlockId === fb.id}
 setSelectedBlockId={setSelectedBlockId}
 setEditingListId={setEditingListId}
 previewMode={previewMode} onMiniEmbedLinkClick={onMiniEmbedLinkClick}
 onDragStart={(idx) => onFooterDragStart(fi)}
 onDragOver={(idx) => onFooterDragOver(fi)}
 onDrop={(idx) => onFooterDrop(fi)}
 onDragEnd={(idx) => onFooterDragEnd(fi)}
 />
 )
 ))}
 </div>
 ) : null}>
 <EmbedCanvas
 key={activeEmbedId} // Force re-render on tab change
 colors={colors}
 items={itemsForCanvas}
 customEmojis={customEmojis}
 selectedBlockId={selectedBlockId}
 setSelectedBlockId={setSelectedBlockId}
 onDragStart={(idx) => (e) => { if (previewMode) return; const mapIndex = canvasIndexMap[idx]; setDragIndex(mapIndex); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); }}
 onDragOver={(idx) => (e) => { if (previewMode) return; e.preventDefault(); const mapIndex = canvasIndexMap[idx]; setOverIndex(mapIndex); }}
 onDrop={(idx) => (e) => onDrop(canvasIndexMap[idx])(e)}
 onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
 setEditingBtn={setEditingBtn}
 setEditingHrId={setEditingHrId}
 setEditingTextId={(id)=>{ if (selectedBlockId===id){ setEditingTextId(id); } else { setSelectedBlockId(id); } }}
 setEditingTextWithButtonId={(id)=>{ if (selectedBlockId===id){ setEditingTextWithButtonId(id); } else { setSelectedBlockId(id); } }}
 setEditingListId={setEditingListId}
 previewMode={previewMode}
 onAddButton={addButtonToBlock}
 onReorderButtons={onReorderButtons}
 onEmbedLinkClick={handleSelectEmbed} onModalLinkClick={(id)=>{ window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id}})); }}
 onMoveBlock={moveBlock} 
 imgBust={(imageBust[activeEmbedId]||0)} onMiniEmbedLinkClick={onMiniEmbedLinkClick} isSelectingComment={isSelectingComment} workAreaRef={workAreaRef} onImageCommentCreate={onImageCommentCreate} onBlockOrButtonCommentCreate={onBlockOrButtonCommentCreate} />
 
</MessageRow>
 {/* Selection overlay & highlights (preview) */}

 {/* Highlight of block/button from active comment */}
 {!!highlightRect && !showAllHighlights && (
   <div className="absolute inset-0 z-[9999] pointer-events-none">
     <div className="absolute border-2 border-[#9ec070]/90 rounded"
          style={{ left: highlightRect.left, top: highlightRect.top, width: highlightRect.width, height: highlightRect.height }} />
   </div>
 )}
 
 

{showAllHighlights ? (
  <div className="absolute inset-0 z-[9999] pointer-events-auto">
    {currentComments.map((c, i) => {
      try {
        const host = workAreaRef?.current || (typeof document !== 'undefined' ? document.querySelector('[data-work-area]') : null);
        if (!host) return null;
        const mode = (c?.mode || '').toLowerCase();
        const bid = c.blockId || c.targetItemId || c.groupId || c.itemId || null;
        const pid = c.buttonId || c.btnId || c.targetButtonId || null;
        if (!bid) return null;
        const blockEl = host.querySelector(`[data-item-id="${bid}"]`);
        if (!blockEl) return null;
        let target = blockEl;
        // support sub-targets for saved comments
        try {
          const sub = (c && c.sub) || null;
          if (sub === 'thumb' && host && bid) {
            const thumbEl = host.querySelector(`[data-item-id="${bid}::thumb"]`);
            if (thumbEl) target = thumbEl;
          }
        } catch {}

        if ((mode === 'button' || mode === 'buttons' || mode === 'menu-button') && pid) {
          const btnEl = host.querySelector(`[data-btn-id="${pid}"]`);
          if (btnEl) target = btnEl;
        }
        const hostRc = host.getBoundingClientRect();
        const r = target.getBoundingClientRect();
        if ((r.width || 0) <= 0 || (r.height || 0) <= 0) return null;
        return (
          <div
            key={c.id}
            className="absolute border-2 border-[#9ec070]/80 rounded cursor-pointer"
            style={{ left: r.left - hostRc.left, top: r.top - hostRc.top, width: r.width, height: r.height }}
            onClick={(e) => { e.stopPropagation(); handleCommentCardClick(c); }}
          >
            <div className="absolute -top-4 left-0 text-xs bg-[#9ec070] text-[#2B2D31] px-1 rounded">{i+1}</div>
          </div>
        );
      } catch (e) { return null; }
    })}
  </div>
) : (
  activeComment && (
    <div className="absolute inset-0 z-[9999] pointer-events-auto" onClick={(e) => { if (e.target === e.currentTarget) setActiveCommentId(null); }}>
      {(() => {
        const rc = getCommentClientRect(activeComment);
        if (!rc || rc.width <= 0 || rc.height <= 0) return null;
        return (
          <div
            key={activeComment.id}
            className="absolute border-2 border-[#9ec070]/80 rounded z-30"
            style={{ left: rc.left, top: rc.top, width: rc.width, height: rc.height }}
          >
            <div
              className="absolute inset-0 cursor-move"
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsAdjustingRect(true);
                setAdjustMode('move');
                setAdjustStart({ x: e.clientX, y: e.clientY });
                setAdjustOrig({ x: activeComment.x, y: activeComment.y, w: activeComment.w, h: activeComment.h });
              }}
            />
          </div>
        );
      })()}
    </div>
  )
)}
{previewMode && isSelectingComment && false && (
 <div
 className="absolute inset-0 z-40"
 style={{ cursor: 'crosshair' }}
 onMouseDown={(e) => {
 const host = workAreaRef.current;
 if (!host) return;
 const rc = host.getBoundingClientRect();
 const startX = e.clientX - rc.left;
 const startY = e.clientY - rc.top;
 setSelectionRect({ x: startX, y: startY, w: 0, h: 0 });
 }}
 onMouseMove={(e) => {
 if (!selectionRect) return;
 const host = workAreaRef.current;
 if (!host) return;
 const rc = host.getBoundingClientRect();
 const curX = Math.max(0, Math.min(e.clientX - rc.left, rc.width));
 const curY = Math.max(0, Math.min(e.clientY - rc.top, rc.height));
 const x = Math.min(selectionRect.x, curX);
 const y = Math.min(selectionRect.y, curY);
 const w = Math.abs(curX - selectionRect.x);
 const h = Math.abs(curY - selectionRect.y);
 setSelectionRect({ x, y, w, h });
 }}
 onMouseUp={() => {
 if (selectionRect && selectionRect.w > 4 && selectionRect.h > 4) {
 const id = 'cmt-' + Math.random().toString(36).slice(2,8);
 const newC = { id, ...selectionRect, text: '' };
 setCommentsByEmbed(prev => ({...prev, [activeMiniEmbedId ?? activeEmbedId]: [ ...(prev[activeMiniEmbedId ?? activeEmbedId] || []), newC ] }));
 setActiveCommentId(id);
 }
 setIsSelectingComment(false);
 setSelectionRect(null);
 }}
 >
 <div className="absolute inset-0 bg-black/40 pointer-events-none" />
 {selectionRect && (
 <div
 className="absolute bg-indigo-500/20 border-2 border-[#93d36f] rounded"
 style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.w, height: selectionRect.h }}
 />
 )}
 </div>
 )}
 </div>
 {/* ProfileBar is rendered from wrapper above */}

 <div className="shrink-0 flex flex-col">

 <AuthProfileBar />
        {DEV_EXPORT && (
          <DevInspectBar currentEmbed={currentEmbed} parentEmbed={parentEmbed} embeds={embeds} activeEmbedId={activeEmbedId} />
        )}

 <CommentsSidebar
 comments={currentComments}
 activeId={activeCommentId}
 onAdd={startCommentSelection}
 onChange={(id, patch) => setCommentsByEmbed(prev => ({...prev, [activeMiniEmbedId ?? activeEmbedId]: (prev[activeMiniEmbedId ?? activeEmbedId] || []).map(c => c.id === id ? { ...c, ...patch } : c)}))}
 onDelete={(id) => setCommentsByEmbed(prev => ({...prev, [activeMiniEmbedId ?? activeEmbedId]: (prev[activeMiniEmbedId ?? activeEmbedId] || []).filter(c => c.id !== id)}))}
 onFocus={(id) => setActiveCommentId(id)}
 selecting={isSelectingComment}
 onCancel={() => { setIsSelectingComment(false); setSelectionRect(null); }}
 showAll={showAllHighlights}
 onToggleShowAll={() => setShowAllHighlights(prev => !prev)} />

 <ModalsSidebar modals={modals} onCreate={handleCreateModal} onOpen={handleOpenModal} onOpenSettings={handleOpenModalSettings} activeId={activeModalId} />
 
 <MiniEmbedsSidebar onDelete={handleDeleteMiniEmbed} onReorder={handleReorderMiniEmbed} onRename={handleRenameMiniEmbed} miniEmbeds={miniEmbeds} onCreate={handleCreateMiniEmbed} onOpen={handleOpenMiniEmbed} activeId={activeMiniEmbedId}  remoteEmbedStatuses={remoteEmbedStatuses} />
 

{modalMode && (
 <Modal onClose={handleCloseModal} contentClassName="w-[520px] max-w-[95vw]">
 {modalMode === 'create' ? (
 <form className="space-y-4 w-full" onSubmit={(e) => {
 e.preventDefault();
 const title = newModalTitle.trim();
 if (!title) return;
 const id = 'm_' + Math.random().toString(36).slice(2, 9);
 setModals(prev => [...prev, { id, title }]);
 setActiveModalId(id);
 setModalMode('view');
 }}>
 <div className="text-lg font-semibold">Создать окно</div>
 <input
 type="text"
 value={newModalTitle}
 onChange={(e) => setNewModalTitle(e.target.value)}
 placeholder="Введите название окна"
 
 

 className="w-full px-3 py-2 rounded-md bg-[#1e1f22] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 />


 <div className="flex justify-end gap-2 pt-2">
 <button type="button" onClick={() => { setModalMode(null); setActiveModalId(null); }} className="px-3 py-2 rounded-md bg-[#4f535c] hover:bg-[#5d6269] text-sm">
 Отмена
 </button>
 <button type="submit" className="px-3 py-2 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm h-9 flex items-center justify-center leading-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">
 Создать
 </button>
 </div>
 </form>
 ) : modalMode === 'settings' ? (
 <form className="space-y-4 w-full" onSubmit={(e) => { e.preventDefault(); setModalMode(null); }}>
 
 <div className="flex items-center justify-between">
 <div className="text-lg font-semibold">Настройки окна</div>
 <button
 type="button"
 className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-sm text-white focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => {
 const delId = activeModalId;
 if (!delId) return;
 // remove modal
 setModals(prev => prev.filter(m => m.id !== delId));
 // cleanup links in items
 modifyItems(prev => prev.map(it => {
 if (it.type === 'buttons') {
 const buttons = (it.buttons || []).map(b => (b.linkToModalId === delId ? { ...b, linkToModalId: '' } : b));
 return { ...it, buttons };
 }
 if (it.type === 'text-with-button') {
 const b = it.button || null;
 if (b && b.linkToModalId === delId) {
 return { ...it, button: { ...b, linkToModalId: '' } };
 }
 return it;
 }
 return it;
 }));
 setActiveModalId(null);
 setModalMode(null);
 }}
 >
 Удалить окно
 </button>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white/80">Название окна</label>
 <input
 type="text"
 value={(modals.find(m => m.id === activeModalId)?.title) || ""}
 onChange={(e) => {
 const v = e.target.value;
 setModals(prev => prev.map(m => m.id === activeModalId ? { ...m, title: v } : m));
 }}
 placeholder="Введите название окна"
 className="w-full px-3 py-2 rounded-md bg-[#1e1f22] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 autoFocus
 />
<div className="space-y-1 mt-2">
  <label className="text-xs text-white/70">Переход на мини-эмбед (после «Отправить»)</label>
  <select
    value={(modals.find(m => m.id === activeModalId)?.submitLinkToMiniEmbedId) || ""}
    onChange={(e) => {
      const v = e.target.value || "";
      setModals(prev => prev.map(m => m.id === activeModalId ? { ...m, submitLinkToMiniEmbedId: v || undefined } : m));
    }}
    className="w-full px-3 py-2 rounded-md bg-[#1e1f22] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
  >
    <option value="">— Не назначено —</option>
    {(miniEmbeds || []).map(me => (
      <option key={me.id} value={me.id}>{me.name || me.title || me.id}</option>
    ))}
  </select>
</div>

 </div>

 <div className="flex gap-2 pt-2">
 <button
 type="button"
 className="px-3 py-2 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-sm text-white focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => {
 const newField = {
 id: `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
 type: 'single',
 label: 'Однострочное поле',
 placeholder: 'Введите текст',
 };
 setModals(prev => prev.map(m => {
 if (m.id !== activeModalId) return m;
 const fields = Array.isArray(m.fields) ? m.fields.slice() : [];
 fields.push(newField);
 return { ...m, fields };
 }));
 }}
 >
 Однострочное поле
 </button>
 <button
 type="button"
 className="px-3 py-2 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-sm text-white focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => {
 const newField = {
 id: `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
 type: 'multiline',
 label: 'Многострочное поле',
 placeholder: 'Введите текст...',
 rows: 4,
 };
 setModals(prev => prev.map(m => {
 if (m.id !== activeModalId) return m;
 const fields = Array.isArray(m.fields) ? m.fields.slice() : [];
 fields.push(newField);
 return { ...m, fields };
 }));
 }}
 >
 Многострочное поле
 </button>
 </div>

 {/* Список полей текущего окна */}
 <div className="space-y-3 pt-3">
 {((modals.find(m => m.id === activeModalId)?.fields) ?? []).length === 0 ? (
 <div className="text-xs text-white/50">Поля ещё не добавлены</div>
 ) : (
 (modals.find(m => m.id === activeModalId)?.fields ?? []).map((f) => (
 <div key={f.id} className="rounded-lg border border-[#2a2c30] bg-[#1e1f22] p-3 space-y-3">
 <div className="flex items-center justify-between">
 <div className="text-sm font-medium">
 {f.label || (f.type === 'multiline' ? 'Многострочное поле' : 'Однострочное поле')}
 </div>
 <button
 type="button"
 className="text-xs px-2 py-1 rounded-md bg-[#4f535c] hover:bg-[#5d6269] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => {
 setModals(prev => prev.map(m => {
 if (m.id !== activeModalId) return m;
 const fields = (m.fields || []).filter(x => x.id !== f.id);
 return { ...m, fields };
 }));
 }}
 >
 Удалить
 </button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs text-white/70">Название поля</label>
 <input
 type="text"
 value={f.label || ""}
 onChange={(e) => {
 const v = e.target.value;
 setModals(prev => prev.map(m => {
 if (m.id !== activeModalId) return m;
 const fields = (m.fields || []).map(x => x.id === f.id ? { ...x, label: v } : x);
 return { ...m, fields };
 }));
 }}
 placeholder="Название поля"
 className="w-full px-3 py-2 rounded-md bg-[#111214] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs text-white/70">Плейсхолдер</label>
 <input
 type="text"
 value={f.placeholder || ""}
 onChange={(e) => {
 const v = e.target.value;
 setModals(prev => prev.map(m => {
 if (m.id !== activeModalId) return m;
 const fields = (m.fields || []).map(x => x.id === f.id ? { ...x, placeholder: v } : x);
 return { ...m, fields };
 }));
 }}
 placeholder="Плейсхолдер"
 className="w-full px-3 py-2 rounded-md bg-[#111214] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 />
 </div>
 </div>
 </div>
 ))
 )}
 </div>

 <div className="flex justify-end gap-2 pt-2">
 <button type="button" onClick={() => {
  if (previewMode || modalMode === 'view') {
    const mid = (modals.find(m => m.id === activeModalId)?.submitLinkToMiniEmbedId) || "";
    setModalMode(null);
    if (mid) { try { handleOpenMiniEmbed?.(mid); } catch (e) {} }
  } else {
    setModalMode(null);
  }
}} className={`px-3 py-2 rounded-md ${(previewMode || modalMode === 'view') ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white' : 'bg-[#4f535c] hover:bg-[#5d6269] text-white/90'} text-sm`}>
 {(previewMode || modalMode === 'view') ? 'Отправить' : 'Закрыть'}
 </button>
 </div>
</form>) : (
<div className="space-y-4 w-full">
 {/* Header with avatar and title */}
 <div className="flex items-center gap-3">
 {RUSTIFY_BOT_AVATAR_URL ? (
 <img src={RUSTIFY_BOT_AVATAR_URL} alt="Rustify" className="w-8 h-8 rounded-full object-cover" />
 ) : (
 <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center font-semibold">R</div>
 )}
 <div className="text-xl font-semibold truncate">{(modals.find(m => m.id === activeModalId)?.title) || "Предпросмотр"}</div>
 </div>

 {/* Disclaimer */}
 <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-400/40 bg-orange-500/10">
 <div className="mt-0.5 select-none">⚠️</div>
 <div className="text-sm text-white/90">
 Эта форма будет получена приложением RustifyBot. Не указывайте свои пароли и прочую конфиденциальную информацию.
 </div>
 </div>

 {/* Dynamic fields from settings */}
 <div className="space-y-3">
 {((modals.find(m => m.id === activeModalId)?.fields) ?? []).length === 0 ? (
 <div className="text-xs text-white/50">Поля ещё не добавлены</div>
 ) : (
 (modals.find(m => m.id === activeModalId)?.fields ?? []).map((f) => (
 <div key={f.id} className="space-y-1">
 <div className="text-sm">{f.label || (f.type === 'multiline' ? 'Многострочное поле' : 'Однострочное поле')}</div>
 {f.type === 'multiline' ? (
 <textarea
 rows={f.rows || 4}
 placeholder={f.placeholder || ''}
 className="w-full px-3 py-2 rounded-md bg-[#1e1f22] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 />
 ) : (
 <input
 type="text"
 placeholder={f.placeholder || ''}
 className="w-full px-3 py-2 rounded-md bg-[#1e1f22] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 />
 )}
 </div>
 ))
 )}
 </div>

 <div className="flex justify-end gap-2 pt-2">
 <button type="button" onClick={() => {
  if (previewMode || modalMode === 'view') {
    const mid = (modals.find(m => m.id === activeModalId)?.submitLinkToMiniEmbedId) || "";
    setModalMode(null);
    if (mid) { try { handleOpenMiniEmbed?.(mid); } catch (e) {} }
  } else {
    setModalMode(null);
  }
}} className={`px-3 py-2 rounded-md ${(previewMode || modalMode === 'view') ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white' : 'bg-[#4f535c] hover:bg-[#5d6269] text-white/90'} text-sm`}>
 {(previewMode || modalMode === 'view') ? 'Отправить' : 'Закрыть'}
 </button>
 </div>
</div>
)}
 </Modal>
)}

 </div>
</div>
 </div>
 </div>

 {/* Control panel */}
 <div className={`w-full rounded-2xl ${colors.panelBg} border ${colors.border} shadow-lg p-4`} onClick={(e)=>e.stopPropagation()}>
 <div className="mb-3 flex items-center justify-between">
 <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Панель управления</h2>
 <div className="flex items-center gap-2 min-w-0">
 <button onClick={() => { setSaveName(currentSaveName); setShowSaveModal(true); }} className="h-9 px-4 rounded-md bg-green-600 hover:bg-green-700 text-sm font-medium disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={isRefreshing || isReadOnlyDev}>
 {isReadOnlyDev ? 'Только чтение' : (loadingStatus !== 'ready' ? 'Загрузка...' : 'Сохранить')}
 </button>
 <button onClick={() => setShowLoadModal(true)} className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={isRefreshing || isReadOnlyDev}>
 {loadingStatus !== 'ready' ? 'Загрузка...' : 'Загрузить'}
 </button>
 </div>
 </div>
 {statusMessage && <div className="text-center text-sm text-green-400 mb-2">{statusMessage}</div>}

 <div className="grid gap-3 sm:grid-cols-3 items-end">
 <div className="sm:col-span-2">
 <label className="text-xs uppercase tracking-wide opacity-70">URL изображения (для "{currentEmbed.name}")</label>
 <input
 type="text"
 value={currentEmbed.imageUrl}
 onChange={(e) => updateCurrentEmbed({ imageUrl: e.target.value })}
 placeholder="Вставьте ссылку на изображение"
 className={`mt-2 w-full rounded-xl border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`}
 />
 </div>
 <div className="sm:col-span-1 flex gap-2 flex-wrap">
 <button onClick={addMenu} className="h-9 px-4 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Меню</button>
 <button onClick={addHr} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" title="Добавить HR">HR</button>
 <button onClick={addText} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" title="Добавить текстовый блок">Текст</button>
 <button onClick={addTextWithButton} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" title="Добавить текст с кнопкой">Текст+Кнопка</button>
 <button onClick={addList} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" title="Добавить выпадающий список">Список</button>
 
 <button onClick={addFooterMenu} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" title="Добавить нижнее меню">Ниж. Меню</button>
 <button onClick={addFooterList} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" title="Добавить нижний список">Ниж. Список</button>

 </div>
 </div>

 {/* Secondary embed name field */}
 

 {/* Custom Emojis Section */}
 <div className="mt-4 pt-4 border-t border-white/10">
 <h3 className="text-sm font-semibold uppercase tracking-wide opacity-80 mb-3">Глобальные Эмодзи</h3>
 <div className="mb-3 flex items-center gap-2">
 <input
 type="text"
 value={emojiQuery}
 onChange={(e) => setEmojiQuery(e.target.value)}
 placeholder="Поиск по :name:"
 className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
 />
 {emojiQuery && (
 <button
 type="button"
 onClick={() => setEmojiQuery('')}
 className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm"
 title="Сбросить поиск"
 >
 Сброс
 </button>
 )}
 </div>

 <div className="space-y-2 mb-4 max-h-32 overflow-y-auto pr-2">
 
 {visibleEmojis.length > 0 ? visibleEmojis.map(emoji => (
 <div key={emoji.name} className="flex items-center justify-between bg-[#2B2D31] p-2 rounded-lg text-sm">
 <div className="flex items-center gap-2 min-w-0">
 <img src={emoji.url} alt={emoji.name} className="w-6 h-6 rounded shrink-0" />
 {emojiRename && emojiRename.old === emoji.name ? (
 <input
 className="w-[160px] rounded-md border border-[#202225] bg-transparent px-2 py-1 text-sm outline-none"
 value={emojiRename.value}
 onChange={(e)=>setEmojiRename(v=>({...v, value: e.target.value.replace(/[^a-z0-9_]/gi,'')}))}
 onKeyDown={(e)=>{ if(e.key==='Enter') saveRenameEmoji(); if(e.key==='Escape') cancelRenameEmoji(); }}
 autoFocus
 />
 ) : (
 <span className="font-mono text-white/90 truncate">:{emoji.name}:</span>
 )}
 </div>
 <div className="flex items-center gap-2 min-w-0">
 {emojiRename && emojiRename.old === emoji.name ? (
 <>
 <button onClick={saveRenameEmoji} className="text-xs text-green-500 hover:text-green-400 font-semibold h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Сохранить</button>
 <button onClick={cancelRenameEmoji} className="text-xs text-white/60 hover:text-white/80 h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Отмена</button>
 </>
 ) : (<><button onClick={() => startRenameEmoji(emoji.name)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">Переименовать</button>
 <button onClick={() => setEmojiIdManual(emoji.name)} className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold">ID</button></>
 )}
 <button onClick={() => deleteCustomEmoji(emoji.name)} className="text-xs text-red-500 hover:text-red-400 font-semibold">Удалить</button>
 </div>
 </div>
 )) : <p className="text-xs text-white/50">Ничего не найдено.</p>}

 </div>

 <form onSubmit={addCustomEmoji} className="grid gap-3 sm:grid-cols-3 items-end">
 <div className="sm:col-span-1">
 <label className="text-xs uppercase tracking-wide opacity-70">Название :name:</label>
 <input
 type="text"
 value={newEmojiName}
 onChange={(e) => setNewEmojiName(e.target.value.replace(/[^a-z0-9_]/gi, ''))}
 placeholder="my_emoji"
 className={`mt-2 w-full rounded-xl border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`}
 />
 </div>
 <div className="sm:col-span-1">
 <label className="text-xs uppercase tracking-wide opacity-70">URL Эмодзи</label>
 <input
 type="text"
 value={newEmojiUrl}
 onChange={(e) => setNewEmojiUrl(e.target.value)}
 placeholder="https://..."
 className={`mt-2 w-full rounded-xl border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`}
 />
 </div>
 <div className="sm:col-span-1">
 <button type="submit" className="w-full h-9 px-4 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Добавить эмодзи</button>
 </div>
 </form>
 </div>
 </div>

 {/* Modals */}
 {showSaveModal && (
 <Modal onClose={() => setShowSaveModal(false)}>
 <form className="space-y-4 w-full" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
 <h3 className="text-lg font-semibold">Сохранить проект</h3>
 <p className="text-sm text-white/70">Введите имя для вашего сохранения. Если имя уже существует, данные будут перезаписаны.</p>
 <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Имя моего проекта" className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} />
 <div className="flex justify-end gap-2">
 <button type="button" onClick={() => setShowSaveModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button>
 <button type="submit" className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button>
 </div>
 </form>
 </Modal>
 )}
 {showLoadModal && ( <Modal onClose={() => setShowLoadModal(false)}> <div className="space-y-4"> <div className="flex items-center justify-between mb-2"> <h3 className="text-lg font-semibold">Загрузить проект</h3> <button onClick={handleRefreshSaves} className="px-3 py-1 text-xs rounded-md bg-gray-600 hover:bg-gray-500 disabled:opacity-50 transition-colors focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" disabled={isRefreshing || !(db || firebaseDb) || !(userId || (firebaseAuth && firebaseAuth.currentUser))}> {isRefreshing ? 'Обновление...' : 'Обновить'} </button> </div> <div className="space-y-2 max-h-64 overflow-y-auto pr-2"> {loadingStatus === 'loading' && <p className="text-sm text-white/50">Загрузка сохранений...</p>} {loadingStatus === 'error' && <p className="text-sm text-red-400">Ошибка загрузки.</p>} {loadingStatus === 'ready' && savedStates.length > 0 ? savedStates.map(state => ( <div key={state.id} className="flex items-center justify-between bg-[#202225] p-2 rounded-lg"> <span className="text-sm">{state.id}</span> <div className="flex gap-2"> <button onClick={() => handleLoad(state)} className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700">Загрузить</button> <button onClick={() => { setShowLoadModal(false); setDeleteConfirmId(state.id); }} className="px-3 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700">Удалить</button> </div> </div> )) : null} {loadingStatus === 'ready' && savedStates.length === 0 && <p className="text-sm text-white/50">Нет сохраненных проектов.</p>} </div> <div className="flex justify-end"> <button onClick={() => setShowLoadModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">{(previewMode || modalMode === 'view') ? 'Отправить' : 'Закрыть'}</button> </div> </div> </Modal> )}
 {deleteConfirmId && ( <Modal onClose={() => setDeleteConfirmId(null)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Подтверждение</h3> <p className="text-sm text-white/70">Вы уверены, что хотите удалить проект "{deleteConfirmId}"? Это действие необратимо.</p> <div className="flex justify-end gap-2"> <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={!isReadOnlyDev ? handleDelete : (()=>setStatusMessage("Режим только чтение: удаление недоступно."))} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm" disabled={isReadOnlyDev}>Удалить</button> </div> </div> </Modal> )}
 {showNewEmbedModal && ( <Modal onClose={() => setShowNewEmbedModal(false)}> <form className="space-y-4 w-full" onSubmit={(e) => { e.preventDefault(); handleAddNewEmbed(); }}> <h3 className="text-lg font-semibold">Создать новый Embed</h3> <p className="text-sm text-white/70">Введите название для нового встраиваемого блока.</p> <input type="text" value={newEmbedName} onChange={(e) => setNewEmbedName(e.target.value)} placeholder="Название Embed'а" className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} autoFocus /> <div className="flex justify-end gap-2"> <button type="button" onClick={() => setShowNewEmbedModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button type="submit" className="px-4 py-2 rounded-md bg-[#6a8aec] hover:bg-indigo-500 text-sm h-9 flex items-center justify-center leading-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Создать</button> </div> </form> </Modal> )}
 {deletingEmbed && ( <Modal onClose={() => setDeletingEmbed(null)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Удалить Embed?</h3> <p className="text-sm text-white/70">Вы уверены, что хотите удалить эмбед "{deletingEmbed.name}"? Это действие нельзя будет отменить.</p> <div className="flex justify-end gap-2"> <button onClick={() => setDeletingEmbed(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={handleDeleteEmbed} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Удалить</button> </div> </div> </Modal> )}
 {renamingEmbed && ( <Modal onClose={() => setRenamingEmbed(null)}> <form className="space-y-4 w-full" onSubmit={(e) => { e.preventDefault(); handleRenameEmbed(e.target.elements.embedName.value); }}> <h3 className="text-lg font-semibold">Переименовать Embed</h3> <input name="embedName" type="text" defaultValue={renamingEmbed.name} className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.form.requestSubmit() }} /> <div className="flex justify-end gap-2"> <button type="button" onClick={() => setRenamingEmbed(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button type="submit" className="px-4 py-2 rounded-md bg-[#6a8aec] hover:bg-indigo-500 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button> </div> </form> </Modal> )}
 {!previewMode && currentBtn && (
 <Modal onClose={() => setEditingBtn(null)} contentClassName="w-[760px] max-w-[95vw]">
 <ButtonEditor
 initial={currentBtn.data}
 modals={modals}
 customEmojis={customEmojis}
 embeds={embeds}
 currentEmbedId={parentEmbed?.id}
 miniEmbeds={(Array.isArray(parentEmbed?.miniEmbeds) ? parentEmbed.miniEmbeds : (Array.isArray(currentEmbed?.miniEmbeds) ? currentEmbed.miniEmbeds : []))}
 onSave={(patch) => {
 modifyItems(prev => prev.map(it => {
 if (it.type !== 'buttons' || it.id !== currentBtn.blockId) return it;
 const buttons = (it.buttons || []).map(b => (b.id === currentBtn.data.id
 ? {
 ...b,
 ...patch,
 linkToEmbedId: typeof patch.linkToEmbedId === 'string' ? patch.linkToEmbedId : (b.linkToEmbedId || ''),
 linkToModalId: typeof patch.linkToModalId === 'string' ? patch.linkToModalId : (b.linkToModalId || ''),
 linkToMiniEmbedId: (typeof patch?.linkToMiniEmbedId === 'string' ? patch.linkToMiniEmbedId : (b.linkToMiniEmbedId || '')),
 }
 : b));
 return { ...it, buttons };
 }));
 setEditingBtn(null);
 }}onDelete={() => deleteButton(currentBtn.blockId, currentBtn.data.id)}
 />
 </Modal>
)}
 {!previewMode && editingHrId && ( <Modal onClose={() => setEditingHrId(null)}> <div className="space-y-4"> <h3 className="text-base font-semibold">Горизонтальная линия</h3> <p className="text-sm opacity-80">Удалить этот блок?</p> <div className="flex justify-end gap-2"> <button className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" onClick={()=>setEditingHrId(null)}>Отмена</button> <button className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0" onClick={()=>deleteHr(editingHrId)}>Удалить</button> </div> </div> </Modal> )}
 {!previewMode && currentText && ( <Modal onClose={() => setEditingTextId(null)}> <TextEditor customEmojis={customEmojis} initial={currentText} onSave={(patch) => { modifyItems(prev => prev.map((it) => it.id === currentText.id ? { ...it, ...patch } : it)); setEditingTextId(null); }} onDelete={() => deleteText(currentText.id)} /> </Modal> )}
 
 {!previewMode && currentList && (
 <Modal contentClassName="w-[760px] max-w-[95vw]" onClose={() => setEditingListId(null)}>
 <form className="space-y-4 w-full" onSubmit={(e) => {
 e.preventDefault();
 const form = e.currentTarget;
 const placeholder = form.elements.placeholder?.value || "";
 const titles = Array.from(form.querySelectorAll('[name="li_title"]')).map(i => i.value);
 const descs = Array.from(form.querySelectorAll('[name="li_desc"]')).map(i => i.value);
 const emojis = Array.from(form.querySelectorAll('[name="li_emoji"]')).map(i => i.value);
 const defs = Array.from(form.querySelectorAll('[name="li_default"]')).map(i => i.checked ? '1' : '');
 const minis = Array.from(form.querySelectorAll('[name="li_mini"]')).map(i => i.value ? ('mini:' + i.value) : '');
 const modals = Array.from(form.querySelectorAll('[name="li_modal"]')).map(i => i.value ? ('modal:' + i.value) : '');
 const items = titles.map((t, i) => {
 const action = modals[i] || minis[i] || '';
 return `${t}|${descs[i] || ''}|${emojis[i] || ''}|${defs[i] || ''}|${action}`;
 });
 modifyItems(prev => prev.map(it => it.id === currentList.id ? { ...it, listItems: items, placeholder } : it));
 setEditingListId(null);
 }}>
 <h3 className="text-base font-semibold">Выпадающий список</h3>

 <div className="space-y-2">
 <label className="text-xs uppercase tracking-wide opacity-70">Плейсхолдер</label>
 <input type="text" name="placeholder" defaultValue={currentList.placeholder || ''} className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-semibold opacity-80">Пункты</h4>
 <button type="button"
 onClick={(e) => {
 const wrap = e.currentTarget.closest('form').querySelector('#list-items-wrap');
 const div = document.createElement('div');
 div.className = '';
 div.innerHTML = `
 <div class="rounded-lg border border-[#202225] bg-[#23242a] p-3 space-y-2">
 <div class="flex items-center gap-2 min-w-0">
 <input name="li_title" type="text" placeholder="Заголовок" class="flex-1 w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none" />
 <label class="inline-flex items-center gap-2 text-xs shrink-0">
 <input name="li_default" type="checkbox" onclick="(function(el){ var form=el.closest('form'); Array.prototype.forEach.call(form.querySelectorAll('input[name=li_default]'), function(c){ if(c!==el) c.checked=false; }); })(this)" />
 По умолчанию
 </label>
 <select name="li_mini" class="rounded-md border border-[#202225] bg-transparent px-2 py-1 text-xs">
 <option value="">— мини-эмбед —</option>
 ${(Array.isArray(miniEmbeds)?miniEmbeds:[]).map(m=>`<option value="${m.id}">${m.name||("Мини "+(m.id||"").slice(-4))}</option>`).join("")}
 </select>
 <select name="li_modal" class="rounded-md border border-[#202225] bg-transparent px-2 py-1 text-xs ml-2"><option value="">— окно —</option>${(Array.isArray(modals)?modals:[]).map(m=>`<option value="${m.id}">${m.title || ("Окно "+String(m.id||"").slice(-4))}</option>`).join("")}</select>
 </div>
 <input name="li_desc" type="text" placeholder="Описание (опционально)" class="w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none" />

 
 <div class="flex items-center gap-2 min-w-0">
 <input
 name="li_emoji"
 type="text"
 placeholder="URL эмодзи"
 class="flex-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 />
 <button
 type="button"
 class="remove-item px-2 py-2 rounded-md bg-red-600 hover:bg-red-700 text-xs shrink-0"
 >
 Удалить
 </button>
 </div>
</div>
`;
 wrap.appendChild(div);
 div.querySelector('.remove-item').addEventListener('click', function(){ div.remove(); });
 }}
 className="px-3 py-1 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-xs"
 >Добавить пункт</button>
 </div>

 <div id="list-items-wrap" className="space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2">
 {
 (Array.isArray(currentList.listItems) ? currentList.listItems : []).map((raw, idx) => {
 const [t='', d='', e='', def='', action=''] = String(raw).split('|');
 let miniId = '', modalId = '';
 if (typeof action === 'string' && action) {
 action.split(',').forEach(tok => {
 tok = tok.trim();
 if (tok.startsWith('mini:')) miniId = tok.slice(5);
 if (tok.startsWith('modal:')) modalId = tok.slice(6);
 });
 }
 const isDefault = !!def;
 return (

 
 
 <div key={idx} className="rounded-lg border border-[#202225] bg-[#23242a] p-3 space-y-2">
 <div className="flex items-center gap-2 min-w-0">
 <input
 name="li_title"
 type="text"
 defaultValue={t}
 placeholder="Заголовок"
 className={`flex-1 w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`}
 />
 <label className="inline-flex items-center gap-2 text-xs shrink-0">
 <input
 name="li_default"
 type="checkbox"
 defaultChecked={isDefault}
 onChange={(ev) => {
 const form = ev.currentTarget.closest('form');
 if (!form) return;
 form.querySelectorAll('input[name="li_default"]').forEach(c => { if (c !== ev.currentTarget) c.checked = false; });
 }}
 />
 По умолчанию
 </label>

 <select name="li_mini" defaultValue={miniId} className="rounded-md border border-[#202225] bg-transparent px-2 py-1 text-xs">
 <option value="">— мини-эмбед —</option>
 {Array.isArray(miniEmbeds) && miniEmbeds.map(m => (
 <option key={m.id} value={m.id}>{m.name || ("Мини " + String(m.id||"").slice(-4))}</option>
 ))}
 </select>
<select name="li_modal" defaultValue={modalId || ""} className="rounded-md border border-[#202225] bg-transparent px-2 py-1 text-xs ml-2"><option value="">— окно —</option>{Array.isArray(modals) && modals.map(m => (<option key={m.id} value={m.id}>{m.title || ("Окно " + String(m.id || "").slice(-4))}</option>))}</select> </div>
 <input
 name="li_desc"
 type="text"
 defaultValue={d}
 placeholder="Описание (опционально)"
 className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`}
 />
 <div className="flex items-center gap-2 min-w-0">
 <input
 name="li_emoji"
 type="text"
 defaultValue={e}
 placeholder="URL эмодзи"
 className={`flex-1 w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`}
 />
 <button
 type="button"
 onClick={(ev) => { const node = ev.currentTarget.closest('.rounded-lg.border'); node && node.remove(); }}
 className="px-2 py-2 rounded-md bg-red-600 hover:bg-red-700 text-xs shrink-0"
 >
 Удалить
 </button>
 </div>
 </div>
 );
 })
 }
 </div>
 </div>

 
 {/* Список загруженных эмодзи (галерея) */}
 <div className="mt-3">
 <div
 className="no-scrollbar overflow-x-auto whitespace-nowrap flex items-center gap-2 py-2 px-2 rounded-xl border border-white/10"
 style={{ overscrollBehavior: "contain", scrollbarWidth: "none", msOverflowStyle: "none" }}
 onWheel={(e)=>{ const el = e.currentTarget; if(!el) return; const dx = Math.abs(e.deltaX); const dy = Math.abs(e.deltaY); const delta = dy >= dx ? e.deltaY : e.deltaX; el.scrollLeft += delta * 3; }}
 >
 {Array.isArray(customEmojis) && customEmojis.length > 0 ? (
 customEmojis.map((emoji) => {
 let srcUrl = (emoji && (emoji.url || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
 if (!srcUrl) return null;
 return (
 <img
 key={emoji.name || srcUrl}
 src={srcUrl}
 alt={emoji.name || 'emoji'}
 className="h-6 w-6 rounded cursor-pointer hover:opacity-75 transition"
 title={emoji.name || ''}
 onClick={() => {
 const link = srcUrl;
 if (!link) return;
 if (navigator.clipboard && navigator.clipboard.writeText) {
 navigator.clipboard.writeText(link).then(()=>{ if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована'); });
 } else {
 try {
 const tmp = document.createElement('textarea'); tmp.value = link; document.body.appendChild(tmp);
 tmp.select(); document.execCommand('copy'); document.body.removeChild(tmp);
 if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована');
 } catch {}
 }
 }}
 />
 );
 })
 ) : (
 <span className="opacity-60 text-sm">Эмодзи ещё не добавлены</span>
 )}
 </div>
 </div>
<div className="flex items-center justify-between pt-2">
 <button type="button" onClick={() => deleteList(currentList.id)} className="px-3 py-2 rounded-md bg-red-700 hover:bg-red-600 text-sm">Удалить блок</button>
 <div className="flex gap-2">
 <button type="button" onClick={() => setEditingListId(null)} className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button>
 <button type="submit" className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button>
 </div>
 </div>
 
 
 </form>
 </Modal>
 )}
{!previewMode && currentTextWithButton && ( <Modal onClose={() => setEditingTextWithButtonId(null)}> <TextWithButtonEditor modals={modals} initial={currentTextWithButton} onSave={(patch) => { modifyItems(prev => prev.map((it) => it.id === currentTextWithButton.id ? { ...it, ...patch } : it)); setEditingTextWithButtonId(null); }} onDelete={() => deleteTextWithButton(currentTextWithButton.id)} embeds={embeds} currentEmbedId={parentEmbed?.id} customEmojis={customEmojis} /></Modal> )}
 </div>
 
 </AuthUiContext.Provider>
);
}
function MessageRow({ colors, children, footer }) {
 return (
 <div className="w-full">
 {/* Центрируем всю связку: аватарка + контентная колонка */}
 <div className="flex justify-center py-6">
 <div className="flex items-start gap-3">
 {/* Аватар */}
 <div
 className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-bold"
 style={{ backgroundColor: "#93d36f", color: "#2B2D31" }}
 >
 R
 </div>

 {/* Контентная колонка фиксированной ширины */}
 <div className="min-w-0" style={{ width: "680px", maxWidth: "680px" }}>
 {/* Имя + время в одну линию, как в Discord */}
 <div className="mb-2 text-sm">
 <span style={{ color: "#93d36f", fontWeight: 500 }}>Rustify</span>{" "}
 <span className="opacity-50">Сегодня в 12:34</span>
 </div>

 {/* Сам эмбед под шапкой */}
 <div className="relative">
 <div
 className={`absolute left-0 top-0 bottom-0 w-1 rounded-tl-[8px] rounded-bl-[8px] bg-[#424249]`}
 />
 <div
 className={`ml-1 rounded-tr-[8px] rounded-br-[8px] bg-[#2B2D31] border border-[#202225]`}
 >
 <div className="pb-4 pt-3 px-4 w-full">{children}</div>
 </div>
 </div>
 {footer}

 </div>
 </div>
 </div>
 </div>
 );
}

function EmbedSidebar({ embeds, activeEmbedId, setActiveEmbedId, onSelectParent, remoteEmbedStatuses = {},
 onDeleteClick,
 onReorder,
 onRenameClick,
 onCreateMain,
 onCreateSecondary,
 onChangeParent,
 onRename,
}) {
 // --- Settings modal state ---
 const [settingsOpen, setSettingsOpen] = React.useState(false);
 const [settingsNode, setSettingsNode] = React.useState(null);
 const openSettings = (node) => { setSettingsNode(node); setSettingsOpen(true); };
 const closeSettings = () => { setSettingsOpen(false); setSettingsNode(null); };

 const flatIndexOf = React.useCallback((id) => embeds.findIndex(e => e.id === id), [embeds]);

 const roots = React.useMemo(() => embeds.filter(e => !e.parentId), [embeds]);
 const childrenOf = React.useCallback((pid) => embeds.filter(e => e.parentId === pid), [embeds]);

 
 // Helpers to compute a safe list of potential parents (avoid cycles)
 const buildDescendantsSet = React.useCallback((rootId) => {
 const set = new Set([rootId]);
 const stack = [rootId];
 while (stack.length) {
 const id = stack.pop();
 for (const e of embeds) {
 if (e.parentId === id && !set.has(e.id)) {
 set.add(e.id);
 stack.push(e.id);
 }
 }
 }
 return set;
 }, [embeds]);

 const parentOptions = React.useMemo(() => {
 if (!settingsNode) return [];
 const banned = buildDescendantsSet(settingsNode.id);
 return embeds.filter(e => !banned.has(e.id));
 }, [embeds, settingsNode, buildDescendantsSet]);

 const handleChangeParent = (newParentId) => {
 if (!settingsNode) return;
 if (typeof onChangeParent === 'function') {
 onChangeParent(settingsNode.id, newParentId || null);
 } else {
 
 }
 // Optimistically update local modal state to reflect selection
 setSettingsNode({ ...settingsNode, parentId: newParentId || null });
 };

 const Node = React.useCallback(function Node({ node, depth }) {
 const kids = childrenOf(node.id);
 const isActive = activeEmbedId === node.id;

 return (
 <li key={node.id}>
 <div
 className="flex items-center gap-1 group"
 onContextMenu={(e) => { e.preventDefault(); openSettings(node); }}
 >
 <button
 onClick={() => { if (typeof onSelectParent === "function") { onSelectParent(node.id); } else { setActiveEmbedId && setActiveEmbedId(node.id); } }}
 onDoubleClick={() => openSettings(node)}
 className={`flex-1 text-left px-3 py-1.5 rounded-md border border-[#202225] transition ${
 isActive ? 'bg-[#5865F2] text-white' : 'bg-[#3a3c41] text-white/80 hover:bg-[#4a4e55]'
 }`}
 title={(node.name || 'Без названия') + ' — ПКМ для настроек'}
 style={{
  marginLeft: depth ? 4 : 0,
  backgroundImage: !isActive && isDoneStatus(remoteEmbedStatuses?.[node.id] ?? node?.status)
    ? 'linear-gradient(to right, #9ec07066, transparent)'
    : (!isActive && isInProgressStatus(remoteEmbedStatuses?.[node.id] ?? node?.status)
        ? 'linear-gradient(to right, #ff923166, transparent)'
        : undefined)
}}
 >
 {node.name || 'Без названия'}
 </button>
 </div>
 {kids.length > 0 && (
 <ul className="mt-1 ml-4 space-y-1">
 {kids.map((k) => <Node key={k.id} node={k} depth={depth + 1} />)}
 </ul>
 )}
 </li>
 );
 }, [activeEmbedId, childrenOf]);

 return (
 <aside className="w-[310px] shrink-0 overflow-x-hidden">
 <div className="rounded-xl border border-[#202225] bg-[#2b2d31] p-2 flex flex-col max-h-[calc(100vh-140px)]">
 <div className="text-xs uppercase tracking-wide opacity-70 px-2 py-1">Эмбеды</div>
 <div className="mt-1 overflow-y-auto overflow-x-hidden pr-1">
 <ul className="space-y-1">
 {roots.map((r) => <Node key={r.id} node={r} depth={0} />)}
 </ul>
 </div>

 <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-1 gap-2">
 <button
 onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateMain && onCreateMain(); }}
 className="h-9 px-3 rounded-md bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 text-sm font-medium"
 title="Создать основной эмбед"
 >
 Новый Embed
 </button>
 <button
 onClick={onCreateSecondary}
 className="h-9 px-3 rounded-md bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 text-sm font-medium focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 title="Создать дочерний эмбед текущего"
 >
 Дочерний Embed
 </button>
 </div>
 </div>

 {/* Settings Modal */}
 {settingsOpen && settingsNode && (
 <div className="fixed inset-0 z-50 flex items-center justify-center">
 <div className="absolute inset-0 bg-black/60" onClick={closeSettings} />
 <div className="relative z-10 w-[460px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-[#202225] p-5 shadow-2xl">
 <div className="flex items-center justify-between mb-3">
 <div className="text-base font-medium text-white">Настройки эмбеда</div>
</div>

 <div className="grid grid-cols-2 gap-2 mt-3">

 <div className="col-span-2 space-y-1">
 <div className="text-xs text-white/60">Название эмбеда</div>
 <input
 className="w-full h-9 rounded-md bg-[#3a3c41] text-white/90 px-3 outline-none focus:ring-2 focus:ring-[#5865F2]/40"
 type="text"
 value={settingsNode?.name || ""}
 onChange={(e)=>{ if (typeof onRename === 'function') onRename(settingsNode.id, e.target.value); setSettingsNode({ ...(settingsNode||{}), name: e.target.value }); }}
 placeholder="Введите название"
 />
 </div>

 {/* Изменить родителя (только для дочерних эмбедов) */}
 {settingsNode && (
 <div className="col-span-2 space-y-1">
 <div className="text-xs text-white/60">Родительский эмбед</div>
 <select
 className="w-full h-9 rounded-md bg-[#3a3c41] text-white/90 px-3 appearance-none pr-8"
 style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><path fill=\'white\' d=\'M7 10l5 5 5-5\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
 value={settingsNode.parentId || ""}
 onChange={(e)=>{ handleChangeParent(e.target.value); }}
 >
 <option value="">— Нет (сделать основным) —</option>
 {parentOptions.map(p => (
 <option key={p.id} value={p.id}>{p.name || 'Без названия'}</option>
 ))}
 </select>
 <div className="text-[11px] text-white/50 mt-1">Изменения применяются сразу</div>
 </div>
 )}

 <button
 className="h-8 rounded-md px-2 text-sm flex items-center justify-center leading-none bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => {
 const siblings = embeds.filter(e => (e.parentId || null) === (settingsNode.parentId || null));
 const pos = siblings.findIndex(e => e.id === settingsNode.id);
 if (pos <= 0) return;
 const from = flatIndexOf(settingsNode.id);
 const to = flatIndexOf(siblings[pos - 1].id);
 if (from !== -1 && to !== -1 && onReorder) onReorder(from, to);
 }}
 title="Переместить вверх"
 disabled={(embeds.filter(e => (e.parentId || null) === (settingsNode.parentId || null)).findIndex(e => e.id === settingsNode.id)) <= 0}
>▲</button>
 <button
 className="h-8 rounded-md px-2 text-sm flex items-center justify-center leading-none bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => {
 const siblings = embeds.filter(e => (e.parentId || null) === (settingsNode.parentId || null));
 const pos = siblings.findIndex(e => e.id === settingsNode.id);
 if (pos < 0 || pos >= siblings.length - 1) return;
 const from = flatIndexOf(settingsNode.id);
 const to = flatIndexOf(siblings[pos + 1].id);
 if (from !== -1 && to !== -1 && onReorder) onReorder(from, to);
 }}
 title="Переместить вниз"
 disabled={(function(){ const s=embeds.filter(e => (e.parentId || null) === (settingsNode.parentId || null)); const p=s.findIndex(e=>e.id===settingsNode.id); return (p < 0 || p >= s.length - 1); })()}
>▼</button>

 <button
 className="h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white col-span-2 flex items-center justify-center leading-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 onClick={() => { onDeleteClick && onDeleteClick(settingsNode); closeSettings(); }}
 >Удалить эмбед</button>
 </div>
 </div>
 </div>
 )}
 </aside>
 );
}
function EmbedCanvas({colors, items, customEmojis, selectedBlockId, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingBtn, setEditingHrId, setEditingTextId, setEditingTextWithButtonId, setEditingListId, previewMode, onAddButton, onReorderButtons, onEmbedLinkClick , onModalLinkClick, onMiniEmbedLinkClick, onMoveBlock, imgBust, isSelectingComment, workAreaRef, onImageCommentCreate, onBlockOrButtonCommentCreate }){
 const [highlightedButtonId, setHighlightedButtonId] = React.useState(null);
 const [hoverBlockId, setHoverBlockId] = React.useState(null);

return (
 <div className="w-full">
 {items.map((it, idx) => {
 if (!it) return null;

 const isSelected = !previewMode && selectedBlockId === it.id;
 const canUp = idx > 0;
 const canDown = idx < (items.length - 1);

 const overlay = isSelected ? (
 <div
 className="absolute -left-9 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-40"
 onClick={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 >
 <button
 type="button"
 title="Переместить вверх"
 disabled={!canUp}
 onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMoveBlock && onMoveBlock(it.id, -1); }}
 className="w-7 h-7 rounded-md border border-[#202225] bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
 >
 ▲
 </button>
 <button
 type="button"
 title="Переместить вниз"
 disabled={!canDown}
 onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMoveBlock && onMoveBlock(it.id, +1); }}
 className="w-7 h-7 rounded-md border border-[#202225] bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
 >
 ▼
 </button>
 </div>
 ) : null;

 switch (it.type) {
 case "image":
 return (
 <div data-item-id={it.id} key={(it.id) + "|" + String(imgBust)}
 draggable={!previewMode}
 onDragStart={onDragStart(idx)}
 onDragOver={onDragOver(idx)}
 onDrop={onDrop(idx)}
 onDragEnd={onDragEnd}
 className={`${(previewMode && isSelectingComment) ? ' hover:ring-2 hover:ring-[#9ec070] cursor-crosshair ' : ''} relative w-full overflow-hidden rounded-[8px] select-none ${isSelected ? 'ring-2 ring-indigo-500/70' : ''} ${idx > 0 ? 'mt-3' : ''}`}
 onClick={(e) => {
 if (previewMode && isSelectingComment) {
 const host = e.currentTarget.closest('[data-work-area]');
 if (!host) return;
 const hostRc = host.getBoundingClientRect();
 const r = e.currentTarget.getBoundingClientRect();
 // relative to the image itself
 const imgLeft = r.left - hostRc.left;
 const imgTop = r.top - hostRc.top;
const x = Math.max(0, r.left - hostRc.left);
 const y = Math.max(0, r.top - hostRc.top);
 const w = Math.max(1, Math.min(r.width, hostRc.width - x));
 const h = Math.max(1, Math.min(r.height, hostRc.height - y));
 
 const xPct = (x - imgLeft) / Math.max(1, r.width);
 const yPct = (y - imgTop) / Math.max(1, r.height);
 const wPct = w / Math.max(1, r.width);
 const hPct = h / Math.max(1, r.height);
 onImageCommentCreate({ x, y, w, h, itemId: it.id, rel: { xPct, yPct, wPct, hPct } }); e.stopPropagation(); return;
 }
 if (!previewMode) setSelectedBlockId(it.id);
 }}
 style={{ cursor: previewMode ? 'default' : 'grab' }}
 >
 {overlay}
 <img src={withCacheBust((it.url), imgBust)} alt="Embed media" className="block w-full h-auto" style={{ objectFit: 'contain', objectPosition: 'center' }} draggable={false} />
 {!previewMode && (
 <div className="absolute inset-0 pointer-events-none rounded-[8px]" style={{ outline: (isSelected ? '2px solid rgba(99,102,241,0.7)' : 'none') }} />
 )}
 </div>
 );
 case "buttons":
 return (
 <div data-item-id={it.id} key={it.id} className="relative"  onClickCapture={(e)=>{
      if (previewMode && isSelectingComment) {
        const targetBtn = (typeof highlightedButtonId !== 'undefined' && highlightedButtonId) ? String(highlightedButtonId) : null;

        onBlockOrButtonCommentCreate && onBlockOrButtonCommentCreate({ blockId: it.id, buttonId: targetBtn });
        if (typeof setHighlightedButtonId === 'function') setHighlightedButtonId(null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!previewMode) setSelectedBlockId(it.id);
    }} onMouseEnter={() => { setHoverBlockId(it.id); if (previewMode && isSelectingComment) { } }} onMouseLeave={() => { setHoverBlockId(null); setHighlightedButtonId && setHighlightedButtonId(null); if (previewMode && isSelectingComment) { } }}>
 {/* hover handlers for comment selection */}

 {overlay}
 {(previewMode && isSelectingComment && hoverBlockId === it.id && !highlightedButtonId) && (
 <div className="absolute inset-0 pointer-events-none rounded-[8px]" style={{ outline: "2px solid rgba(148,219,107,0.8)" }} />
 )}
 <ButtonsBlock
 idx={idx}
 block={it}
 colors={colors}
 selected={isSelected}
 setSelectedBlockId={setSelectedBlockId}
 onDragStart={onDragStart}
 onDragOver={onDragOver}
 onDrop={onDrop}
 onDragEnd={onDragEnd}
 setEditingBtn={setEditingBtn}
 previewMode={previewMode}
 isSelectingComment={isSelectingComment}
 highlightedButtonId={highlightedButtonId}
 setHighlightedButtonId={setHighlightedButtonId}
 onAddButton={onAddButton}
 onReorderButtons={onReorderButtons} onMiniEmbedLinkClick={onMiniEmbedLinkClick}
 onEmbedLinkClick={onEmbedLinkClick} onModalLinkClick={(id)=>{ window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id}})); }}
 />
 </div>
 );
 case "text":
 return (
 <div key={it.id} className="relative onClickCapture={(e)=>{ if (previewMode && isSelectingComment) {            onBlockOrButtonCommentCreate?.({ blockId: it.id }); e.preventDefault(); e.stopPropagation(); } }}">
 {overlay}
 <TextBlock
 idx={idx}
 block={it}
 colors={colors}
 customEmojis={customEmojis}
 selected={isSelected}
 setSelectedBlockId={setSelectedBlockId}
 onDragStart={onDragStart}
 onDragOver={onDragOver}
 onDrop={onDrop}
 onDragEnd={onDragEnd}
 setEditingTextId={(id)=>{ if (selectedBlockId===id){ setEditingTextId(id); } else { setSelectedBlockId(id); } }}
 previewMode={previewMode}
 />
 </div>
 );
 case "text-with-button":
 return (
 <div key={it.id} className="relative onClickCapture={(e)=>{ if (previewMode && isSelectingComment) {            onBlockOrButtonCommentCreate?.({ blockId: it.id }); e.preventDefault(); e.stopPropagation(); } }}">
 {overlay}
 <TextWithButtonBlock
 idx={idx}
 block={it}
 colors={colors}
 customEmojis={customEmojis}
 selected={isSelected}
 setSelectedBlockId={setSelectedBlockId}
 onDragStart={onDragStart}
 onDragOver={onDragOver}
 onDrop={onDrop}
 onDragEnd={onDragEnd}
 setEditingTextWithButtonId={(id)=>{ if (selectedBlockId===id){ setEditingTextWithButtonId(id); } else { setSelectedBlockId(id); } }}
 previewMode={previewMode}
 onEmbedLinkClick={onEmbedLinkClick}
 onMiniEmbedLinkClick={onMiniEmbedLinkClick}
 onModalLinkClick={(id)=>{ window.dispatchEvent(new CustomEvent('openEmbedModal', { detail: { id } })); }}
 />
 </div>
 );
 case "list":
 return (
 <div key={it.id} data-item-id={it.id} className="relative"
 onClick={(e)=>{ if(!previewMode){ e.preventDefault(); e.stopPropagation(); setSelectedBlockId(it.id); setEditingListId(it.id);} }}>
 {overlay}
 <ListBlock
 idx={idx}
 block={it}
 colors={colors}
 selected={isSelected}
 setSelectedBlockId={setSelectedBlockId}
 onDragStart={onDragStart}
 onDragOver={onDragOver}
 onDrop={onDrop}
 onDragEnd={onDragEnd}
 setEditingListId={setEditingListId}
 previewMode={previewMode} onMiniEmbedLinkClick={onMiniEmbedLinkClick}
 />
 </div>
 );
case "hr":
 return (
 <div key={it.id} className="relative">
 {overlay}
 <HRBlock
 idx={idx}
 id={it.id}
 colors={colors}
 selected={isSelected}
 setSelectedBlockId={setSelectedBlockId}
 onDragStart={onDragStart}
 onDragOver={onDragOver}
 onDrop={onDrop}
 onDragEnd={onDragEnd}
 setEditingHrId={setEditingHrId}
 previewMode={previewMode}
 />
 </div>
 );
 default:
 return null;
 }
 })}
 </div>
);

}

function ButtonsBlock({ idx, block, colors, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingBtn, previewMode, onAddButton, onReorderButtons, onEmbedLinkClick, onModalLinkClick, onMiniEmbedLinkClick , isSelectingComment, highlightedButtonId, setHighlightedButtonId, onBlockOrButtonCommentCreate }) {
 const buttons = Array.isArray(block.buttons) ? block.buttons : [];
 const [btnDragIndex, setBtnDragIndex] = React.useState(null);
 const [btnOverIndex, setBtnOverIndex] = React.useState(null);

 
const handleClickWith = (btn) => (e) => {
 e.stopPropagation();
 const modalId = typeof btn?.linkToModalId === 'string' ? btn.linkToModalId : '';
 const embedId = typeof btn?.linkToEmbedId === 'string' ? btn.linkToEmbedId : '';
 const miniId = typeof btn?.linkToMiniEmbedId === 'string' ? btn.linkToMiniEmbedId : '';

 if (e && e.ctrlKey) {
 if (miniId) { onMiniEmbedLinkClick?.(miniId); return; }
 if (modalId) { onModalLinkClick?.(modalId); window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id:modalId}})); return; }
 if (embedId) { onEmbedLinkClick?.(embedId); return; }
 return;
 }

 if (previewMode) {
 if (miniId) { onMiniEmbedLinkClick?.(miniId); return; }
 if (modalId) { onModalLinkClick?.(modalId); window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id:modalId}})); return; }
 if (embedId) { onEmbedLinkClick?.(embedId); return; }
 return;
 }

 onEdit?.();
};
const handleBtnDragStart = (bi) => (e) => { if (previewMode) return; e.stopPropagation(); setBtnDragIndex(bi); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(bi)); };
 const handleBtnDragOver = (bi) => (e) => { if (previewMode) return; e.preventDefault(); e.stopPropagation(); setBtnOverIndex(bi); };
 const handleBtnDrop = (bi) => (e) => { if (previewMode) return; e.preventDefault(); e.stopPropagation(); const from = btnDragIndex; const to = bi; setBtnDragIndex(null); setBtnOverIndex(null); if (from === null || to === null || from === to) return; onReorderButtons?.(block.id, from, to); };
 const handleBtnDragEnd = () => { setBtnDragIndex(null); setBtnOverIndex(null); };
 return ( <div data-item-id={block.id} draggable={!previewMode} onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} onDragEnd={onDragEnd} className={`mt-3 rounded-md ${selected? 'ring-2 ring-indigo-500/70' : ''} bg-transparent`} onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(block.id); } }} style={{ cursor: previewMode ? 'default' : 'grab' }} > <div className="flex flex-wrap items-center gap-2"> {buttons.map((b, bi) => ( <div onMouseEnter={() => { if (previewMode && isSelectingComment) { setHighlightedButtonId(b.id || `btn-${bi}`); } }} onMouseLeave={() => { if (previewMode && isSelectingComment) { setHighlightedButtonId(null); } }} key={b?.id || bi} draggable={!previewMode} onDragStart={handleBtnDragStart(bi)} onDragOver={handleBtnDragOver(bi)} onDrop={handleBtnDrop(bi)} onDragEnd={handleBtnDragEnd} onClick={(e)=>e.stopPropagation()} className={`${btnOverIndex===bi && btnDragIndex!==null ? 'outline outline-2 outline-indigo-500/60 rounded-md' : ''}`} style={{ cursor: previewMode ? 'default' : 'grab' }} > <ButtonChip btn={b} hoveringForComment={(previewMode && isSelectingComment && highlightedButtonId === (b.id || idx))} colors={colors} onEdit={() => setEditingBtn({ blockId: block.id, btnId: b?.id })} previewMode={previewMode} onMiniEmbedLinkClick={onMiniEmbedLinkClick} onEmbedLinkClick={onEmbedLinkClick} onModalLinkClick={onModalLinkClick} /> </div> ))} {!previewMode && selected && (<button type="button" onClick={() => onAddButton?.(block.id)} className="h-9 px-3 rounded-md border border-dashed border-white/20 text-xs text-white/70 hover:text-white hover:border-white/40" title="Добавить кнопку" > <span className="inline-flex items-center gap-1"> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/> </svg> Добавить </span> </button> )} </div> </div> );
}

function HRBlock({ idx, id, colors, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingHrId, previewMode }) {
 return (
 <div
 draggable={!previewMode}
 onDragStart={onDragStart(idx)}
 onDragOver={onDragOver(idx)}
 onDrop={onDrop(idx)}
 onDragEnd={onDragEnd}
 className={`mt-3 ${selected ? 'ring-2 ring-indigo-500/70' : ''}`}
 onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(id); setEditingHrId && setEditingHrId(id); } }}
 style={{ cursor: previewMode ? 'default' : 'grab' }}
 >
 <div className="relative">
 <div className="h-[1px] bg-[#3a3c41]" />
 </div>
 </div>
 );
}

function ListBlock({ idx, block, colors, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingListId, previewMode, onMiniEmbedLinkClick }) {
 const [open, setOpen] = React.useState(false);
 const parse = (s) => {
 if (typeof s !== 'string') return { title: String(s), desc: '', emoji: '' };
 const parts = s.split('|');
 const selRaw = (parts[3]||'').trim().toLowerCase();
 const sel = selRaw === '1' || selRaw === 'true' || selRaw === 'yes' || selRaw === '*';
 const linkRaw = (parts[4]||'').trim();
 let miniId = '', modalId = '';
 if (linkRaw) {
 linkRaw.split(',').forEach(tok => {
 tok = tok.trim();
 if (tok.startsWith('mini:')) miniId = tok.slice(5);
 if (tok.startsWith('modal:')) modalId = tok.slice(6);
 });
 }
 return { title: (parts[0]||'').trim(), desc: (parts[1]||'').trim(), emoji: (parts[2]||'').trim(), sel, miniId, modalId };
 };
 const items = Array.isArray(block.listItems) ? block.listItems : [];
 const placeholder = block.placeholder || "Выберите вариант";
 return (
 <div
 data-item-id={block.id} draggable={!previewMode && true}
 onDragStart={onDragStart(idx)}
 onDragOver={onDragOver(idx)}
 onDrop={onDrop(idx)}
 onDragEnd={onDragEnd}
 className={`mt-3 ${selected ? 'ring-2 ring-indigo-500/70' : ''}`}
 onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(block.id); setEditingListId && setEditingListId(block.id); } }}
 style={{ cursor: previewMode ? 'default' : 'grab' }}
 >
 <div className="w-full rounded-lg bg-[#23242a] border border-[#202225] overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3 text-sm cursor-pointer" onClick={(e)=>{ if(previewMode){ e.stopPropagation(); setOpen(o=>!o);} }}>
 <span className="opacity-80">{(() => { const def = (items || []).map(parse).find(o => o.sel); return def?.title || placeholder; })()}</span>
 <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
 <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 </div>
 <div className={`px-1 pb-2 ${(!previewMode || !open) ? "hidden" : ""}`}>
 {(() => { const parsed = (items || []).map(parse); const defIdx = parsed.findIndex(o => o.sel); const list = parsed.filter((_, i) => i !== defIdx); return list.map((o, i) => (
 <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-[#2b2d31] transition-colors" onClick={(e)=>{
 e.stopPropagation();
 if (!previewMode) return;
 const w = window;
 if (o.modalId) {
 // Try direct handler first
 let handled = false;
 try { if (typeof onModalLinkClick === 'function') { onModalLinkClick(o.modalId); handled = true; } } catch {}
 if (!handled) {
 try { w.dispatchEvent && w.dispatchEvent(new CustomEvent('openEmbedModal', { detail: { id: o.modalId } })); handled = true; } catch {}
 }
 if (!handled) {
 try { if (typeof setActiveModalId === 'function') { setActiveModalId(o.modalId); } } catch {}
 }
 return;
 }
 const id = o.miniId;
 if (!id) return;
 let handled = false;
 try { if (typeof onMiniEmbedLinkClick === 'function') { onMiniEmbedLinkClick(id); handled = true; } } catch {}
 if (!handled) {
 try { if (w.openMiniEmbed) { w.openMiniEmbed(id); handled = true; } } catch {}
 }
 if (!handled) {
 try { if (w.navigateToMiniEmbed) { w.navigateToMiniEmbed(id); handled = true; } } catch {}
 }
 if (!handled) {
 try { if (w.__open) { w.__open(id); handled = true; } } catch {}
 }
 if (!handled && w.parent && w.parent !== w) {
 try { if (w.parent.openMiniEmbed) { w.parent.openMiniEmbed(id); handled = true; } } catch {}
 try { if (!handled && w.parent.navigateToMiniEmbed) { w.parent.navigateToMiniEmbed(id); handled = true; } } catch {}
 }
 if (handled) { setOpen(false); }
 else { }
}}>
 {o.emoji ? <img src={o.emoji} alt="" className="w-4 h-4 rounded-sm shrink-0" /> : null}
 <div className="min-w-0">
 <div className="text-[14px] leading-[18px] text-white/90 truncate">{o.title || "Без названия"}</div>
 {o.desc && <div className="text-xs text-white/60 truncate">{o.desc}</div>}
 </div>
 </div>
 )); })()}
 </div>
 </div>
 </div>
 );
}
function TextBlock({ idx, block, colors, customEmojis, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingTextId, previewMode }) {
 return ( <div data-item-id={block.id} draggable={!previewMode} onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} onDragEnd={onDragEnd} className={`mt-3 rounded-md ${selected? 'ring-2 ring-indigo-500/70' : ''} bg-transparent`} onMouseDown={(e)=>{ if (!previewMode) { e.preventDefault(); e.stopPropagation(); setSelectedBlockId(block.id); setEditingTextId(block.id); } }} onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(block.id); setEditingTextId(block.id); } }} style={{ cursor: previewMode ? 'default' : 'grab' }} > <TextBlockView block={block} customEmojis={customEmojis} /></div> );
}

function TextWithButtonBlock({ idx, block, colors, customEmojis, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingTextWithButtonId, previewMode, onEmbedLinkClick, onModalLinkClick, onMiniEmbedLinkClick }) {
 // Ensure button object is always present for preview
 const safeButton = sanitizeButton(block?.button || {});

 return (
 <div data-item-id={block.id}
 draggable={!previewMode}
 onDragStart={onDragStart(idx)}
 onDragOver={onDragOver(idx)}
 onDrop={onDrop(idx)}
 onDragEnd={onDragEnd}
 className={`mt-3 rounded-md ${selected ? 'ring-2 ring-indigo-500/70' : ''} bg-transparent`}
 onClick={(e) => {
 if (!previewMode) {
 e.stopPropagation();
 setSelectedBlockId(block.id);
 setEditingTextWithButtonId(block.id); } }} onMouseDown={(e)=>{ if (!previewMode) { e.preventDefault(); e.stopPropagation(); setSelectedBlockId(block.id); setEditingTextWithButtonId(block.id); } }}
 style={{ cursor: previewMode ? 'default' : 'grab' }}
 >
 <div className="flex items-start gap-4">
 <div className="flex-1 min-w-0">
 <TextBlockView block={block} customEmojis={customEmojis} /></div>
 
<div className="flex-shrink-0 self-start">
 {previewMode ? (
 <div
 onClickCapture={(e) => { if (e.ctrlKey || e.metaKey) { return; } 
 const mid = (block?.button?.linkToMiniEmbedId)||"";
 const mod = (block?.button?.linkToModalId)||"";
 const eid = (block?.button?.linkToEmbedId)||"";
 if (mid) { e.preventDefault(); e.stopPropagation(); onMiniEmbedLinkClick && onMiniEmbedLinkClick(mid); return; }
 if (mod) { e.preventDefault(); e.stopPropagation(); onModalLinkClick && onModalLinkClick(mod); return; }
 if (eid) { e.preventDefault(); e.stopPropagation(); onEmbedLinkClick && onEmbedLinkClick(eid); return; }
 }}
 >
 <ButtonChip btn={safeButton} colors={colors} previewMode={previewMode} onMiniEmbedLinkClick={onMiniEmbedLinkClick} onEmbedLinkClick={onEmbedLinkClick} onModalLinkClick={onModalLinkClick} />
 </div>
 ) : (
 <ButtonChip btn={safeButton} colors={colors} previewMode={previewMode} onMiniEmbedLinkClick={onMiniEmbedLinkClick} onEmbedLinkClick={onEmbedLinkClick} onModalLinkClick={onModalLinkClick} />
 )}
</div>
 </div>
 </div>
 );
}

function TextBlockView({ block, customEmojis = [] }) {
 const html = useMemo(() => {
 // 1) Base content
 let processed = typeof block?.content === 'string' ? block.content : '';

 // 2) Replace :emoji: with <img> inline — do NOT break lines
 if (Array.isArray(customEmojis) && customEmojis.length) {
 const map = new Map(customEmojis.map(e => [e.name, e.url]));
 processed = processed.replace(/:(\w+):/g, (m, name) => {
 if (map.has(name)) {
 const url = map.get(name);
 return `<img src="${url}" alt=":${name}:" class="inline-block h-5 w-5 align-middle mx-px my-0" />`;
 }
 return m;
 });
 }

 // 3) Discord-like subtext lines starting with "-#" (with or without a space)
 // Use a sentinel that won't be caught by :emoji: regex
 processed = processed.split('\n').map(line => {
 if (/^\-#(?=\s|:|\b)/.test(line)) {
 return line.replace(/^\-#\s*/, '<!--dc-subtext--> ');
 }
 return line;
 }).join('\n');

 // 4) Markdown -> HTML
 let md = marked.parse(processed, { gfm: true, breaks: true, headerIds: false, mangle: false });
 // Post-process subtext token -> add class to paragraph content
 md = md.replace(/<p data-item-id={`${block.id}::p-0`} data-commentable="1"><!--dc-subtext-->\s*((?:<img[^>]*>\s*)*)([\s\S]*?)<\/p>/g,
 (_m, imgs, text) => `<p>${imgs}<span class="dc-subtext">${text}</span></p>`);

 // 5) Sanitize
 return DOMPurify.sanitize(md, { ADD_TAGS: ['img'], ADD_ATTR: ['class', 'style', 'alt', 'src'] });
 }, [block?.content, customEmojis]);

 const hasThumb = Boolean(block?.thumbUrl);

 return (<div className="flex items-start gap-3">
 <div
 className="flex-1 max-w-none text-[14px] leading-[22px]
 [&_p]:my-[2px]
 [&_h1]:text-[21px] [&_h1]:leading-[27px] [&_h1]:font-semibold [&_h1]:my-[2px]
 [&_h2]:text-[20px] [&_h2]:leading-[27px] [&_h2]:font-semibold [&_h2]:my-[2px]
 [&_h3]:text-[19px] [&_h3]:leading-[27px] [&_h3]:font-medium [&_h3]:my-[2px]
 [&_.dc-subtext]:text-[12px] [&_.dc-subtext]:leading-[20px]
 [&_a]:text-[#93d36f] hover:[&_a]:underline
 [&_code]:bg-[#1e1f22] [&_code]:px-[4px] [&_code]:py-[2px] [&_code]:rounded-md"
 dangerouslySetInnerHTML={{ __html: html }}
 />
 {hasThumb && (
 <div className="w-[92px] h-[92px] rounded-lg overflow-hidden border border-[#202225] shrink-0" data-item-id={`${block.id}::thumb`} data-commentable="1">
 <img src={block.thumbUrl} alt="thumb" className="w-full h-full object-cover" data-item-id={`${block.id}::thumb`} data-commentable="1" />
 </div>
 )}
 </div>);
}

function ButtonChip({ btn, colors, onEdit, previewMode, onEmbedLinkClick, onModalLinkClick, onMiniEmbedLinkClick , hoveringForComment}) {
 const safeBtn = (btn && typeof btn === 'object') ? btn : {};
 const style = ['primary','success','danger','link','secondary'].includes(safeBtn.style) ? safeBtn.style : 'secondary';
 const leftEmojiUrl = typeof safeBtn.leftEmojiUrl === 'string' && safeBtn.leftEmojiUrl.trim() ? safeBtn.leftEmojiUrl : undefined;
 const rightEmojiUrl = typeof safeBtn.rightEmojiUrl === 'string' && safeBtn.rightEmojiUrl.trim() ? safeBtn.rightEmojiUrl : undefined;
 const base = `rounded-md inline-flex items-center justify-center text-sm font-medium h-9 px-4 select-none transition outline-none`;
 const visual = (style === 'primary') ? colors.primaryBtn
 : (style === 'success') ? colors.successBtn
 : (style === 'danger') ? colors.dangerBtn
 : (style === 'link') ? colors.linkBtn
 : colors.secondaryBtn;
 const inactive = safeBtn.active === false ? ' opacity-50 cursor-not-allowed' : '';
 const interactive = previewMode ? ' cursor-pointer' : ' cursor-pointer';
 const label = typeof safeBtn.label === 'string' && safeBtn.label.trim().length > 0 ? safeBtn.label : (!leftEmojiUrl && !rightEmojiUrl && style !== 'link' ? 'Кнопка' : '');
 
 const handleClick = (e) => {
 if (previewMode && btn && btn.linkToMiniEmbedId) { try { onMiniEmbedLinkClick && onMiniEmbedLinkClick(btn.linkToMiniEmbedId); } catch(_){} return; }

 // Canonical init for navigation variables
 const safeBtn = sanitizeButton(btn);
 const miniId = typeof safeBtn.linkToMiniEmbedId === 'string' ? safeBtn.linkToMiniEmbedId : '';
 const embedId = typeof safeBtn.linkToEmbedId === 'string' ? safeBtn.linkToEmbedId : '';
 const modalId = typeof safeBtn.linkToModalId === 'string' ? safeBtn.linkToModalId : '';

 // Canonical init to avoid TDZ & redeclare
 // Canonical init to avoid TDZ
 
 
 
 

 

 
 if (!previewMode && e) e.stopPropagation();
if (e && e.ctrlKey) {
 if (miniId) { onMiniEmbedLinkClick && onMiniEmbedLinkClick(miniId); return; }
 if (modalId) { onModalLinkClick && onModalLinkClick(modalId); window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id:modalId}})); return; }
 if (embedId) { onEmbedLinkClick && onEmbedLinkClick(embedId); return; }
 }
 if (previewMode) {
 if (miniId) { onMiniEmbedLinkClick && onMiniEmbedLinkClick(miniId); return; }
 if (modalId) { onModalLinkClick && onModalLinkClick(modalId); window.dispatchEvent(new CustomEvent('openEmbedModal',{detail:{id:modalId}})); return; }
 if (embedId) { onEmbedLinkClick && onEmbedLinkClick(embedId); return; }
 return;
 }
 // edit mode: open editor
 if (typeof onEdit === 'function') onEdit();
};

 return ( <div className="relative inline-block"> <button data-btn-id={safeBtn.id} className={`${base} ${visual}${inactive}${interactive}`} onClick={handleClick} onMouseDown={(e) => { if (!previewMode) e.stopPropagation(); }} type="button" > {leftEmojiUrl && <img src={leftEmojiUrl} alt="" className="h-5 w-5 mr-2" />} {label} {style === 'link' && ( <svg className="h-4 w-4 ml-2 opacity-80" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> </svg> )} {style !== 'link' && rightEmojiUrl && <img src={rightEmojiUrl} alt="" className="h-5 w-5 ml-2" />} </button> {hoveringForComment && (<div className="pointer-events-none absolute inset-0 rounded-md" style={{ border: "2px solid rgba(148,219,107,0.8)", boxShadow: "0 0 0 2px rgba(148,219,107,0.2)", zIndex: 10 }} />)} </div> );
}

function Modal({ children, onClose, contentClassName }) {
 const overlayRef = useRef(null);
 const mouseDownOnOverlay = useRef(false);
 return ( <div className="fixed inset-0 z-50 flex items-center justify-center"> <div ref={overlayRef} className="absolute inset-0 bg-black/50" onMouseDown={(e) => { if (e.target === overlayRef.current) mouseDownOnOverlay.current = true; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === overlayRef.current) { onClose?.(); } mouseDownOnOverlay.current = false; }} /> <div className={`relative ${contentClassName || "w-full max-w-md"} rounded-xl bg-[#2B2D31] border border-[#202225] p-4 shadow-xl`} onMouseDown={(e)=>e.stopPropagation()} onMouseUp={(e)=>e.stopPropagation()}> {children} </div> </div> );
}

function ButtonEditor({ initial, onSave, onDelete, embeds = [], currentEmbedId , customEmojis = [], modals = [], miniEmbeds = [] }) {
 const { isReadOnlyDev } = React.useContext(AuthUiContext);
const [label, setLabel] = useState(initial?.label || "");
 const [leftEmojiUrl, setLeftEmojiUrl] = useState(initial?.leftEmojiUrl || "");
 const [style, setStyle] = useState((['primary','success','danger','link','secondary'].includes(initial?.style) ? initial.style : 'secondary'));
 const [active, setActive] = useState(initial?.active !== false);
 const [linkToEmbedId, setLinkToEmbedId] = useState(initial?.linkToEmbedId || "");

 const [linkToModalId, setLinkToModalId] = useState(initial?.linkToModalId || "");

 const [linkToMiniEmbedId, setLinkToMiniEmbedId] = useState(initial?.linkToMiniEmbedId || "");
 // Prefer explicit miniEmbeds prop; if empty, fallback to parent's miniEmbeds (by currentEmbedId)
 const miniEmbedsLocal = (Array.isArray(miniEmbeds) && miniEmbeds.length)
   ? miniEmbeds
   : (Array.isArray(embeds) ? ((embeds.find(e => e && e.id === currentEmbedId)?.miniEmbeds) || []) : []);


 const otherEmbeds = Array.isArray(embeds) ? embeds : [];

 // ensure onSave gets full payload including linkToModalId
return (
 <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); onSave && onSave({ id: initial?.id, label, leftEmojiUrl, style, active, linkToEmbedId, linkToModalId, linkToMiniEmbedId }); }}>
 <h3 className="text-base font-semibold">Настройки кнопки</h3> <div> <label className="text-xs uppercase tracking-wide opacity-70">Название кнопки</label> <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" /> </div>
 
 <div className="mt-2">
 <label className="text-xs uppercase tracking-wide opacity-70">Emoji слева — URL</label>
 <input
 value={leftEmojiUrl}
 onChange={(e) => setLeftEmojiUrl(e.target.value)}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 placeholder="https://..."
 />
 <div
className="no-scrollbar overflow-x-auto whitespace-nowrap flex items-center gap-2 py-2 px-2 mt-2 rounded-xl border border-white/10"
 style={{ overscrollBehavior: "contain", scrollbarWidth: "none", msOverflowStyle: "none" }}
 onWheel={(e)=>{ const el = e.currentTarget; if(!el) return; const dx = Math.abs(e.deltaX); const dy = Math.abs(e.deltaY); const delta = dy >= dx ? e.deltaY : e.deltaX; el.scrollLeft += delta * 3; }}
 >
 {Array.isArray(customEmojis) && customEmojis.length > 0 ? (
 customEmojis.map((emoji) => {
 let srcUrl = (emoji && (emoji.url || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
 if (!srcUrl) return null;
 return (
 <img
 key={emoji.name || srcUrl}
 src={srcUrl}
 alt={emoji.name || 'emoji'}
 className="h-6 w-6 rounded cursor-pointer"
 onClick={() => { setLeftEmojiUrl(srcUrl); if (window.__showToast) window.__showToast('Ссылка вставлена в текстовое поле'); }}
 title={emoji.name || ''}
 />
 );
 })
 ) : (
 <span className="opacity-60 text-sm">Эмодзи ещё не добавлены</span>
 )}
 </div>
 </div>
<div className="grid grid-cols-2 gap-3"> <div> <label className="text-xs uppercase tracking-wide opacity-70">Стиль</label> <select value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"> <option value="secondary">Вторичный</option> <option value="link">Ссылка</option>
 <option value="primary">Первичный</option>
 <option value="success">Успех</option>
 <option value="danger">Опасность</option>
 </select> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Тип</label> <select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"> <option value="inactive">Неактивная</option> <option value="active">Активная</option> </select> </div> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Переход на Embed</label> <select value={linkToEmbedId} onChange={(e) => setLinkToEmbedId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" disabled={false}> <option value="">Нет</option> {otherEmbeds.map(embed => <option key={embed.id} value={embed.id}>{embed.name}</option>)} </select> </div>
 <div className="mt-2">
 <label className="text-xs uppercase tracking-wide opacity-70">Переход на Окно</label>
 <select
 value={linkToModalId}
 onChange={(e) => setLinkToModalId(e.target.value)}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 >
 <option value="">Не переходить</option>
 {Array.isArray(modals) && modals.length > 0 ? (
 modals.map((m) => (
 <option key={m.id} value={m.id}>{m.title || ('Окно ' + (m.id?.slice(-4) || ''))}</option>
 ))
 ) : null}
 </select>
 </div>
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Переход на мини-эмбед</label>
 <select
 value={linkToMiniEmbedId}
 onChange={(e) => setLinkToMiniEmbedId(e.target.value)}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 >
 <option value="">Не переходить</option>
 {Array.isArray(miniEmbedsLocal) && miniEmbedsLocal.length > 0 ? ( miniEmbedsLocal.map((m) => (
 <option key={m.id} value={m.id}>{m.name || ('Мини-эмбед ' + (m.id?.slice(-4) || ''))}</option>
 ))
 ) : null}
 </select>
 </div>
 <div className="flex items-center justify-between pt-2"> <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Удалить</button> <button type="submit" className="px-3 py-2 rounded-md bg-[#6a8aec] hover:bg-indigo-500 text-sm font-medium h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button> </div> </form> );
}

function TextEditor({ initial, onSave, onDelete, customEmojis = [] }) {
 const [content, setContent] = React.useState(initial?.content || '');
 const [thumbUrl, setThumbUrl] = React.useState(initial?.thumbUrl || '');
 const taRef = React.useRef(null);
  const formatSelection = (before, after = before) => {
    const ta = taRef && taRef.current ? taRef.current : null;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? start;
    const value = typeof content === 'string' ? content : (ta.value || '');
    const selected = value.slice(start, end);
    const wrap = before + (selected || '') + (after);

    if (typeof ta.setRangeText === 'function') {
      // 1) Change the textarea value using native API (goes into browser undo stack)
      ta.setRangeText(wrap, start, end, 'end');
      // 2) Tell React about the change via synthetic input event (do NOT call setState directly)
      const evt = new InputEvent('input', { bubbles: true });
      ta.dispatchEvent(evt);
      return;
    }

    // Fallback (no native setRangeText): manual replace (won't integrate with native undo)
    const updated = value.slice(0, start) + wrap + value.slice(end);
    setContent(updated);
    const caret = start + wrap.length;
    const placeCaret = () => { try { ta.selectionStart = caret; ta.selectionEnd = caret; ta.focus(); } catch(_) {} };
    if (window.requestAnimationFrame) requestAnimationFrame(placeCaret); else setTimeout(placeCaret, 0);
  };


 const handleSave = (e) => {
 e.preventDefault();
 onSave?.({ content, thumbUrl });
 };

 return (
 <form className="space-y-4" onSubmit={handleSave}>
 <h3 className="text-base font-semibold">Текстовый блок</h3>
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Содержимое (Markdown/Discord)</label>

<div className="flex items-center gap-1 mb-1">
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('**','**')} title="Жирный **text**">B</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white italic text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('*','*')} title="Курсив *text*">I</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white font-mono text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('`','`')} title="Код `code`">`</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white line-through text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('~~','~~')} title="Зачеркнутый ~~text~~">S</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('> ','')} title="Цитата > text">&gt;</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('[','](url)')} title="Ссылка [text](url)">🔗</button>
</div>


 <textarea
 ref={taRef}
 value={content}
 onChange={(e) => setContent(e.target.value)}
 rows={6}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none whitespace-pre-wrap"
 placeholder="Введите текст..."
 />
 </div>
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Миниатюра (URL)</label>
 <input
 type="text"
 value={thumbUrl}
 onChange={(e) => setThumbUrl(e.target.value)}
 placeholder="https://..."
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 />
 </div>

 <div className="mt-3">
 <div
 className="no-scrollbar overflow-x-auto whitespace-nowrap flex items-center gap-2 py-2 px-2 rounded-xl border border-white/10"
 style={{ overscrollBehavior: "contain", scrollbarWidth: "none", msOverflowStyle: "none" }}
 onWheel={(e)=>{ const el = e.currentTarget; if(!el) return; const dx = Math.abs(e.deltaX); const dy = Math.abs(e.deltaY); const delta = dy >= dx ? e.deltaY : e.deltaX; el.scrollLeft += delta * 3; }}
 >
 {Array.isArray(customEmojis) && customEmojis.length > 0 ? (
 customEmojis.map((emoji) => {
 let srcUrl = (emoji && (emoji.url || emoji.src || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
 if (!srcUrl) { return null; }
 try {
 const u = new URL(srcUrl, window.location.origin);
 if (/cdn\.discordapp\.com$/.test(u.hostname) && u.pathname.startsWith('/emojis/') && !u.searchParams.has('size')) {
 u.searchParams.set('size', '64');
 }
 if (/media\.discordapp\.net$/.test(u.hostname) && u.pathname.startsWith('/attachments/')) {
 if (!u.searchParams.has('width')) u.searchParams.set('width', '64');
 if (!u.searchParams.has('height')) u.searchParams.set('height', '64');
 if (!u.searchParams.has('format')) u.searchParams.set('format', 'webp');
 }
 srcUrl = u.toString();
 } catch {} 
 const nameToken = (emoji && emoji.name) ? `:${emoji.name}: ` : '';
 const link = (emoji && (emoji.url || emoji.src || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
 return (
 <button
 key={emoji.id || emoji.name}
 type="button"
 className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80 active:scale-95 transition bg-transparent hover:ring-1 hover:ring-white/20 focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 style={{ backgroundImage: `url(${srcUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
 title={emoji.name ? `:${emoji.name}:` : 'emoji'}
 onMouseDown={(e)=>{ e.preventDefault(); }}
 onClick={(e)=>{
 e.preventDefault(); e.stopPropagation();
 const ta = taRef && taRef.current ? taRef.current : null;
 const isFocused = ta && document.activeElement === ta;
 if (nameToken && isFocused) {
 const start = ta.selectionStart ?? 0;
 const end = ta.selectionEnd ?? start;
 const before = (typeof content === 'string' ? content : (ta.value || ''));
 const updated = before.slice(0, start) + nameToken + before.slice(end);
 if (typeof setContent === 'function') { setContent(updated); } else { ta.value = updated; }
 const caret = start + nameToken.length;
 const placeCaret = ()=>{ try { ta.selectionStart = caret; ta.selectionEnd = caret; ta.focus(); } catch(_) {} };
 if (window.requestAnimationFrame) { requestAnimationFrame(()=>{ placeCaret(); }); } else { setTimeout(placeCaret, 0); }
 return;
 }
 if (!link) return;
 if (navigator.clipboard && navigator.clipboard.writeText) {
 navigator.clipboard.writeText(link).then(()=>{ if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована'); }).catch(()=>{ if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована'); });
 } else {
 try {
 const tmp = document.createElement('textarea'); tmp.value = link; document.body.appendChild(tmp);
 tmp.select(); document.execCommand('copy'); document.body.removeChild(tmp); if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована');
 } catch(_) {}
 }
 }}
 >
 <img
 src={link}
 alt={emoji.name || 'emoji'}
 className="w-6 h-6 object-contain pointer-events-none"
 loading="lazy"
 referrerPolicy="no-referrer"
 onError={(e)=>{ e.currentTarget.style.display = "none"; }}
 />
 </button>
 );
 })
 ) : null}
 </div>
 </div>

 
<div className="flex justify-between pt-2">
 <button type="button" onClick={() => onDelete?.()} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm">
 Удалить блок
 </button>
 <button type="submit" className="px-4 py-2 rounded-md bg-[#6a8aec] hover:bg-indigo-500 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Сохранить</button>
 </div>
 </form>
 );
}

function TextWithButtonEditor({ initial, onSave, onDelete, embeds, currentEmbedId, customEmojis = [], modals = [] }) {
 const { isReadOnlyDev } = React.useContext(AuthUiContext);
 const [content, setContent] = useState(initial?.content || '');
 const [button, setButton] = useState(initial?.button || sanitizeButton({}));
 
 
 const taRef = useRef(null);
  const formatSelection = (before, after = before) => {
    const ta = taRef && taRef.current ? taRef.current : null;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? start;
    const value = typeof content === 'string' ? content : (ta.value || '');
    const selected = value.slice(start, end);
    const wrap = before + (selected || '') + (after);

    if (typeof ta.setRangeText === 'function') {
      // 1) Change the textarea value using native API (goes into browser undo stack)
      ta.setRangeText(wrap, start, end, 'end');
      // 2) Tell React about the change via synthetic input event (do NOT call setState directly)
      const evt = new InputEvent('input', { bubbles: true });
      ta.dispatchEvent(evt);
      return;
    }

    // Fallback (no native setRangeText): manual replace (won't integrate with native undo)
    const updated = value.slice(0, start) + wrap + value.slice(end);
    setContent(updated);
    const caret = start + wrap.length;
    const placeCaret = () => { try { ta.selectionStart = caret; ta.selectionEnd = caret; ta.focus(); } catch(_) {} };
    if (window.requestAnimationFrame) requestAnimationFrame(placeCaret); else setTimeout(placeCaret, 0);
  };

const otherEmbeds = Array.isArray(embeds) ? embeds : [];

 const handleButtonChange = (patch) => {
 setButton(prev => sanitizeButton({ ...prev, ...patch }));
 };

 const handleSave = (e) => {
 e.preventDefault();
 onSave?.({ content, button });
 };

 return (
 <form className="space-y-4" onSubmit={handleSave}>
 <h3 className="text-base font-semibold">Блок "Текст с кнопкой"</h3>
 
 {/* Text Content Editor */}
 
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Содержимое (Markdown/Discord)</label>

<div className="flex items-center gap-1 mb-1">
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('**','**')} title="Жирный **text**">B</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white italic text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('*','*')} title="Курсив *text*">I</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white font-mono text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('`','`')} title="Код `code`">`</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white line-through text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('~~','~~')} title="Зачеркнутый ~~text~~">S</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('> ','')} title="Цитата > text">&gt;</button>
  <button type="button" className="h-6 w-6 flex items-center justify-center rounded bg-[#3a3c43]/60 hover:bg-[#4a4d55] text-gray-200 hover:text-white text-[11px]"
    onMouseDown={(e)=>e.preventDefault()} onClick={()=>formatSelection('[','](url)')} title="Ссылка [text](url)">🔗</button>
</div>


<textarea
 ref={taRef}
 value={content}
 onChange={(e) => setContent(e.target.value)}
 rows={6}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none whitespace-pre-wrap"
 placeholder="Введите текст..."
 />
<div className="mt-3">
 <div
 className="no-scrollbar overflow-x-auto whitespace-nowrap flex items-center gap-2 py-2 px-2 rounded-xl border border-white/10"
 style={{ overscrollBehavior: "contain", scrollbarWidth: "none", msOverflowStyle: "none" }}
 onWheel={(e)=>{ const el = e.currentTarget; if(!el) return; const dx = Math.abs(e.deltaX); const dy = Math.abs(e.deltaY); const delta = dy >= dx ? e.deltaY : e.deltaX; el.scrollLeft += delta * 3; }}
 >
 {Array.isArray(customEmojis) && customEmojis.length > 0 ? (
 customEmojis.map((emoji) => {
 let srcUrl = (emoji && (emoji.url || emoji.src || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
 if (!srcUrl) { return null; }
 try {
 const u = new URL(srcUrl, window.location.origin);
 if (/cdn\.discordapp\.com$/.test(u.hostname) && u.pathname.startsWith('/emojis/') && !u.searchParams.has('size')) {
 u.searchParams.set('size', '64');
 }
 if (/media\.discordapp\.net$/.test(u.hostname) && u.pathname.startsWith('/attachments/')) {
 if (!u.searchParams.has('width')) u.searchParams.set('width', '64');
 if (!u.searchParams.has('height')) u.searchParams.set('height', '64');
 if (!u.searchParams.has('format')) u.searchParams.set('format', 'webp');
 }
 srcUrl = u.toString();
 } catch {}
 const nameToken = (emoji && emoji.name) ? `:${emoji.name}: ` : '';
 const link = (emoji && (emoji.url || emoji.src || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
 return (
 <button
 key={emoji.id || emoji.name}
 type="button"
 className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80 active:scale-95 transition bg-transparent hover:ring-1 hover:ring-white/20 focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 style={{ backgroundImage: `url(${srcUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
 title={emoji.name ? `:${emoji.name}:` : 'emoji'}
 onMouseDown={(e)=>{ e.preventDefault(); }}
 onClick={(e)=>{
 e.preventDefault(); e.stopPropagation();
 const ta = taRef && taRef.current ? taRef.current : null;
 const isFocused = ta && document.activeElement === ta;
 if (nameToken && isFocused) {
 const start = ta.selectionStart ?? 0;
 const end = ta.selectionEnd ?? start;
 const before = (typeof content === 'string' ? content : (ta.value || ''));
 const updated = before.slice(0, start) + nameToken + before.slice(end);
 if (typeof setContent === 'function') { setContent(updated); } else { ta.value = updated; }
 const caret = start + nameToken.length;
 const placeCaret = ()=>{ try { ta.selectionStart = caret; ta.selectionEnd = caret; ta.focus(); } catch(_) {} };
 if (window.requestAnimationFrame) { requestAnimationFrame(()=>{ placeCaret(); }); } else { setTimeout(placeCaret, 0); }
 return;
 }
 if (!link) return;
 if (navigator.clipboard && navigator.clipboard.writeText) {
 navigator.clipboard.writeText(link).then(()=>{ if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована'); }).catch(()=>{ if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована'); });
 } else {
 try {
 const tmp = document.createElement('textarea'); tmp.value = link; document.body.appendChild(tmp);
 tmp.select(); document.execCommand('copy'); document.body.removeChild(tmp); if (window.__showToast) window.__showToast('Ссылка на эмодзи скопирована');
 } catch(_) {}
 }
 }}
 >
 <img
 src={link}
 alt={emoji.name || 'emoji'}
 className="w-6 h-6 object-contain pointer-events-none"
 loading="lazy"
 referrerPolicy="no-referrer"
 onError={(e)=>{ e.currentTarget.style.display = "none"; }}
 />
 </button>
 );
 })
 ) : (
 <span className="text-xs text-white/50">Эмодзи ещё не добавлены</span>
 )}
 </div>
 </div> 
 </div>

 <hr className="border-white/10" />

 {/* Button Editor Fields */}
 <div>
 <h4 className="text-sm font-semibold mb-2">Настройки кнопки</h4>
 <div className="space-y-3">
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Название кнопки</label>
 <input value={button.label} onChange={(e) => handleButtonChange({ label: e.target.value })} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" />
 </div>
 <div className="mt-2">
 <label className="text-xs uppercase tracking-wide opacity-70">Emoji слева — URL</label>
 <input value={button.leftEmojiUrl || ''} onChange={(e) => handleButtonChange({ leftEmojiUrl: e.target.value })} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" placeholder="https://..." />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Стиль</label>
 <select value={button.style} onChange={(e) => handleButtonChange({ style: e.target.value })} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none">
 <option value="secondary">Вторичный</option>
 <option value="link">Ссылка</option>
 </select>
 </div>
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Тип</label>
 <select value={button.active ? 'active' : 'inactive'} onChange={(e) => handleButtonChange({ active: e.target.value === 'active' })} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none">
 <option value="inactive">Неактивная</option>
 <option value="active">Активная</option>
 </select>
 </div>
 </div>
 <div>
 <label className="text-xs uppercase tracking-wide opacity-70">Переход на Embed</label>
 <select value={button.linkToEmbedId} onChange={(e) => handleButtonChange({ linkToEmbedId: e.target.value })} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" disabled={otherEmbeds.length === 0}>
 <option value="">Нет</option>
 {otherEmbeds.map(embed => <option key={embed.id} value={embed.id}>{embed.name}</option>)}
 </select>
 <div className="mt-2">
 <label className="text-xs uppercase tracking-wide opacity-70">Переход на Окно</label>
 <select
 value={button.linkToModalId || ""}
 onChange={(e) => handleButtonChange({ linkToModalId: e.target.value })}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 disabled={!(Array.isArray(modals) && modals.length)}
 >
 <option value="">Нет</option>
 {Array.isArray(modals) && modals.length > 0 ? modals.map(m => (
 <option key={m.id} value={m.id}>{m.title || ('Окно ' + (m.id?.slice(-4) || ''))}</option>
 )) : null}
 </select>
 <div className="mt-2">
 <label className="text-xs uppercase tracking-wide opacity-70">Переход на мини-эмбед</label>
 <select
 value={button.linkToMiniEmbedId || ""}
 onChange={(e) => handleButtonChange({ linkToMiniEmbedId: e.target.value })}
 className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"
 disabled={!((Array.isArray(embeds) && embeds.find(e => e && e.id === currentEmbedId)?.miniEmbeds || []).length)}
 >
 <option value="">Нет</option>
 {(embeds.find(e => e && e.id === currentEmbedId)?.miniEmbeds || []).map((m) => (
 <option key={m.id} value={m.id}>{m.name || ('Мини-эмбед ' + (m.id?.slice(-4) || ''))}</option>
 ))}
 </select>
 </div>

 </div>

 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between pt-2">
 <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Удалить блок</button>
 <button type="submit" className="px-3 py-2 rounded-md bg-[#6a8aec] hover:bg-indigo-500 text-sm font-medium h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button>
 </div>
 </form>
 );
}

function ListEditor({ initial, onSave, onDelete }) {
 const [items, setItems] = React.useState(() => Array.isArray(initial?.listItems) ? initial.listItems : []);

 const addItem = () => setItems(prev => [...prev, 'Новый пункт']);
 const deleteItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
 const moveItem = (from, to) => {
 if (to < 0 || to >= items.length) return;
 setItems(prev => {
 const next = [...prev];
 const [m] = next.splice(from, 1);
 next.splice(to, 0, m);
 return next;
 });
 };

 return (
 <div className="space-y-4">
 <h3 className="text-base font-semibold">Список</h3>
 <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
 {items.map((val, i) => (
 <div key={i} className="flex items-center gap-2 min-w-0">
 <div className="flex items-center gap-1">
 <button type="button" onClick={() => moveItem(i, i-1)} className="w-7 h-7 rounded bg-[#3a3c41] hover:bg-[#4a4e55]">▲</button>
 <button type="button" onClick={() => moveItem(i, i+1)} className="w-7 h-7 rounded bg-[#3a3c41] hover:bg-[#4a4e55]">▼</button>
 </div>
 <input
 value={val}
 onChange={(e) => setItems(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
 className="flex-1 rounded-md border border-[#202225] bg-transparent px-2 py-1 text-sm outline-none"
 />
 <button type="button" onClick={() => deleteItem(i)} className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 text-xs">Удалить</button>
 </div>
 ))}
 </div>
 <div className="text-[11px] opacity-70 mb-2">Формат пункта: <code>Заголовок|Описание|emoji|selected|mini:ID</code></div>
 <div className="flex justify-between">
 <button type="button" onClick={addItem} className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Добавить пункт</button>
 <div className="flex gap-2">
 <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Удалить блок</button>
 <button type="button" onClick={() => onSave({ listItems: items })} className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm">Сохранить</button>
 </div>
 </div>
 </div>
 );
}

function CommentsSidebar({ comments, activeId, onAdd, onChange, onDelete, onFocus, selecting, onCancel, showAll, onToggleShowAll }) {
 return (
 <aside className="w-[300px] shrink-0" onClick={(e)=>{ if (!e.target.closest('[data-comment-card]')) onFocus && onFocus(null); }}>
 <div className="rounded-xl border border-[#202225] bg-[#2b2d31] p-3 flex flex-col max-h-[calc(100vh-140px)]">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-sm font-semibold">Комментарии</h3>
 {selecting ? (
 <button
 type="button"
 onClick={onCancel}
 className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-xs focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 title="Выйти из режима выделения"
 >
 Отмена
 </button>
 ) : (
 <button
 type="button"
 onClick={onAdd}
 className="px-3 py-1.5 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-xs focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 title="Добавить комментарий"
 >
 Добавить комментарий
 </button>
 )}
 </div>

 <div className="space-y-3 overflow-y-auto pr-1 max-h-[calc(4*120px+3*12px)]">
 {comments.length === 0 && (
 <p className="text-xs text-white/50">Нет комментариев. Нажмите «Добавить комментарий», затем выделите область на экране.</p>
 )}
 {comments.map((c, i) => (
 <div
 key={c.id}
 data-comment-card
 className={`rounded-lg border ${activeId===c.id ? 'border-[#93d36f]' : 'border-[#202225]'} bg-[#93d36f14] p-2 min-h-[120px]`}
 onClick={(e) => { e.stopPropagation(); onFocus && onFocus(c.id); }}
 >
 <div className="flex items-center justify-between mb-2">
 <div className="text-xs opacity-70">Область #{i+1}</div>
 {activeId===c.id && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
 className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-xs"
 >
 Удалить
 </button>
 )}
 </div>
 <textarea
 className="w-full rounded-lg border border-[#202225] bg-transparent px-2 py-1 text-sm outline-none resize-none h-[72px]"
 rows={3}
 placeholder="Введите комментарий..."
 value={c.text || ''}
 onChange={(e) => onChange(c.id, { text: e.target.value })}
 />
 </div>
 ))}
 
 <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
 <span className="text-xs opacity-80 select-none">Показать все выделения</span>
 <div className="flex items-center gap-2">
 <span className="text-[11px] opacity-60 select-none">{showAll ? 'вкл' : 'выкл'}</span>
 <button
 type="button"
 role="switch"
 aria-checked={showAll}
 aria-label="Показать все выделения"
 onClick={onToggleShowAll}
 className={`relative inline-flex h-6 w-12 items-center rounded-full px-1 transition-colors
 ${showAll ? 'bg-indigo-500 justify-end' : 'bg-white/10 justify-start'} focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-2 focus:ring-indigo-500/50`}
 title={showAll ? 'Скрыть неактивные выделения' : 'Показать все выделения'}
 >
 <span className="h-5 w-5 rounded-full bg-white shadow transition-all ring-1 ring-black/10" />
 </button>
 </div>
 </div>
</div>
 </div>
 </aside>
 );
}
function ModalsSidebar({ modals = [], onCreate, onOpen, onOpenSettings, activeId }) {
 return (
 <aside className="w-[300px] shrink-0 mt-3">
 <div className="rounded-xl border border-[#202225] bg-[#2b2d31] p-3 flex flex-col">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-sm font-semibold">Модальные окна</h3>
 </div>
 <div className="flex flex-col gap-2">
 {modals.length === 0 ? (
 <div className="text-xs text-white/60">Пока нет окон</div>
 ) : (
 modals.map(m => (
 <button key={m.id}
 type="button" onContextMenu={(e) => { e.preventDefault(); onOpenSettings(m.id); }}
 className={`w-full px-3 py-2 rounded-md border border-[#202225] text-left text-sm hover:bg-[#3a3d42] ${activeId === m.id ? "bg-[#5865f2] text-white" : "bg-[#313338] text-white/90"}`}
 onClick={() => { onOpen && onOpen(m.id); }}
 >
 {m.title}
 </button>
 ))
 )}
 </div>
 <button type="button" onClick={onCreate} className="mt-3 px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium h-9 flex items-center justify-center leading-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Создать окно</button>
 </div>
 </aside>
 );
}

// --- Global Toast ---
function ToastHost() {
 const [toasts, setToasts] = React.useState([]); // [{id, text}]
 React.useEffect(() => {
 window.__showToast = (text) => {
 const id = Math.random().toString(36).slice(2);
 setToasts((prev) => [...prev, { id, text }]);
 setTimeout(() => setToasts((prev) => prev.filter(t => t.id !== id)), 1800);
 };
 return () => { if (window.__showToast) delete window.__showToast; };
 }, []);
 return (
 <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none select-none">
 {toasts.map(t => (
 <div
 key={t.id}
 className="pointer-events-auto bg-black/80 text-white text-sm px-3 py-2 rounded-lg shadow"
 role="status"
 >
 {t.text}
 </div>
 ))}
 </div>
 );
}

function MiniEmbedsSidebar({ miniEmbeds, onCreate, onOpen, activeId, onRename, onReorder, onDelete, remoteEmbedStatuses = {} }) {
 const [renameId, setRenameId] = React.useState(null);
 const [renameValue, setRenameValue] = React.useState("");

 const openRename = (m) => {
 setRenameId(m?.id || null);
 setRenameValue(m?.name || "");
 };
 const closeRename = () => { setRenameId(null); setRenameValue(""); };
 const submitRename = (e) => {
 e && e.preventDefault && e.preventDefault();
 if (renameId && typeof onRename === 'function') {
 onRename(renameId, renameValue);
 }
 closeRename();
 };

 const handleDelete = () => {
 if (renameId && typeof onDelete === 'function') {
 onDelete(renameId);
 }
 };

return (
 <aside className="w-[300px] shrink-0 mt-3">
 <div className="rounded-xl border border-[#202225] bg-[#2b2d31] p-3 flex flex-col">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-sm font-semibold">Мини-эмбеды</h3>
 <button
 type="button"
 onClick={onCreate}
 className="h-7 px-3 rounded-md bg-[#4f535c] hover:bg-[#5d6269] text-xs text-white flex items-center justify-center leading-none focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0"
 >
 Создать
 </button>
 </div>
 {Array.isArray(miniEmbeds) && miniEmbeds.length > 0 ? (
 <div className="flex flex-col gap-2">
 {miniEmbeds.map((m) => (
 <button
  key={m.id}
  type="button"
  onContextMenu={(e) => { e.preventDefault(); openRename(m); }}
  onClick={() => { onOpen && onOpen(m.id); }}
  className={`w-full px-3 py-2 rounded-md border border-[#202225] text-left text-sm ${activeId === m.id ? "bg-[#8b5cf6] text-white hover:bg-[#8b5cf6]" : "bg-[#313338] text-white/90 hover:bg-[#3a3d42]"}`}
  style={{
    backgroundImage: !(activeId === m.id) && isDoneStatus((remoteEmbedStatuses?.[m.id] ?? m?.status))
      ? 'linear-gradient(to right, #9ec07066, transparent)'
      : (!(activeId === m.id) && isInProgressStatus((remoteEmbedStatuses?.[m.id] ?? m?.status))
          ? 'linear-gradient(to right, #ff923166, transparent)'
          : undefined)
  }}
>
  {m.name || 'Без названия'}
 </button>
 ))}
 </div>
 ) : (
 <div className="text-xs text-white/60">Пока нет мини-эмбедов</div>
 )}
 </div>
 
 {renameId && (
 <Modal onClose={closeRename} contentClassName="w-[420px] max-w-[95vw]">
 <form className="space-y-4" onSubmit={submitRename}>
 <h3 className="text-lg font-semibold">Переименовать мини-эмбед</h3>
 <input
 type="text"
 value={renameValue}
 onChange={(e) => setRenameValue(e.target.value)}
 placeholder="Новое название"
 className="w-full px-3 py-2 rounded-md bg-[#1e1f22] border border-[#2a2c30] focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-1 focus:ring-[#5865f2]"
 autoFocus
 />
 {/* Стрелки перемещения — как в редакторе эмбеда */}
 <div className="mt-2 flex items-center gap-4">
 {(() => {
 const list = Array.isArray(miniEmbeds) ? miniEmbeds : [];
 const idx = list.findIndex(m => m && m.id === renameId);
 const isFirst = idx <= 0;
 const isLast = idx === -1 || idx >= list.length - 1;
 const base = "h-10 w-28 rounded-lg bg-[#2f3136] hover:bg-[#3a3c41] text-gray-300/90 grid place-items-center transition border border-white/5";
 const disabled = "opacity-50 cursor-not-allowed hover:bg-[#2f3136]";
 return (
 <>
 <button
 type="button"
 onClick={() => { if (!isFirst && typeof onReorder === 'function') onReorder(renameId, -1); }}
 className={base + " " + (isFirst ? disabled : "")}
 title="Переместить вверх"
 disabled={isFirst}
 >
 <span className="text-xs select-none" aria-hidden>▲</span>
 </button>
 <button
 type="button"
 onClick={() => { if (!isLast && typeof onReorder === 'function') onReorder(renameId, +1); }}
 className={base + " " + (isLast ? disabled : "")}
 title="Переместить вниз"
 disabled={isLast}
 >
 <span className="text-xs select-none" aria-hidden>▼</span>
 </button>
 </>
 );
 })()}
 </div>

 
 <div className="flex items-center justify-between mt-3">
 <button
 type="button"
 onClick={() => { handleDelete(); closeRename(); }}
 className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm text-white"
 >
 Удалить
 </button>
 <div className="flex items-center gap-2">
 <button type="button" onClick={closeRename} className="px-3 py-2 rounded-md bg-[#4f535c] hover:bg-[#5d6269] text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Отмена</button>
 <button type="submit" className="px-3 py-2 rounded-md bg-[#6a8aec] hover:bg-indigo-700 text-sm h-9 flex items-center justify-center focus:outline-none focus:border-none focus-visible:outline-none focus-visible:border-none focus:ring-0 focus-visible:ring-0">Сохранить</button>
 </div>
 </div>

 </form>
 </Modal>
 )}
</aside>
 );
}

function GateApp() {
 const authUser = useAuthUser();
 const onLogout = React.useCallback(async () => {
 try { await signOut(firebaseAuth); } catch (_) {}
 isReadOnlyDev = !!(authUser && (authUser.uid === DEV_UID || authUser.email === DEV_EMAIL));
 }, [authUser]);
 if (REQUIRE_AUTH && !authUser) return <LoginForm />;
 return (
 <div className="min-h-screen bg-[#1E1F22] text-[#DBDEE1]">
 <InnerApp />
 <ToastHost />
 </div>
 );
}

// ===== [EXPORTER] DevInspectBar (with V2 + JS export) =====
function DevInspectBar({ currentEmbed, parentEmbed, embeds, activeEmbedId }) {
  if (!DEV_EXPORT) return null;

  function resolveEmbed() {
    if (currentEmbed && typeof currentEmbed === 'object') return currentEmbed;
    if (parentEmbed && typeof parentEmbed === 'object') return parentEmbed;
    if (Array.isArray(embeds)) {
      if (activeEmbedId) {
        const byActive = embeds.find(e => e && e.id === activeEmbedId);
        if (byActive) return byActive;
      }
      return embeds[0];
    }
    return null;
  }

  const handleExportV2 = () => {
    const embed = resolveEmbed();
    if (!embed) return alert('Сначала выбери/создай эмбед');
    const payload = exportEmbedV2(embed);
    const slug = (embed.slug || embed.name || embed.id || 'rustify_embed').toString().replace(/\s+/g,'_').toLowerCase();
    const text = JSON.stringify(payload, null, 2);
    downloadText(text, slug + '.components.v2.json');
  };

  const handleExportTSV2 = () => {
    const embed = resolveEmbed();
    
const handleExportDiscordBotCV2 = async () => {
  const list = Array.isArray(embeds) ? embeds.slice() : [];
  if (!list.length) return alert('Нет страниц для экспорта');

  const ids = new Set();
  function normId(x, i) {
    const base = (x && (x.id || x.slug || x.name || x.title)) ? String(x.id || x.slug || x.name || x.title) : ('page_' + (i+1));
    let v = base.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || ('page_' + (i+1));
    let k = v, n = 1;
    while (ids.has(k)) { k = v + '_' + (++n); }
    ids.add(k);
    return k;
  }

  const readText = (e) => {
    if (!e || typeof e !== 'object') return '';
    return String(e.description || e.content || e.title || e.name || '').trim();
  };

  const pages = list.map((e, i) => {
    const id = normId(e, i);
    const name = String(e.name || e.title || ('Страница ' + (i+1)));
    const prevId = (i > 0) ? normId(list[i-1], i-1) : null;
    const nextId = (i < list.length-1) ? normId(list[i+1], i+1) : null;
    const items = [];
    const text = readText(e);
    if (text) items.push({ type: 'text', text });
    const buttons = [];
    if (prevId) buttons.push({ label: '← Предыдущая', linkToEmbedId: prevId });
    if (nextId) buttons.push({ label: 'Следующая →', linkToEmbedId: nextId });
    if (buttons.length) items.push({ type: 'buttons', buttons });
    return { id, name, items };
  });

  const project = {
    format: 'cv2',
    projectName: (window?.document?.title || 'Rustify Export (CV2)'),
    embeds: pages
  };

  try { await handleExportDiscordBotCV2Click(project); }
  catch (e) { console.error('[export discord bot cv2] failed', e); alert('Экспорт не удался: ' + (e?.message || e)); }
};
if (!embed) return alert('Сначала выбери/создай эмбед');
    const fn = (typeof exportEmbedCode === 'function') ? exportEmbedCode : (window.RustifyExport && window.RustifyExport.exportEmbedCode);
    if (!fn) return alert('exportEmbedCode не найден: проверь импорт и файл rustify_embed_export_v1.js');
    const code = fn(embed);
    const slug = (embed.slug || embed.name || embed.id || 'rustify_embed').toString().replace(/\s+/g,'_').toLowerCase();
    downloadText(code, slug + '.embed.v2.js');
  };

  // === Discord Bot (CV2) export ===
const handleExportDiscordBotCV2 = async () => {
  const list = Array.isArray(embeds) ? embeds.slice() : [];
  if (!list.length) return alert('Нет страниц для экспорта');

  const ids = new Set();
  function normId(x, i) {
    const base = (x && (x.id || x.slug || x.name || x.title)) ? String(x.id || x.slug || x.name || x.title) : ('page_' + (i+1));
    let v = base.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || ('page_' + (i+1));
    let k = v, n = 1;
    while (ids.has(k)) { k = v + '_' + (++n); }
    ids.add(k);
    return k;
  }

  const readText = (e) => {
    if (!e || typeof e !== 'object') return '';
    return String(e.description || e.content || e.title || e.name || '').trim();
  };

  const pages = list.map((e, i) => {
    const id = normId(e, i);
    const name = String(e.name || e.title || ('Страница ' + (i+1)));
    const prevId = (i > 0) ? normId(list[i-1], i-1) : null;
    const nextId = (i < list.length-1) ? normId(list[i+1], i+1) : null;
    const items = [];
    const text = readText(e);
    if (text) items.push({ type: 'text', text });
    const buttons = [];
    if (prevId) buttons.push({ label: '← Предыдущая', linkToEmbedId: prevId });
    if (nextId) buttons.push({ label: 'Следующая →', linkToEmbedId: nextId });
    if (buttons.length) items.push({ type: 'buttons', buttons });
    return { id, name, items };
  });

  const project = { format: 'cv2', projectName: (window?.document?.title || 'Rustify Export (CV2)'), embeds: pages };

  try { await handleExportDiscordBotCV2Click(project); }
  catch (e) { console.error('[export discord bot cv2] failed', e); alert('Экспорт не удался: ' + (e?.message || e)); }
};
return (
    <div className="mb-3 p-2 rounded-lg border border-white/10 bg-black/30 flex items-center gap-2 text-xs">
      <button onClick={handleExportV2} className="px-3 h-8 rounded bg-[#5865F2] hover:bg-[#4752C4] text-white">JSON</button>
      <button onClick={handleExportTSV2} className="px-3 h-8 rounded bg-[#6a8aec] hover:bg-[#536de0] text-white">TS Code</button>
      <button onClick={handleExportDiscordBotCV2} className="px-3 h-8 rounded bg-[#2b7e4a] hover:bg-[#23693e] text-white">Discord Bot (CV2)</button>
    </div>
  );
}
// ===== [EXPORTER] end DevInspectBar =====



export default GateApp;