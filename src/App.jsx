import React, { useEffect, useMemo, useRef, useState } from "react";
var isReadOnlyDev; // global bridge for editors defined at module scope
import { onAuthStateChanged, getAuth, signInWithCustomToken, signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth as firebaseAuth, db as firebaseDb } from "../firebase.js";
import { getApps, getApp, initializeApp } from "firebase/app";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
// --- Firebase Config (placeholders, will be populated by the environment) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Global default banner ---
const DEFAULT_BANNER_URL = "https://i.ibb.co/gM3ZJYGt/vidget.png?ex=689d27e1&is=689bd661&hm=0ba370ab75ace8478cbcc6c596b0dda51c9a9dc41b055f881c3ef83371f7e094&=&format=webp&quality=lossless&width=1100&height=330";

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
const sanitizeButton = (btn) => ({
    id: btn.id || `btn-${Date.now()}`,
    label: btn.label || "",
    leftEmojiUrl: btn.leftEmojiUrl || "",
    rightEmojiUrl: btn.rightEmojiUrl || "",
    style: (['primary','success','danger','link','secondary'].includes(btn.style) ? btn.style : 'secondary'),
    active: btn.active !== false,
    linkToEmbedId: btn.linkToEmbedId || "",
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
            case 'image':
                if (item.id === 'img') {
                    return { ...item, url: defaultUrl };
                }
                return { ...item, url: item.url || defaultUrl };
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
    const imageUrl = embed.imageUrl || DEFAULT_BANNER_URL;
    return {
        id: embed.id || `embed-${Date.now()}`,
        name: embed.name || "Untitled Embed",
        items: sanitizeItems(embed.items, imageUrl),
        imageUrl: imageUrl,
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
      <button className="h-8 px-3 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium" onClick={onLogout}>
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
        <button type="submit" disabled={loading} className="w-full h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15">
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
          className="h-7 px-2.5 rounded-md bg-red-600 hover:bg-red-700 text-xs font-medium shrink-0"
          onClick={onLogout}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

function InnerApp() {

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
  const [showLoadModal, setShowLoadModal] = useState(false);

  // Ensure collection ref exists whenever Load modal opens (after reloads)
  useEffect(() => {
    const _db = db || firebaseDb;
    const current = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
        const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
        const _uid = devNow ? OWNER_UID : (userId || (current ? current.uid : null));
    if (showLoadModal && _db && _uid && !savesCollectionRef.current) {
      const path = `artifacts/${appId}/users/${_uid}/embedBuilderSaves`;
      savesCollectionRef.current = collection(_db, path);
      console.log("LoadModal init collection ref:", path);
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
  const [embeds, setEmbeds] = useState(() => [createDefaultEmbed()]);
  const [activeEmbedId, setActiveEmbedId] = useState(embeds[0].id);
  const [customEmojis, setCustomEmojis] = useState([
      { name: 'rust', url: 'https://cdn.discordapp.com/emojis/1403718114385854576.webp?size=128' }
  ]);
  // --- Emoji search state (live filter) ---
  const [emojiQuery, setEmojiQuery] = useState('');
  const visibleEmojis = useMemo(() => {
    const q = (emojiQuery || '').trim().toLowerCase();
    if (!q) return customEmojis;
    return customEmojis.filter(e => ((e?.name || '').toLowerCase().includes(q)));
  }, [emojiQuery, customEmojis]);

  // --- Derived State ---
  const currentEmbed = useMemo(() => embeds.find(e => e.id === activeEmbedId) || embeds[0], [embeds, activeEmbedId]);
  const footerBlocks = useMemo(() => (
    currentEmbed && Array.isArray(currentEmbed.items)
      ? currentEmbed.items.filter(it => it && it.position === 'footer' && (it.type === 'buttons' || it.type === 'list'))
      : []
  ), [currentEmbed]);

  const itemsForCanvas = useMemo(() => (
    currentEmbed && Array.isArray(currentEmbed.items)
      ? currentEmbed.items.filter(it => !(it && it.position === 'footer' && (it.type === 'buttons' || it.type === 'list')))
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
      setEmbeds(prev => prev.map(e => e.id === activeEmbedId ? { ...e, ...patch } : e));
  };
  
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

        onAuthStateChanged(authInstance, async (user) => { if (user) { if (user.uid === DEV_UID || user.email === DEV_EMAIL) { setUserId(OWNER_UID); setIsReadOnlyDev(true); } else { setUserId(user.uid); setIsReadOnlyDev(false); }
            } else {
                const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                try {
                    if (token) {
                        await signInWithCustomToken(authInstance, token);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                } catch (error) {
                    console.error("Sign-in failed", error);
                    setLoadingStatus('error');
                }
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
    const path = `artifacts/${appId}/users/${userId}/embedBuilderSaves`;
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
      if (currentEmbed) {
          const mainImageBlock = currentEmbed.items.find(item => item.type === 'image' && item.id === 'img');
          if (mainImageBlock && mainImageBlock.url !== currentEmbed.imageUrl) {
              updateCurrentEmbed({
                  items: currentEmbed.items.map(item =>
                      item.type === 'image' && item.id === 'img'
                          ? { ...item, url: currentEmbed.imageUrl }
                          : item
                  )
              });
          }
      }
  }, [currentEmbed?.imageUrl, activeEmbedId]);

  // --- Save/Load/Delete Handlers ---
  const handleSave = async () => { if (isReadOnlyDev) { setStatusMessage("Режим только чтение: разработчик не может сохранять изменения в ваших сохранёнках."); return; }
      const _db = db || firebaseDb;
      const current = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
        const devNow = current && (current.uid === DEV_UID || current.email === DEV_EMAIL);
        const _uid = devNow ? OWNER_UID : (userId || (current ? current.uid : null));
      console.log("handleSave(): db?", !!_db, "uid?", _uid);
      if (!_db || !_uid) {
        setStatusMessage('БД/пользователь не готовы');
        setTimeout(() => setStatusMessage(""), 2500);
        return;
      }
      if (!saveName.trim()) return;

      try {
        if (!savesCollectionRef?.current) {
          const path = `artifacts/${appId}/users/${_uid}/embedBuilderSaves`;
          savesCollectionRef.current = collection(_db, path);
          console.log("Recreated collection ref:", path);
        }

        const docRef = doc(savesCollectionRef.current, saveName.trim());
        const payload = {
          embeds: embeds.map(sanitizeEmbed).filter(Boolean),
          activeEmbedId,
          customEmojis,
          commentsByEmbed,
        };
        console.log("Saving to:", docRef.path, payload);
        await setDoc(docRef, payload);
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
        const defaultEmojis = [{ name: 'rust', url: 'https://cdn.discordapp.com/emojis/1403718114385854576.webp?size=128' }];
        setCustomEmojis(Array.isArray(stateToLoad.customEmojis) ? stateToLoad.customEmojis : defaultEmojis);
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
        const _uid = devNow ? OWNER_UID : (userId || (current ? current.uid : null));
        if (!ref) {
          if (!_db || !_uid) {
            console.warn("Refresh: DB/user not ready");
            setStatusMessage("БД/пользователь не готовы");
            setTimeout(() => setStatusMessage(""), 2500);
            return;
          }
          const path = `artifacts/${appId}/users/${_uid}/embedBuilderSaves`;
          ref = collection(_db, path);
          savesCollectionRef.current = ref;
          console.log("Refresh created collection ref:", path);
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
            const btn = it.button ? { ...it.button, id: nbid() } : undefined;
            return { ...it, id: nid(), button: btn };
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
          imageUrl: parent.imageUrl,          // тот же баннер, что у родителя
          items: clonedItems,                  // скопированные блоки родителя
          parentId: parent.id
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
  const [selectionRect, setSelectionRect] = useState(null); // {x,y,w,h}
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const currentComments = commentsByEmbed[activeEmbedId] || [];
  // Resizing/moving active comment rect
  const [isAdjustingRect, setIsAdjustingRect] = useState(false);
  const [adjustMode, setAdjustMode] = useState(null); // 'move'|'nw'|'ne'|'sw'|'se'|'n'|'s'|'w'|'e'
  const [adjustStart, setAdjustStart] = useState({ x: 0, y: 0 });
  const [adjustOrig, setAdjustOrig] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const activeComment = useMemo(
    () => currentComments.find(c => c.id === activeCommentId) || null,
    [currentComments, activeCommentId]
  );

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
      rustify: "#94db6b",
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

// Move a block (by id) up or down among visible items (footer excluded)
const moveBlock = (blockId, delta) => {
  if (!currentEmbed || !Array.isArray(currentEmbed.items)) return;
  modifyItems(prev => {
    const items = [...prev];
    // Indices of visible (non-footer) items
    const visibleIdxs = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!(it && it.type === 'buttons' && it.position === 'footer')) {
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
      if (!newEmojiName.trim() || !newEmojiUrl.trim()) return;
      if (customEmojis.some(em => em.name === newEmojiName.trim())) {
          console.warn("An emoji with this name already exists.");
          return;
      }
      setCustomEmojis(prev => [...prev, { name: newEmojiName.trim(), url: newEmojiUrl.trim() }]);
      setNewEmojiName('');
      setNewEmojiUrl('');
  };

  const deleteCustomEmoji = (name) => {
      setCustomEmojis(prev => prev.filter(em => em.name !== name));
  };
  const startRenameEmoji = (old) => setEmojiRename({ old, value: old });
  const cancelRenameEmoji = () => setEmojiRename(null);
  const saveRenameEmoji = () => {
    if (!emojiRename) return;
    const newName = (emojiRename.value || '').trim();
    if (!newName) { setEmojiRename(null); return; }
    if (/[^a-z0-9_]/i.test(newName)) { console.warn("Некорректное имя эмодзи"); return; }
    if (customEmojis.some(e => e.name === newName && e.name !== emojiRename.old)) {
      console.warn("Эмодзи с таким именем уже существует");
      return;
    }
    setCustomEmojis(prev => prev.map(e => e.name === emojiRename.old ? { ...e, name: newName } : e));
    setEmojiRename(null);
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
            <EmbedSidebar
              embeds={embeds}
              activeEmbedId={activeEmbedId}
              setActiveEmbedId={setActiveEmbedId}
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
            />
            <div ref={workAreaRef} className="relative flex-1 min-w-0" onClick={(e) => { if (previewMode && !isSelectingComment) { setActiveCommentId(null); } }}>
              
    <div className="flex items-center gap-2 text-xs opacity-90" onClick={(e)=>e.stopPropagation()}>
      <div className="inline-flex rounded-md overflow-hidden border border-[#202225]">
        <button
          type="button"
          onClick={() => setPreviewMode(false)}
          className={`h-7 px-3 ${!previewMode ? 'bg-[#5865F2] text-white' : 'bg-transparent text-white/80'} transition`}
          title="Режим редактирования"
        >
          Редакт.
        </button>
        <button
          type="button"
          onClick={() => setPreviewMode(true)}
          className={`h-7 px-3 border-l border-[#202225] ${previewMode ? 'bg-[#5865F2] text-white' : 'bg-transparent text-white/80'} transition`}
          title="Режим предпросмотра"
        >
          Предпросм.
        </button>
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
                        previewMode={previewMode}
                        onAddButton={addButtonToBlock}
                        onReorderButtons={onReorderButtons}
                        onEmbedLinkClick={setActiveEmbedId}
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
                        previewMode={previewMode}
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
              setEditingTextId={setEditingTextId}
              setEditingTextWithButtonId={setEditingTextWithButtonId}
              setEditingListId={setEditingListId}
              previewMode={previewMode}
              onAddButton={addButtonToBlock}
              onReorderButtons={onReorderButtons}
              onEmbedLinkClick={setActiveEmbedId}
             onMoveBlock={moveBlock} />
          
</MessageRow>
          {/* Selection overlay & highlights (preview) */}
          
          {showAllHighlights ? (
            <div className="absolute inset-0 z-40 pointer-events-auto" onClick={(e)=>{ if (e.target===e.currentTarget) setActiveCommentId(null); }}>
              {currentComments.map((c, i) => (
                <div
                  key={c.id}
                  className="absolute border-2 border-[#94db6b]/80 rounded cursor-pointer"
                  style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
                  onClick={(e) => { e.stopPropagation(); setActiveCommentId(c.id); }}
                >
                  <div className="absolute -top-4 left-0 text-xs bg-[#94db6b] text-[#2B2D31] px-1 rounded">{i+1}</div>
                </div>
              ))}
            </div>
          ) : (
            activeComment && (
              <div className="absolute inset-0 z-40 pointer-events-auto" onClick={(e)=>{ if (e.target===e.currentTarget) setActiveCommentId(null); }}>
                <div
                key={activeComment.id}
                className="absolute border-2 border-[#94db6b]/80 rounded z-30"
                style={{ left: activeComment.x, top: activeComment.y, width: activeComment.w, height: activeComment.h }}
              >
                {/* move handle overlay */}
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
                {/* corner/edge handles */}
                {['nw','ne','sw','se','n','s','w','e'].map((pos) => {
                  const base = 'absolute bg-white rounded-sm shadow ring-1 ring-black/20';
                  const size = 'w-2.5 h-2.5';
                  const mapPos = {
                    nw: 'top-0 left-0 -mt-1 -ml-1 cursor-nwse-resize',
                    ne: 'top-0 right-0 -mt-1 -mr-1 cursor-nesw-resize',
                    sw: 'bottom-0 left-0 -mb-1 -ml-1 cursor-nesw-resize',
                    se: 'bottom-0 right-0 -mb-1 -mr-1 cursor-nwse-resize',
                    n:  'top-0 left-1/2 -mt-1 -ml-1 cursor-ns-resize',
                    s:  'bottom-0 left-1/2 -mb-1 -ml-1 cursor-ns-resize',
                    w:  'left-0 top-1/2 -ml-1 -mt-1 cursor-ew-resize',
                    e:  'right-0 top-1/2 -mr-1 -mt-1 cursor-ew-resize',
                  }[pos];
                  return (
                    <div
                      key={pos}
                      className={`${base} ${size} ${mapPos}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsAdjustingRect(true);
                        setAdjustMode(pos);
                        setAdjustStart({ x: e.clientX, y: e.clientY });
                        setAdjustOrig({ x: activeComment.x, y: activeComment.y, w: activeComment.w, h: activeComment.h });
                      }}
                    />
                  );
                })}
              </div>
              </div>
            )
        )}
        {isAdjustingRect && (
          <div
            className="absolute inset-0 z-40"
            onMouseMove={(e) => {
              if (!isAdjustingRect || !activeComment) return;
              const dx = e.clientX - adjustStart.x;
              const dy = e.clientY - adjustStart.y;
              let { x, y, w, h } = adjustOrig;
              if (adjustMode === 'move') {
                x = adjustOrig.x + dx;
                y = adjustOrig.y + dy;
              } else {
                // resize logic per handle
                if (adjustMode.includes('e')) { w = Math.max(4, adjustOrig.w + dx); }
                if (adjustMode.includes('s')) { h = Math.max(4, adjustOrig.h + dy); }
                if (adjustMode.includes('w')) { x = adjustOrig.x + dx; w = Math.max(4, adjustOrig.w - dx); }
                if (adjustMode.includes('n')) { y = adjustOrig.y + dy; h = Math.max(4, adjustOrig.h - dy); }
              }
              setComments(prev => prev.map(c => c.id === activeComment.id ? { ...c, x, y, w, h } : c));
            }}
            onMouseUp={() => {
              setIsAdjustingRect(false);
              setAdjustMode(null);
            }}
          />
        )}

          {previewMode && isSelectingComment && (
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
                  setComments(prev => [...prev, newC]);
                  setActiveCommentId(id);
                }
                setIsSelectingComment(false);
                setSelectionRect(null);
              }}
            >
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              {selectionRect && (
                <div
                  className="absolute bg-indigo-500/20 border-2 border-indigo-500 rounded"
                  style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.w, height: selectionRect.h }}
                />
              )}
            </div>
          )}
            </div>
          {/* ProfileBar is rendered from wrapper above */}

          <div className="shrink-0 flex flex-col">


            <AuthProfileBar />


            <CommentsSidebar
            comments={currentComments}
            activeId={activeCommentId}
            onAdd={startCommentSelection}
            onChange={(id, patch) => setComments(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))}
            onDelete={(id) => setComments(prev => prev.filter(c => c.id !== id))}
            onFocus={(id) => setActiveCommentId(id)}
            selecting={isSelectingComment}
            onCancel={() => { setIsSelectingComment(false); setSelectionRect(null); }}
            showAll={showAllHighlights}
            onToggleShowAll={() => setShowAllHighlights(prev => !prev)} />


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
            <button onClick={addMenu} className="h-9 px-4 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium">Меню</button>
            <button onClick={addHr} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium" title="Добавить HR">HR</button>
            <button onClick={addText} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium" title="Добавить текстовый блок">Текст</button>
            <button onClick={addTextWithButton} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium" title="Добавить текст с кнопкой">Текст+Кнопка</button>
            <button onClick={addList} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium" title="Добавить выпадающий список">Список</button>
            
            <button onClick={addFooterMenu} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium" title="Добавить нижнее меню">Ниж. Меню</button>
            <button onClick={addFooterList} className="h-9 px-3 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium" title="Добавить нижний список">Ниж. Список</button>

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
                      <button onClick={saveRenameEmoji} className="text-xs text-green-500 hover:text-green-400 font-semibold">Сохранить</button>
                      <button onClick={cancelRenameEmoji} className="text-xs text-white/60 hover:text-white/80">Отмена</button>
                    </>
                  ) : (
                    <button onClick={() => startRenameEmoji(emoji.name)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">Переименовать</button>
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
                <button type="submit" className="w-full h-9 px-4 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm font-medium">Добавить эмодзи</button>
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
              <button type="submit" className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button>
            </div>
          </form>
        </Modal>
      )}
      {showLoadModal && ( <Modal onClose={() => setShowLoadModal(false)}> <div className="space-y-4"> <div className="flex items-center justify-between mb-2"> <h3 className="text-lg font-semibold">Загрузить проект</h3> <button onClick={handleRefreshSaves} className="px-3 py-1 text-xs rounded-md bg-gray-600 hover:bg-gray-500 disabled:opacity-50 transition-colors" disabled={isRefreshing || !(db || firebaseDb) || !(userId || (firebaseAuth && firebaseAuth.currentUser))}> {isRefreshing ? 'Обновление...' : 'Обновить'} </button> </div> <div className="space-y-2 max-h-64 overflow-y-auto pr-2"> {loadingStatus === 'loading' && <p className="text-sm text-white/50">Загрузка сохранений...</p>} {loadingStatus === 'error' && <p className="text-sm text-red-400">Ошибка загрузки.</p>} {loadingStatus === 'ready' && savedStates.length > 0 ? savedStates.map(state => ( <div key={state.id} className="flex items-center justify-between bg-[#202225] p-2 rounded-lg"> <span className="text-sm">{state.id}</span> <div className="flex gap-2"> <button onClick={() => handleLoad(state)} className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700">Загрузить</button> <button onClick={() => { setShowLoadModal(false); setDeleteConfirmId(state.id); }} className="px-3 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700">Удалить</button> </div> </div> )) : null} {loadingStatus === 'ready' && savedStates.length === 0 && <p className="text-sm text-white/50">Нет сохраненных проектов.</p>} </div> <div className="flex justify-end"> <button onClick={() => setShowLoadModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Закрыть</button> </div> </div> </Modal> )}
      {deleteConfirmId && ( <Modal onClose={() => setDeleteConfirmId(null)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Подтверждение</h3> <p className="text-sm text-white/70">Вы уверены, что хотите удалить проект "{deleteConfirmId}"? Это действие необратимо.</p> <div className="flex justify-end gap-2"> <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={!isReadOnlyDev ? handleDelete : (()=>setStatusMessage("Режим только чтение: удаление недоступно."))} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm" disabled={isReadOnlyDev}>Удалить</button> </div> </div> </Modal> )}
      {showNewEmbedModal && ( <Modal onClose={() => setShowNewEmbedModal(false)}> <form className="space-y-4 w-full" onSubmit={(e) => { e.preventDefault(); handleAddNewEmbed(); }}> <h3 className="text-lg font-semibold">Создать новый Embed</h3> <p className="text-sm text-white/70">Введите название для нового встраиваемого блока.</p> <input type="text" value={newEmbedName} onChange={(e) => setNewEmbedName(e.target.value)} placeholder="Название Embed'а" className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} autoFocus /> <div className="flex justify-end gap-2"> <button type="button" onClick={() => setShowNewEmbedModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm">Создать</button> </div> </form> </Modal> )}
      {deletingEmbed && ( <Modal onClose={() => setDeletingEmbed(null)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Удалить Embed?</h3> <p className="text-sm text-white/70">Вы уверены, что хотите удалить эмбед "{deletingEmbed.name}"? Это действие нельзя будет отменить.</p> <div className="flex justify-end gap-2"> <button onClick={() => setDeletingEmbed(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={handleDeleteEmbed} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm">Удалить</button> </div> </div> </Modal> )}
      {renamingEmbed && ( <Modal onClose={() => setRenamingEmbed(null)}> <form className="space-y-4 w-full" onSubmit={(e) => { e.preventDefault(); handleRenameEmbed(e.target.elements.embedName.value); }}> <h3 className="text-lg font-semibold">Переименовать Embed</h3> <input name="embedName" type="text" defaultValue={renamingEmbed.name} className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.form.requestSubmit() }} /> <div className="flex justify-end gap-2"> <button type="button" onClick={() => setRenamingEmbed(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button> </div> </form> </Modal> )}
      {!previewMode && currentBtn && ( <Modal onClose={() => setEditingBtn(null)}> <ButtonEditor initial={currentBtn.data} onSave={(patch) => { updateButton(currentBtn.blockId, currentBtn.data.id, patch); setEditingBtn(null); }} onDelete={() => deleteButton(currentBtn.blockId, currentBtn.data.id)} embeds={embeds} currentEmbedId={activeEmbedId}  customEmojis={customEmojis} /> </Modal> )}
      {!previewMode && editingHrId && ( <Modal onClose={() => setEditingHrId(null)}> <div className="space-y-4"> <h3 className="text-base font-semibold">Горизонтальная линия</h3> <p className="text-sm opacity-80">Удалить этот блок?</p> <div className="flex justify-end gap-2"> <button className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm" onClick={()=>setEditingHrId(null)}>Отмена</button> <button className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm" onClick={()=>deleteHr(editingHrId)}>Удалить</button> </div> </div> </Modal> )}
      {!previewMode && currentText && ( <Modal onClose={() => setEditingTextId(null)}> <TextEditor customEmojis={customEmojis} initial={currentText} onSave={(patch) => { modifyItems(prev => prev.map((it) => it.id === currentText.id ? { ...it, ...patch } : it)); setEditingTextId(null); }} onDelete={() => deleteText(currentText.id)} /> </Modal> )}
      
            {!previewMode && currentList && (
        <Modal contentClassName="w-[760px] max-w-[95vw]" onClose={() => setEditingListId(null)}>
          <form className="space-y-4 w-full" onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const placeholder = form.elements.placeholder?.value || "";
            const titles = Array.from(form.querySelectorAll('[name="li_title"]')).map(i => i.value);
            const descs  = Array.from(form.querySelectorAll('[name="li_desc"]')).map(i => i.value);
            const emojis = Array.from(form.querySelectorAll('[name="li_emoji"]')).map(i => i.value);
            const defs  = Array.from(form.querySelectorAll('[name="li_default"]')).map(i => i.checked ? '1' : '');
            const items = titles.map((t, i) => `${t}|${descs[i] || ''}|${emojis[i] || ''}|${defs[i] || ''}`);
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
    <div class="flex items-center gap-2">
      <input name="li_title" type="text" placeholder="Заголовок" class="flex-1 rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none" />
      <label class="inline-flex items-center gap-2 text-xs shrink-0">
        <input name="li_default" type="checkbox" onclick="(function(el){ var form=el.closest('form'); if(form) Array.prototype.forEach.call(form.querySelectorAll('input[name=li_default]'), function(c){ if(c!==el) c.checked=false; }); })(this)" />
        По умолчанию
      </label>
    </div>
    <input name="li_desc" type="text" placeholder="Описание (опционально)" class="w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none" />
    <div class="flex items-center gap-2">
      <input name="li_emoji" type="text" placeholder="URL эмодзи" class="flex-1 rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none" />
      <button type="button" class="px-2 py-2 rounded-md bg-red-600 hover:bg-red-700 text-xs remove-item">Удалить</button>
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
                  const [t='', d='', e='', def=''] = String(raw).split('|');
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
                      </div>
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

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => deleteList(currentList.id)} className="px-3 py-2 rounded-md bg-red-700 hover:bg-red-600 text-sm">Удалить блок</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingListId(null)} className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button>
                <button type="submit" className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
{!previewMode && currentTextWithButton && ( <Modal onClose={() => setEditingTextWithButtonId(null)}> <TextWithButtonEditor initial={currentTextWithButton} onSave={(patch) => { modifyItems(prev => prev.map((it) => it.id === currentTextWithButton.id ? { ...it, ...patch } : it)); setEditingTextWithButtonId(null); }} onDelete={() => deleteTextWithButton(currentTextWithButton.id)} embeds={embeds} currentEmbedId={activeEmbedId}  customEmojis={customEmojis} /> </Modal> )}
    </div>
  );
}

function MessageRow({ colors, children, footer }) {
  return (
    <div className="w-full">
      {/* Центрируем всю связку: аватарка + контентная колонка */}
      <div className="flex justify-center">
        <div className="flex items-start gap-3">
          {/* Аватар */}
          <div
            className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-bold"
            style={{ backgroundColor: "#94db6b", color: "#2B2D31" }}
          >
            R
          </div>

          {/* Контентная колонка фиксированной ширины */}
          <div className="min-w-0" style={{ width: "680px", maxWidth: "680px" }}>
            {/* Имя + время в одну линию, как в Discord */}
            <div className="mb-2 text-sm">
              <span style={{ color: "#94db6b", fontWeight: 500 }}>Rustify</span>{" "}
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



function EmbedSidebar({
  embeds,
  activeEmbedId,
  setActiveEmbedId,
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
      console.warn('onChangeParent prop is not provided to EmbedSidebar');
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
            onClick={() => setActiveEmbedId(node.id)}
            onDoubleClick={() => openSettings(node)}
            className={`flex-1 text-left px-3 py-1.5 rounded-md border border-[#202225] transition ${
              isActive ? 'bg-[#5865F2] text-white' : 'bg-[#3a3c41] text-white/80 hover:bg-[#4a4e55]'
            }`}
            title={(node.name || 'Без названия') + ' — ПКМ для настроек'}
            style={{ marginLeft: depth ? 4 : 0 }}
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
            className="h-9 px-3 rounded-md bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 text-sm font-medium"
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
  className="h-8 rounded-md px-2 text-sm flex items-center justify-center leading-none bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
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
  className="h-8 rounded-md px-2 text-sm flex items-center justify-center leading-none bg-[#3a3c41] hover:bg-[#4a4e55] text-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white col-span-2 flex items-center justify-center leading-none"
                onClick={() => { onDeleteClick && onDeleteClick(settingsNode); closeSettings(); }}
              >Удалить эмбед</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
function EmbedCanvas({ colors, items, customEmojis, selectedBlockId, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingBtn, setEditingHrId, setEditingTextId, setEditingTextWithButtonId, setEditingListId, previewMode, onAddButton, onReorderButtons, onEmbedLinkClick , onMoveBlock }) {

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
            <div
              key={it.id}
              draggable={!previewMode}
              onDragStart={onDragStart(idx)}
              onDragOver={onDragOver(idx)}
              onDrop={onDrop(idx)}
              onDragEnd={onDragEnd}
              className={`relative w-full overflow-hidden rounded-[8px] select-none ${isSelected ? 'ring-2 ring-indigo-500/70' : ''} ${idx > 0 ? 'mt-3' : ''}`}
              onClick={() => { if (!previewMode) setSelectedBlockId(it.id); }}
              style={{ cursor: previewMode ? 'default' : 'grab' }}
            >
              {overlay}
              <img src={it.url} alt="Embed media" className="block w-full h-auto" style={{ objectFit: 'contain', objectPosition: 'center' }} draggable={false} />
              {!previewMode && (
                <div className="absolute inset-0 pointer-events-none rounded-[8px]" style={{ outline: (isSelected ? '2px solid rgba(99,102,241,0.7)' : 'none') }} />
              )}
            </div>
          );
        case "buttons":
          return (
            <div key={it.id} className="relative">
              {overlay}
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
                onAddButton={onAddButton}
                onReorderButtons={onReorderButtons}
                onEmbedLinkClick={onEmbedLinkClick}
              />
            </div>
          );
        case "text":
          return (
            <div key={it.id} className="relative">
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
                setEditingTextId={setEditingTextId}
                previewMode={previewMode}
              />
            </div>
          );
        case "text-with-button":
          return (
            <div key={it.id} className="relative">
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
                setEditingTextWithButtonId={setEditingTextWithButtonId}
                previewMode={previewMode}
                onEmbedLinkClick={onEmbedLinkClick}
              />
            </div>
          );
        case "list":
          return (
            <div key={it.id} className="relative"
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
        previewMode={previewMode}
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

function ButtonsBlock({ idx, block, colors, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingBtn, previewMode, onAddButton, onReorderButtons, onEmbedLinkClick }) {
  const buttons = Array.isArray(block.buttons) ? block.buttons : [];
  const [btnDragIndex, setBtnDragIndex] = React.useState(null);
  const [btnOverIndex, setBtnOverIndex] = React.useState(null);
  const handleBtnDragStart = (bi) => (e) => { if (previewMode) return; e.stopPropagation(); setBtnDragIndex(bi); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(bi)); };
  const handleBtnDragOver = (bi) => (e) => { if (previewMode) return; e.preventDefault(); e.stopPropagation(); setBtnOverIndex(bi); };
  const handleBtnDrop = (bi) => (e) => { if (previewMode) return; e.preventDefault(); e.stopPropagation(); const from = btnDragIndex; const to = bi; setBtnDragIndex(null); setBtnOverIndex(null); if (from === null || to === null || from === to) return; onReorderButtons?.(block.id, from, to); };
  const handleBtnDragEnd = () => { setBtnDragIndex(null); setBtnOverIndex(null); };
  return ( <div draggable={!previewMode} onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} onDragEnd={onDragEnd} className={`mt-3 rounded-md ${selected? 'ring-2 ring-indigo-500/70' : ''} bg-transparent`} onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(block.id); } }} style={{ cursor: previewMode ? 'default' : 'grab' }} > <div className="flex flex-wrap items-center gap-2"> {buttons.map((b, bi) => ( <div key={b?.id || bi} draggable={!previewMode} onDragStart={handleBtnDragStart(bi)} onDragOver={handleBtnDragOver(bi)} onDrop={handleBtnDrop(bi)} onDragEnd={handleBtnDragEnd} onClick={(e)=>e.stopPropagation()} className={`${btnOverIndex===bi && btnDragIndex!==null ? 'outline outline-2 outline-indigo-500/60 rounded-md' : ''}`} style={{ cursor: previewMode ? 'default' : 'grab' }} > <ButtonChip btn={b} colors={colors} onEdit={() => setEditingBtn({ blockId: block.id, btnId: b?.id })} previewMode={previewMode} onEmbedLinkClick={onEmbedLinkClick} /> </div> ))} {!previewMode && selected && ( <button type="button" onClick={(e) => { e.stopPropagation(); onAddButton?.(block.id); }} className="h-9 px-3 rounded-md border border-dashed border-white/20 text-xs text-white/70 hover:text-white hover:border-white/40" title="Добавить кнопку" > <span className="inline-flex items-center gap-1"> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/> </svg> Добавить </span> </button> )} </div> </div> );
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

function ListBlock({ idx, block, colors, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingListId, previewMode }) {
  const [open, setOpen] = React.useState(false);
  const parse = (s) => {
    if (typeof s !== 'string') return { title: String(s), desc: '', emoji: '' };
    const parts = s.split('|');
    const selRaw = (parts[3]||'').trim().toLowerCase();
    const sel = selRaw === '1' || selRaw === 'true' || selRaw === 'yes' || selRaw === '*';
    return { title: (parts[0]||'').trim(), desc: (parts[1]||'').trim(), emoji: (parts[2]||'').trim(), sel };
  };
  const items = Array.isArray(block.listItems) ? block.listItems : [];
  const placeholder = block.placeholder || "Выберите вариант";
  return (
    <div
      draggable={!previewMode && true}
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
            <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-[#2b2d31] transition-colors">
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
  return ( <div draggable={!previewMode} onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} onDragEnd={onDragEnd} className={`mt-3 rounded-md ${selected? 'ring-2 ring-indigo-500/70' : ''} bg-transparent`} onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(block.id); setEditingTextId(block.id); } }} style={{ cursor: previewMode ? 'default' : 'grab' }} > <TextBlockView block={block} customEmojis={customEmojis} /> </div> );
}

function TextWithButtonBlock({ idx, block, colors, customEmojis, selected, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingTextWithButtonId, previewMode, onEmbedLinkClick }) {
    return (
        <div
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
                    setEditingTextWithButtonId(block.id);
                }
            }}
            style={{ cursor: previewMode ? 'default' : 'grab' }}
        >
            <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <TextBlockView block={block} customEmojis={customEmojis} />
                </div>
                <div className="flex-shrink-0 self-start">
                    <ButtonChip btn={block.button} colors={colors} previewMode={previewMode} onEmbedLinkClick={onEmbedLinkClick} />
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
    md = md.replace(/<p><!--dc-subtext-->\s*((?:<img[^>]*>\s*)*)([\s\S]*?)<\/p>/g,
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
                   [&_h3]:text-[19px] [&_h3]:leading-[27px] [&_h3]:font-medium   [&_h3]:my-[2px]
                   [&_.dc-subtext]:text-[12px] [&_.dc-subtext]:leading-[20px]
                   [&_a]:text-[#94db6b] hover:[&_a]:underline
                   [&_code]:bg-[#1e1f22] [&_code]:px-[4px] [&_code]:py-[2px] [&_code]:rounded-md"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hasThumb && (
        <div className="w-[92px] h-[92px] rounded-lg overflow-hidden border border-[#202225] shrink-0">
          <img src={block.thumbUrl} alt="thumb" className="w-full h-full object-cover" />
        </div>
      )}
    </div>);
}

function ButtonChip({ btn, colors, onEdit, previewMode, onEmbedLinkClick }) {
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
      e.stopPropagation();
      // Ctrl+Click: всегда вести, даже в режиме редактирования
      if (e && e.ctrlKey) {
        if (safeBtn.linkToEmbedId) {
          onEmbedLinkClick?.(safeBtn.linkToEmbedId);
        }
        return;
      }
      if (previewMode) {
          if (safeBtn.linkToEmbedId) {
              onEmbedLinkClick?.(safeBtn.linkToEmbedId);
          }
      } else {
          onEdit?.();
      }
  };

  return ( <button className={`${base} ${visual}${inactive}${interactive}`} onClick={handleClick} onMouseDown={(e) => { if (!previewMode) e.stopPropagation(); }} type="button" > {leftEmojiUrl && <img src={leftEmojiUrl} alt="" className="h-5 w-5 mr-2" />} {label} {style === 'link' && ( <svg className="h-4 w-4 ml-2 opacity-80" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> </svg> )} {style !== 'link' && rightEmojiUrl && <img src={rightEmojiUrl} alt="" className="h-5 w-5 ml-2" />} </button> );
}

function Modal({ children, onClose, contentClassName }) {
  const overlayRef = useRef(null);
  const mouseDownOnOverlay = useRef(false);
  return ( <div className="fixed inset-0 z-50 flex items-center justify-center"> <div ref={overlayRef} className="absolute inset-0 bg-black/50" onMouseDown={(e) => { if (e.target === overlayRef.current) mouseDownOnOverlay.current = true; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === overlayRef.current) { onClose?.(); } mouseDownOnOverlay.current = false; }} /> <div className={`relative ${contentClassName || "w-full max-w-md"} rounded-xl bg-[#2B2D31] border border-[#202225] p-4 shadow-xl`} onMouseDown={(e)=>e.stopPropagation()} onMouseUp={(e)=>e.stopPropagation()}> {children} </div> </div> );
}

function ButtonEditor({  initial, onSave, onDelete, embeds, currentEmbedId , customEmojis = [] }) {
  const { isReadOnlyDev } = React.useContext(AuthUiContext);
const [label, setLabel] = useState(initial?.label || "");
  const [leftEmojiUrl, setLeftEmojiUrl] = useState(initial?.leftEmojiUrl || "");
  const [style, setStyle] = useState((['primary','success','danger','link','secondary'].includes(initial?.style) ? initial.style : 'secondary'));
  const [active, setActive] = useState(initial?.active !== false);
  const [linkToEmbedId, setLinkToEmbedId] = useState(initial?.linkToEmbedId || "");

  const otherEmbeds = embeds.filter(e => e.id !== currentEmbedId);

  return ( <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave?.({ label, leftEmojiUrl, style, active, linkToEmbedId }); }} > <h3 className="text-base font-semibold">Настройки кнопки</h3> <div> <label className="text-xs uppercase tracking-wide opacity-70">Название кнопки</label> <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" /> </div>
                    
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
                            onWheel={(e)=>{ e.preventDefault(); e.stopPropagation(); if(e.deltaY){ e.currentTarget.scrollLeft += e.deltaY * 3; } }}
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
 </select> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Тип</label> <select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"> <option value="inactive">Неактивная</option> <option value="active">Активная</option> </select> </div> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Переход на Embed</label> <select value={linkToEmbedId} onChange={(e) => setLinkToEmbedId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" disabled={otherEmbeds.length === 0}> <option value="">Нет</option> {otherEmbeds.map(embed => <option key={embed.id} value={embed.id}>{embed.name}</option>)} </select> </div> <div className="flex items-center justify-between pt-2"> <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium">Удалить</button> <button type="submit" className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button> </div> </form> );
}



function TextEditor({ initial, onSave, onDelete, customEmojis = [] }) {
  const [content, setContent] = React.useState(initial?.content || '');
  const [thumbUrl, setThumbUrl] = React.useState(initial?.thumbUrl || '');
  const taRef = React.useRef(null);

  const handleSave = (e) => {
    e.preventDefault();
    onSave?.({ content, thumbUrl });
  };

  return (
    <form className="space-y-4" onSubmit={handleSave}>
      <h3 className="text-base font-semibold">Текстовый блок</h3>
      <div>
        <label className="text-xs uppercase tracking-wide opacity-70">Содержимое (Markdown/Discord)</label>
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
          onWheel={(e)=>{ e.preventDefault(); e.stopPropagation(); if(e.deltaY){ e.currentTarget.scrollLeft += e.deltaY * 3; } }}
        >
          {Array.isArray(customEmojis) && customEmojis.length > 0 ? (
            customEmojis.map((emoji) => {
              let srcUrl = (emoji && (emoji.url || emoji.src || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
              if (!srcUrl) { console.warn('[Emoji] empty src for', emoji); return null; }
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
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80 active:scale-95 transition bg-transparent hover:ring-1 hover:ring-white/20"
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
        <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm">Сохранить</button>
      </div>
    </form>
  );
}

function TextWithButtonEditor({ initial, onSave, onDelete, embeds, currentEmbedId, customEmojis = [] }) {
  const { isReadOnlyDev } = React.useContext(AuthUiContext);
    const [content, setContent] = useState(initial?.content || '');
    const [button, setButton] = useState(initial?.button || sanitizeButton({}));
    
    
    const taRef = useRef(null);
const otherEmbeds = embeds.filter(e => e.id !== currentEmbedId);

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
                    onWheel={(e)=>{ e.preventDefault(); e.stopPropagation(); if(e.deltaY){ e.currentTarget.scrollLeft += e.deltaY * 3; } }}
                  >
                    {Array.isArray(customEmojis) && customEmojis.length > 0 ? (
                      customEmojis.map((emoji) => {
                        let srcUrl = (emoji && (emoji.url || emoji.src || emoji.imageUrl || emoji.leftEmojiUrl || emoji.rightEmojiUrl)) || '';
                        if (!srcUrl) { console.warn('[Emoji] empty src for', emoji); return null; }
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
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80 active:scale-95 transition bg-transparent hover:ring-1 hover:ring-white/20"
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
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium">Удалить блок</button>
                <button type="submit" className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"> {isReadOnlyDev ? "Только чтение" : "Сохранить"} </button>
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
      <div className="flex justify-between">
        <button type="button" onClick={addItem} className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Добавить пункт</button>
        <div className="flex gap-2">
          <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm">Удалить блок</button>
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
              className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-xs"
              title="Выйти из режима выделения"
            >
              Отмена
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="px-3 py-1.5 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-xs"
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
              className={`rounded-lg border ${activeId===c.id ? 'border-indigo-500' : 'border-[#202225]'} bg-[#94db6b14] p-2 min-h-[120px]`}
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
                ${showAll ? 'bg-indigo-500 justify-end' : 'bg-white/10 justify-start'} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
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

function GateApp() {

  const authUser = useAuthUser();
  const onLogout = React.useCallback(async () => { try { await signOut(firebaseAuth); 
  // update global read-only flag for module-scoped editors
  isReadOnlyDev = !!(authUser && (authUser.uid === DEV_UID || authUser.email === DEV_EMAIL));
} catch(_) {} }, []);
  if (REQUIRE_AUTH && !authUser) return <LoginForm />;

  // Render mini-profile above Comments via a fixed container at the top of the app;
  // since we can't safely inject into InnerApp, we use a portal-like banner.
  return (
    <div className="min-h-screen bg-[#1E1F22] text-[#DBDEE1]">
      <ToastHost />

      {/* Global top spacer to keep layout similar */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        </div>
      <AuthUiContext.Provider value={{ user: authUser, onLogout }}>
        <InnerApp />
      </AuthUiContext.Provider>
    </div>
  );
}

export default GateApp;
