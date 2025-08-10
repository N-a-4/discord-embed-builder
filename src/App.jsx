import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApps, getApp } from "firebase/app";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import app from "../firebase.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

// --- Firebase Config (placeholders, will be populated by the environment) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


// --- Types (JSDoc) ---
/** @typedef {{ id: string, type: 'image', url: string }} ImageItem */
/** @typedef {{ id: string, label?: string, leftEmojiUrl?: string, rightEmojiUrl?: string, emojiUrl?: string, style?: 'secondary'|'link', active?: boolean, linkToEmbedId?: string }} Btn */
/** @typedef {{ id: string, type: 'buttons', buttons: Btn[] }} ButtonsItem */
/** @typedef {{ id: string, type: 'hr' }} HrItem */
/** @typedef {{ id: string, type: 'text', content: string, thumbUrl?: string }} TextItem */
/** @typedef {{ id: string, type: 'text-with-button', content: string, button: Btn }} TextWithButtonItem */
/** @typedef {(ImageItem|ButtonsItem|HrItem|TextItem|TextWithButtonItem)} Item */
/** @typedef {{ name: string, url: string }} CustomEmoji */
/** @typedef {{ id: string, name: string, items: Item[], imageUrl: string }} Embed */
/** @typedef {{ id: string, embeds: Embed[], activeEmbedId: string, customEmojis: CustomEmoji[] }} SaveState */

// --- Data Sanitization ---
const sanitizeButton = (btn) => ({
    id: btn.id || `btn-${Date.now()}`,
    label: btn.label || "",
    leftEmojiUrl: btn.leftEmojiUrl || "",
    rightEmojiUrl: btn.rightEmojiUrl || "",
    style: btn.style === 'link' ? 'link' : 'secondary',
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
            case 'text':
                return { ...item, content: item.content || "", thumbUrl: item.thumbUrl || "" };
            case 'text-with-button':
                return { ...item, content: item.content || "", button: sanitizeButton(item.button || {}) };
            default:
                return item;
        }
    }).filter(Boolean); // Filter out null items
};

const sanitizeEmbed = (embed) => {
    if (!embed) return null;
    const imageUrl = embed.imageUrl || "";
    return {
        id: embed.id || `embed-${Date.now()}`,
        name: embed.name || "Untitled Embed",
        items: sanitizeItems(embed.items, imageUrl),
        imageUrl: imageUrl,
    };
}


// --- Default initial state for first-time users ---
const createDefaultEmbed = (name = "Главный эмбед") => {
    const defaultImageUrl = "https://media.discordapp.net/attachments/1387360706835513344/1403710343938834513/vidget.png?ex=68988aa1&is=68973921&hm=3e17e3665ac8b6f520167cbed22629cda3274a572bacee0ca293541ce8c4143a&&format=webp&quality=lossless&width=1100&height=330";
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


export default function App() {
  // --- Firebase State ---
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('initializing'); // 'initializing', 'loading', 'ready', 'error'
  const savesCollectionRef = useRef(null);
  
  // --- Save/Load State ---
  const [savedStates, setSavedStates] = useState/** @type {SaveState[]} */([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
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

  // --- Derived State ---
  const currentEmbed = useMemo(() => embeds.find(e => e.id === activeEmbedId) || embeds[0], [embeds, activeEmbedId]);

  const updateCurrentEmbed = (patch) => {
      setEmbeds(prev => prev.map(e => e.id === activeEmbedId ? { ...e, ...patch } : e));
  };
  
  // --- Local UI State ---
  const [newEmojiName, setNewEmojiName] = useState('');
  const [newEmojiUrl, setNewEmojiUrl] = useState('');


  // --- Effects for Firebase ---
  useEffect(() => {
    if (Object.keys(firebaseConfig).length > 0) {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);
        setDb(firestore);

        onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                setUserId(user.uid);
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
    if (!userId || !db) return;

    setLoadingStatus('loading');
    const path = `artifacts/${appId}/users/${userId}/embedBuilderSaves`;
    savesCollectionRef.current = collection(db, path);
    
    const unsubscribe = onSnapshot(savesCollectionRef.current, (snapshot) => {
        const saves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSavedStates(saves);
        setLoadingStatus('ready');
    }, (error) => {
        console.error("Failed to fetch saved states:", error);
        setLoadingStatus('error');
    });

    return () => unsubscribe();
  }, [userId, db]);

  // Sync banner image URL with the image block inside items
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
  const handleSave = async () => {
      if (!saveName.trim() || !savesCollectionRef.current) return;
      const docRef = doc(savesCollectionRef.current, saveName.trim());
      const payload = {
          embeds: embeds.map(sanitizeEmbed).filter(Boolean),
          activeEmbedId,
          customEmojis,
      };
      try {
          await setDoc(docRef, payload);
          setStatusMessage(`Проект "${saveName.trim()}" успешно сохранен!`);
          setCurrentSaveName(saveName.trim());
      } catch (error) {
          console.error("Failed to save state:", error);
          setStatusMessage("Ошибка сохранения.");
      }
      setShowSaveModal(false);
      setTimeout(() => setStatusMessage(""), 3000);
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
                imageUrl: stateToLoad.imageUrl || "",
            };
            setEmbeds([sanitizeEmbed(convertedEmbed)].filter(Boolean));
            setActiveEmbedId(convertedEmbed.id);
        } else {
            const loadedEmbeds = Array.isArray(stateToLoad.embeds) ? stateToLoad.embeds.map(sanitizeEmbed).filter(Boolean) : [];
            if (loadedEmbeds.length > 0) {
                setEmbeds(loadedEmbeds);
                setActiveEmbedId(stateToLoad.activeEmbedId || loadedEmbeds[0].id);
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

  const handleDelete = async () => {
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
      if (!savesCollectionRef.current) return;
      setIsRefreshing(true);
      try {
          const snapshot = await getDocs(savesCollectionRef.current);
          const saves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSavedStates(saves);
      } catch (error) {
          console.error("Manual refresh failed", error);
      }
      setIsRefreshing(false);
  };
  
  const handleAddNewEmbed = () => {
      if (!newEmbedName.trim()) return;
      const newEmbed = createDefaultEmbed(newEmbedName.trim());
      setEmbeds(prev => [...prev, newEmbed]);
      setActiveEmbedId(newEmbed.id);
      setNewEmbedName("");
      setShowNewEmbedModal(false);
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
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [embedDragIndex, setEmbedDragIndex] = useState(null);

  // Selection & edit state
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [editingBtn, setEditingBtn] = useState(null);
  const [editingHrId, setEditingHrId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [editingTextWithButtonId, setEditingTextWithButtonId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const colors = useMemo(
    () => ({
      appBg: "bg-[#1E1F22]",
      panelBg: "bg-[#1A1B1E]",
      embedBg: "bg-[#2B2D31]",
      text: "text-[#DBDEE1]",
      border: "border-[#202225]",
      accent: "bg-[#424249]",
      subtle: "text-[#A3A6AA]",
      rustify: "#94db6b",
      secondaryBtn: "bg-[#4f545c] hover:bg-[#5d6269]",
      linkBtn: "bg-[#5865F2] hover:bg-[#4752C4] text-white",
    }),
    []
  );

  // --- Block Manipulation ---
  const modifyItems = (modifier) => {
      updateCurrentEmbed({ items: modifier(currentEmbed.items || []) });
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
          
          <div className="flex justify-between items-center mb-3">
              <EmbedTabs 
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
              />
              <div className="flex items-center gap-2 text-xs opacity-90" onClick={(e)=>e.stopPropagation()}>
                <span className="opacity-70">Предпросмотр</span>
                <button
                  onClick={() => setPreviewMode((v) => !v)}
                  className={`h-6 px-2 rounded-md border ${colors.border} ${previewMode ? 'bg-[#5865F2] text-white' : 'bg-transparent'} transition`}
                  title="Вкл/Выкл предпросмотр"
                >
                  {previewMode ? 'Вкл' : 'Выкл'}
                </button>
              </div>
          </div>

          <MessageRow colors={colors}>
            <EmbedCanvas
              key={activeEmbedId} // Force re-render on tab change
              colors={colors}
              items={currentEmbed.items}
              customEmojis={customEmojis}
              selectedBlockId={selectedBlockId}
              setSelectedBlockId={setSelectedBlockId}
              onDragStart={(idx) => (e) => { if (previewMode) return; setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); }}
              onDragOver={(idx) => (e) => { if (previewMode) return; e.preventDefault(); setOverIndex(idx); }}
              onDrop={onDrop}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              setEditingBtn={setEditingBtn}
              setEditingHrId={setEditingHrId}
              setEditingTextId={setEditingTextId}
              setEditingTextWithButtonId={setEditingTextWithButtonId}
              previewMode={previewMode}
              onAddButton={addButtonToBlock}
              onReorderButtons={onReorderButtons}
              onEmbedLinkClick={setActiveEmbedId}
            />
          </MessageRow>
        </div>
      </div>

      {/* Control panel */}
      <div className={`w-full rounded-2xl ${colors.panelBg} border ${colors.border} shadow-lg p-4`} onClick={(e)=>e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Панель управления</h2>
           <div className="flex items-center gap-2">
               <button onClick={() => { setSaveName(currentSaveName); setShowSaveModal(true); }} className="h-9 px-4 rounded-md bg-green-600 hover:bg-green-700 text-sm font-medium disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={loadingStatus !== 'ready'}>
                   {loadingStatus !== 'ready' ? 'Загрузка...' : 'Сохранить'}
               </button>
               <button onClick={() => setShowLoadModal(true)} className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={loadingStatus !== 'ready'}>
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
          </div>
        </div>

        {/* Custom Emojis Section */}
        <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide opacity-80 mb-3">Глобальные Эмодзи</h3>
            <div className="space-y-2 mb-4 max-h-32 overflow-y-auto pr-2">
                {customEmojis.length > 0 ? customEmojis.map(emoji => (
                <div key={emoji.name} className="flex items-center justify-between bg-[#2B2D31] p-2 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                    <img src={emoji.url} alt={emoji.name} className="w-6 h-6 rounded" />
                    <span className="font-mono text-white/90">:{emoji.name}:</span>
                    </div>
                    <button onClick={() => deleteCustomEmoji(emoji.name)} className="text-xs text-red-500 hover:text-red-400 font-semibold">Удалить</button>
                </div>
                )) : <p className="text-xs text-white/50">Пока нет добавленных эмодзи.</p>}
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

        <div className="mt-4 pt-4 border-t border-white/10">
            <button onClick={() => setShowNewEmbedModal(true)} className="w-full h-9 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">Новый Embed</button>
        </div>
      </div>

      {/* Modals */}
      {showSaveModal && ( <Modal onClose={() => setShowSaveModal(false)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Сохранить проект</h3> <p className="text-sm text-white/70">Введите имя для вашего сохранения. Если имя уже существует, данные будут перезаписаны.</p> <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Имя моего проекта" className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} /> <div className="flex justify-end gap-2"> <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={handleSave} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm">Сохранить</button> </div> </div> </Modal> )}
      {showLoadModal && ( <Modal onClose={() => setShowLoadModal(false)}> <div className="space-y-4"> <div className="flex items-center justify-between mb-2"> <h3 className="text-lg font-semibold">Загрузить проект</h3> <button onClick={handleRefreshSaves} className="px-3 py-1 text-xs rounded-md bg-gray-600 hover:bg-gray-500 disabled:opacity-50 transition-colors" disabled={isRefreshing}> {isRefreshing ? 'Обновление...' : 'Обновить'} </button> </div> <div className="space-y-2 max-h-64 overflow-y-auto pr-2"> {loadingStatus === 'loading' && <p className="text-sm text-white/50">Загрузка сохранений...</p>} {loadingStatus === 'error' && <p className="text-sm text-red-400">Ошибка загрузки.</p>} {loadingStatus === 'ready' && savedStates.length > 0 ? savedStates.map(state => ( <div key={state.id} className="flex items-center justify-between bg-[#202225] p-2 rounded-lg"> <span className="text-sm">{state.id}</span> <div className="flex gap-2"> <button onClick={() => handleLoad(state)} className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700">Загрузить</button> <button onClick={() => { setShowLoadModal(false); setDeleteConfirmId(state.id); }} className="px-3 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700">Удалить</button> </div> </div> )) : null} {loadingStatus === 'ready' && savedStates.length === 0 && <p className="text-sm text-white/50">Нет сохраненных проектов.</p>} </div> <div className="flex justify-end"> <button onClick={() => setShowLoadModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Закрыть</button> </div> </div> </Modal> )}
      {deleteConfirmId && ( <Modal onClose={() => setDeleteConfirmId(null)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Подтверждение</h3> <p className="text-sm text-white/70">Вы уверены, что хотите удалить проект "{deleteConfirmId}"? Это действие необратимо.</p> <div className="flex justify-end gap-2"> <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={handleDelete} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm">Удалить</button> </div> </div> </Modal> )}
      {showNewEmbedModal && ( <Modal onClose={() => setShowNewEmbedModal(false)}> <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleAddNewEmbed(); }}> <h3 className="text-lg font-semibold">Создать новый Embed</h3> <p className="text-sm text-white/70">Введите название для нового встраиваемого блока.</p> <input type="text" value={newEmbedName} onChange={(e) => setNewEmbedName(e.target.value)} placeholder="Название Embed'а" className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} autoFocus /> <div className="flex justify-end gap-2"> <button type="button" onClick={() => setShowNewEmbedModal(false)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm">Создать</button> </div> </form> </Modal> )}
      {deletingEmbed && ( <Modal onClose={() => setDeletingEmbed(null)}> <div className="space-y-4"> <h3 className="text-lg font-semibold">Удалить Embed?</h3> <p className="text-sm text-white/70">Вы уверены, что хотите удалить эмбед "{deletingEmbed.name}"? Это действие нельзя будет отменить.</p> <div className="flex justify-end gap-2"> <button onClick={() => setDeletingEmbed(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button onClick={handleDeleteEmbed} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm">Удалить</button> </div> </div> </Modal> )}
      {renamingEmbed && ( <Modal onClose={() => setRenamingEmbed(null)}> <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleRenameEmbed(e.target.elements.embedName.value); }}> <h3 className="text-lg font-semibold">Переименовать Embed</h3> <input name="embedName" type="text" defaultValue={renamingEmbed.name} className={`w-full rounded-lg border ${colors.border} bg-transparent px-3 py-2 text-sm outline-none`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.form.requestSubmit() }} /> <div className="flex justify-end gap-2"> <button type="button" onClick={() => setRenamingEmbed(null)} className="px-4 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm">Отмена</button> <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm">Сохранить</button> </div> </form> </Modal> )}
      {!previewMode && currentBtn && ( <Modal onClose={() => setEditingBtn(null)}> <ButtonEditor initial={currentBtn.data} onSave={(patch) => { updateButton(currentBtn.blockId, currentBtn.data.id, patch); setEditingBtn(null); }} onDelete={() => deleteButton(currentBtn.blockId, currentBtn.data.id)} embeds={embeds} currentEmbedId={activeEmbedId} /> </Modal> )}
      {!previewMode && editingHrId && ( <Modal onClose={() => setEditingHrId(null)}> <div className="space-y-4"> <h3 className="text-base font-semibold">Горизонтальная линия</h3> <p className="text-sm opacity-80">Удалить этот блок?</p> <div className="flex justify-end gap-2"> <button className="px-3 py-2 rounded-md bg-[#4f545c] hover:bg-[#5d6269] text-sm" onClick={()=>setEditingHrId(null)}>Отмена</button> <button className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm" onClick={()=>deleteHr(editingHrId)}>Удалить</button> </div> </div> </Modal> )}
      {!previewMode && currentText && ( <Modal onClose={() => setEditingTextId(null)}> <TextEditor initial={currentText} onSave={(patch) => { modifyItems(prev => prev.map((it) => it.id === currentText.id ? { ...it, ...patch } : it)); setEditingTextId(null); }} onDelete={() => deleteText(currentText.id)} /> </Modal> )}
      {!previewMode && currentTextWithButton && ( <Modal onClose={() => setEditingTextWithButtonId(null)}> <TextWithButtonEditor initial={currentTextWithButton} onSave={(patch) => { modifyItems(prev => prev.map((it) => it.id === currentTextWithButton.id ? { ...it, ...patch } : it)); setEditingTextWithButtonId(null); }} onDelete={() => deleteTextWithButton(currentTextWithButton.id)} embeds={embeds} currentEmbedId={activeEmbedId} /> </Modal> )}
    </div>
  );
}


function MessageRow({ colors, children }) {
  return (
    <div className="w-full" onClick={(e)=>e.stopPropagation()}>
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
          </div>
        </div>
      </div>
    </div>
  );
}


function EmbedTabs({ embeds, activeEmbedId, setActiveEmbedId, onDeleteClick, onReorder, onRenameClick }) {
    const [dragIndex, setDragIndex] = useState(null);

    const handleDragStart = (e, index) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        onReorder(dragIndex, index);
        setDragIndex(index);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {embeds.map((embed, index) => (
                <div
                    key={embed.id}
                    draggable
                    onClick={() => setActiveEmbedId(embed.id)}
                    onDoubleClick={() => onRenameClick(embed)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    title="Двойной клик для переименования"
                    className={`flex items-center gap-2 pl-3 pr-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                        activeEmbedId === embed.id 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-[#3a3c41] text-white/70 hover:bg-[#4a4e55]'
                    }`}
                >
                    <span>{embed.name}</span>
                    {embeds.length > 1 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteClick(embed); }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/20 transition-colors"
                            title={`Удалить ${embed.name}`}
                        >
                            &#x2715;
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

function EmbedCanvas({ colors, items, customEmojis, selectedBlockId, setSelectedBlockId, onDragStart, onDragOver, onDrop, onDragEnd, setEditingBtn, setEditingHrId, setEditingTextId, setEditingTextWithButtonId, previewMode, onAddButton, onReorderButtons, onEmbedLinkClick }) {
  return ( <div className="w-full" onClick={(e)=>e.stopPropagation()}> {items.map((it, idx) => { if (!it) return null; switch (it.type) { case "image": return ( <div key={it.id} draggable={!previewMode} onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} onDragEnd={onDragEnd} className={`relative w-full overflow-hidden rounded-[8px] select-none ${!previewMode && selectedBlockId === it.id ? 'ring-2 ring-indigo-500/70' : ''} ${idx > 0 ? 'mt-3' : ''}`} onClick={() => { if (!previewMode) setSelectedBlockId(it.id); }} style={{ cursor: previewMode ? 'default' : 'grab' }} > <img src={it.url} alt="Embed media" className="block w-full h-auto" style={{ objectFit: 'contain', objectPosition: 'center' }} draggable={false} /> {!previewMode && ( <div className="absolute inset-0 pointer-events-none rounded-[8px]" style={{ outline: (selectedBlockId === it.id ? '2px solid rgba(99,102,241,0.7)' : 'none') }} /> )} </div> ); case "buttons": return ( <ButtonsBlock key={it.id} idx={idx} block={it} colors={colors} selected={!previewMode && selectedBlockId === it.id} setSelectedBlockId={setSelectedBlockId} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} setEditingBtn={setEditingBtn} previewMode={previewMode} onAddButton={onAddButton} onReorderButtons={onReorderButtons} onEmbedLinkClick={onEmbedLinkClick} /> ); case "text": return ( <TextBlock key={it.id} idx={idx} block={it} colors={colors} customEmojis={customEmojis} selected={!previewMode && selectedBlockId === it.id} setSelectedBlockId={setSelectedBlockId} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} setEditingTextId={setEditingTextId} previewMode={previewMode} /> ); case "text-with-button": return ( <TextWithButtonBlock key={it.id} idx={idx} block={it} colors={colors} customEmojis={customEmojis} selected={!previewMode && selectedBlockId === it.id} setSelectedBlockId={setSelectedBlockId} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} setEditingTextWithButtonId={setEditingTextWithButtonId} previewMode={previewMode} onEmbedLinkClick={onEmbedLinkClick} /> ); case "hr": return ( <HRBlock key={it.id} idx={idx} id={it.id} colors={colors} selected={!previewMode && selectedBlockId === it.id} setSelectedBlockId={setSelectedBlockId} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} setEditingHrId={setEditingHrId} previewMode={previewMode} /> ); default: return null; } })} </div> );
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
  return ( <div draggable={!previewMode} onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)} onDrop={onDrop(idx)} onDragEnd={onDragEnd} className={`mt-3 ${selected? 'ring-2 ring-indigo-500/70 rounded-md' : ''} bg-transparent select-none`} onClick={(e) => { if (!previewMode) { e.stopPropagation(); setSelectedBlockId(id); setEditingHrId(id); } }} style={{ cursor: previewMode ? 'default' : 'grab' }} > <div className="relative h-[2px] rounded-sm overflow-hidden"> <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent, #6a6e79 35%, #6a6e79 65%, transparent)' }} /> <div className="relative h-[2px] bg-[#3a3c41]" /> </div> </div> );
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
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <TextBlockView block={block} customEmojis={customEmojis} />
                </div>
                <div className="flex-shrink-0">
                    <ButtonChip btn={block.button} colors={colors} previewMode={previewMode} onEmbedLinkClick={onEmbedLinkClick} />
                </div>
            </div>
        </div>
    );
}


function TextBlockView({ block, customEmojis = [] }) {
    const html = useMemo(() => {
        const renderer = {
            codespan(token) {
                return `<code class="bg-[#202225] text-white/90 py-0.5 px-1.5 rounded-sm font-mono text-sm">${token.text}</code>`;
            },
            heading(token) {
                const { text, depth } = token;
                const sizes = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-lg', 4: 'text-base', 5: 'text-base', 6: 'text-base' };
                const weights = { 1: 'font-bold', 2: 'font-bold', 3: 'font-semibold', 4: 'font-semibold', 5: 'font-semibold', 6: 'font-semibold' };
                return `<h${depth} class="${sizes[depth]} ${weights[depth]} my-2">${text}</h${depth}>`;
            }
        };
        
        marked.use({ renderer, breaks: true, gfm: true });

        let processedContent = block.content || "";
        
        if (customEmojis.length > 0) {
            const emojiMap = new Map(customEmojis.map(e => [e.name, e.url]));
            processedContent = processedContent.replace(/:(\w+):/g, (match, emojiName) => {
                if (emojiMap.has(emojiName)) {
                    const url = emojiMap.get(emojiName);
                    return `<img src="${url}" alt="${match}" class="inline-block h-5 w-5 align-bottom mx-px" />`;
                }
                return match;
            });
        }
        
        const dirty = marked.parse(processedContent);
        return DOMPurify.sanitize(dirty, { ADD_TAGS: ['img'], ADD_ATTR: ['class', 'style', 'alt', 'src'] });
    }, [block.content, customEmojis]);

    const hasThumb = Boolean(block.thumbUrl);
    
    return (
        <div className="relative">
            {hasThumb && (
                <div className="absolute top-0 right-0 w-[80px] h-[80px] rounded-lg overflow-hidden border border-[#202225]">
                    <img src={block.thumbUrl} alt="thumb" className="w-full h-full object-cover" />
                </div>
            )}
            <div
                className="prose prose-invert max-w-none prose-p:my-1"
                style={{ paddingRight: hasThumb ? '92px' : '0' }}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}

function ButtonChip({ btn, colors, onEdit, previewMode, onEmbedLinkClick }) {
  const safeBtn = (btn && typeof btn === 'object') ? btn : {};
  const style = safeBtn.style === 'link' ? 'link' : 'secondary';
  const leftEmojiUrl = typeof safeBtn.leftEmojiUrl === 'string' && safeBtn.leftEmojiUrl.trim() ? safeBtn.leftEmojiUrl : undefined;
  const rightEmojiUrl = typeof safeBtn.rightEmojiUrl === 'string' && safeBtn.rightEmojiUrl.trim() ? safeBtn.rightEmojiUrl : undefined;
  const base = `rounded-md inline-flex items-center justify-center text-sm font-medium h-9 px-4 select-none transition outline-none`;
  const visual = style === 'link' ? `${colors?.linkBtn}` : `${colors?.secondaryBtn}`;
  const inactive = safeBtn.active === false ? ' opacity-50 cursor-not-allowed' : '';
  const interactive = previewMode ? ' cursor-pointer' : ' cursor-pointer';
  const label = typeof safeBtn.label === 'string' && safeBtn.label.trim().length > 0 ? safeBtn.label : (!leftEmojiUrl && !rightEmojiUrl && style !== 'link' ? 'Кнопка' : '');
  
  const handleClick = (e) => {
      e.stopPropagation();
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

function Modal({ children, onClose }) {
  const overlayRef = useRef(null);
  const mouseDownOnOverlay = useRef(false);
  return ( <div className="fixed inset-0 z-50 flex items-center justify-center"> <div ref={overlayRef} className="absolute inset-0 bg-black/50" onMouseDown={(e) => { if (e.target === overlayRef.current) mouseDownOnOverlay.current = true; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === overlayRef.current) { onClose?.(); } mouseDownOnOverlay.current = false; }} /> <div className="relative w-full max-w-md rounded-xl bg-[#2B2D31] border border-[#202225] p-4 shadow-xl" onMouseDown={(e)=>e.stopPropagation()} onMouseUp={(e)=>e.stopPropagation()}> {children} </div> </div> );
}

function ButtonEditor({ initial, onSave, onDelete, embeds, currentEmbedId }) {
  const [label, setLabel] = useState(initial?.label || "");
  const [leftEmojiUrl, setLeftEmojiUrl] = useState(initial?.leftEmojiUrl || "");
  const [style, setStyle] = useState(initial?.style === 'link' ? 'link' : 'secondary');
  const [active, setActive] = useState(initial?.active !== false);
  const [linkToEmbedId, setLinkToEmbedId] = useState(initial?.linkToEmbedId || "");

  const otherEmbeds = embeds.filter(e => e.id !== currentEmbedId);

  return ( <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave?.({ label, leftEmojiUrl, style, active, linkToEmbedId }); }} > <h3 className="text-base font-semibold">Настройки кнопки</h3> <div> <label className="text-xs uppercase tracking-wide opacity-70">Название кнопки</label> <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" /> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Эмодзи (URL) — слева</label> <input value={leftEmojiUrl} onChange={(e) => setLeftEmojiUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" placeholder="https://..." /> </div> <div className="grid grid-cols-2 gap-3"> <div> <label className="text-xs uppercase tracking-wide opacity-70">Стиль</label> <select value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"> <option value="secondary">Вторичный</option> <option value="link">Ссылка</option> </select> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Тип</label> <select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none"> <option value="inactive">Неактивная</option> <option value="active">Активная</option> </select> </div> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Переход на Embed</label> <select value={linkToEmbedId} onChange={(e) => setLinkToEmbedId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" disabled={otherEmbeds.length === 0}> <option value="">Нет</option> {otherEmbeds.map(embed => <option key={embed.id} value={embed.id}>{embed.name}</option>)} </select> </div> <div className="flex items-center justify-between pt-2"> <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium">Удалить</button> <button type="submit" className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">Сохранить</button> </div> </form> );
}

function TextEditor({ initial, onSave, onDelete }) {
  const [thumbUrl, setThumbUrl] = useState(initial?.thumbUrl || '');
  const [content, setContent] = useState(initial?.content || '');
  const taRef = useRef(null);
  const applyToSelection = (fn) => { const ta = taRef.current; if (!ta) return; const start = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const before = content.slice(0, start); const sel = content.slice(start, end); const after = content.slice(end); const { text, caretFromStart, caretToStart } = fn({ before, sel, after, start, end }); setContent(text); requestAnimationFrame(() => { if (!taRef.current) return; const ns = start + (caretFromStart ?? 0); const ne = start + (caretToStart ?? 0); taRef.current.selectionStart = ns; taRef.current.selectionEnd = ne; taRef.current.focus(); }); };
  const wrapInline = (marker) => applyToSelection(({ before, sel, after }) => { const wrapped = `${marker}${sel || 'текст'}${marker}`; return { text: before + wrapped + after, caretFromStart: marker.length, caretToStart: (sel || 'текст').length + marker.length }; });
  const wrapBlock = (fence = '```') => applyToSelection(({ before, sel, after }) => { const body = sel || 'код'; const wrapped = `${fence}\n${body}\n${fence}`; return { text: before + wrapped + after, caretFromStart: fence.length + 1, caretToStart: (sel ? sel.length : 3) + fence.length + 1 }; });
  const prefixLines = (prefix) => applyToSelection(({ before, sel, after, start, end }) => { const lb = before.lastIndexOf('\n') + 1; const nextNewline = content.indexOf('\n', end); const la = (nextNewline === -1) ? content.length : nextNewline; const head = content.slice(0, lb); const mid = content.slice(lb, la); const tail = content.slice(la); const newMid = mid.split('\n').map(line => line.startsWith(prefix) ? line : (prefix + line)).join('\n'); const delta = newMid.length - mid.length; return { text: head + newMid + tail, caretFromStart: (start - lb) + prefix.length, caretToStart: (end - lb) + delta }; });
  return ( <form className="space-y-3" onSubmit={(e)=>{e.preventDefault(); onSave?.({ thumbUrl, content });}}> <h3 className="text-base font-semibold">Текстовый блок</h3> <div> <label className="text-xs uppercase tracking-wide opacity-70">Ссылка на картинку (квадратная)</label> <input value={thumbUrl} onChange={(e)=>setThumbUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" placeholder="https://..." /> <p className="text-xs opacity-60 mt-1">Рекомендуется 80×80 — как миниатюра в правом верхнем углу.</p> </div> <div className="flex flex-wrap gap-2 items-center text-xs"> <span className="opacity-70">Форматирование:</span> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => wrapInline('`')} title="Инлайн-код (`текст`)">`код`</button> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => wrapBlock('```')} title="Блок кода (```)">``` код ```</button> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => wrapInline('**')} title="Жирный (**текст**)"><b>B</b></button> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => wrapInline('*')} title="Курсив (*текст*)"><i>I</i></button> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => wrapInline('~~')} title="Зачёрк (~~текст~~)"><span className="line-through">S</span></button> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => prefixLines('# ')} title="Заголовок (#)">#</button> <button type="button" className="px-2 py-1 rounded-md bg-[#3a3d43] hover:bg-[#4a4e55] border border-[#202225]" onClick={() => prefixLines('-# ')} title="Малый заголовок (-#)">-#</button> </div> <div> <label className="text-xs uppercase tracking-wide opacity-70">Содержимое (Markdown/Discord)</label> <textarea ref={taRef} value={content} onChange={(e)=>setContent(e.target.value)} rows={8} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none whitespace-pre-wrap" placeholder="Введите текст с форматированием Discord (**, *, `, #, >, ~~ и т.д.)" /> </div> <div className="flex items-center justify-between pt-2"> <button type="button" onClick={onDelete} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium">Удалить</button> <button type="submit" className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">Сохранить</button> </div> </form> );
}

function TextWithButtonEditor({ initial, onSave, onDelete, embeds, currentEmbedId }) {
    const [content, setContent] = useState(initial?.content || '');
    const [button, setButton] = useState(initial?.button || sanitizeButton({}));
    
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
                    value={content} 
                    onChange={(e) => setContent(e.target.value)} 
                    rows={6} 
                    className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none whitespace-pre-wrap" 
                    placeholder="Введите текст..." 
                />
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
                    <div>
                        <label className="text-xs uppercase tracking-wide opacity-70">Эмодзи (URL) — слева</label>
                        <input value={button.leftEmojiUrl} onChange={(e) => handleButtonChange({ leftEmojiUrl: e.target.value })} className="mt-1 w-full rounded-lg border border-[#202225] bg-transparent px-3 py-2 text-sm outline-none" placeholder="https://..." />
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
                <button type="submit" className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">Сохранить</button>
            </div>
        </form>
    );
}
