/**
 * emoji_store.js (configurable)
 * Global registry for emojis shared across all projects (browser localStorage).
 * Exposes window.RustifyEmojiStore with:
 *  - getAll(), setAll(list)
 *  - addOrUpdate(url, name)
 *  - removeById(id), removeByUrl(url)
 *  - resolveName({url, id, unicode})
 *  - normalizeUrl(url)
 *  - isEmpty()
 *  - seedOnceFromList(list, flagKey='RUSTIFY_SEEDED_FROM_ADMIN')
 *
 * Config switches:
 *   - KEEP_QUERY_PARAMS: if true, query params are NOT stripped in normalizeUrl()
 *   - DEDUPE_BY_DISCORD_ID: if true, /emojis/{id}.(png|gif|webp) considered same emoji
 *   - DEDUPE_BY_NORMALIZED_URL: if true, normalized URL collisions merge into one emoji
 */
(function(){
  const KEY = 'RUSTIFY_GLOBAL_EMOJIS_V1';

  // ==== CONFIG (you can tweak) ====
  const KEEP_QUERY_PARAMS = false;         // set true to treat ?v=... as distinct
  const DEDUPE_BY_DISCORD_ID = true;       // set false to allow duplicates even with same /emojis/{id}.png
  const DEDUPE_BY_NORMALIZED_URL = true;   // set false to allow duplicates with same base URL
  // =================================

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : { emojis: [] };
      if(!Array.isArray(data.emojis)) data.emojis = [];
      return data;
    }catch{
      return { emojis: [] };
    }
  }

  function save(data){
    try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch{}
  }

  function normalizeUrl(url){
    if(!url) return '';
    try{
      const u = new URL(String(url));
      return KEEP_QUERY_PARAMS ? u.toString() : (u.origin + u.pathname);
    }catch{
      const s = String(url);
      return KEEP_QUERY_PARAMS ? s : s.split('?')[0];
    }
  }

  function extractId(url){
    const m = String(url||'').match(/\/emojis\/(\d{15,22})\./);
    return m ? m[1] : null;
  }

  function isUnicodeEmoji(s){
    if(!s || /^https?:\/\//.test(s)) return false;
    return /\p{Extended_Pictographic}/u.test(String(s));
  }

  function getAll(){ return load().emojis.slice(); }

  function setAll(list){
    const data = load();
    data.emojis = Array.isArray(list) ? list : [];
    save(data);
  }

  function addOrUpdate(url, name){
    if(!url || !name) return;
    const data = load();
    const base = normalizeUrl(url);
    const id = extractId(url);

    let e = null;
    if (DEDUPE_BY_DISCORD_ID && id){
      e = data.emojis.find(x => x.id === id) || null;
    }
    if (!e && DEDUPE_BY_NORMALIZED_URL){
      e = data.emojis.find(x => (x.urls||[]).some(u => normalizeUrl(u) === base)) || null;
    }
    if (!e){
      e = { id: (DEDUPE_BY_DISCORD_ID ? (id || null) : null), name: String(name), urls: [url], aliases: [] };
      data.emojis.push(e);
    }else{
      if(!e.urls) e.urls = [];
      if(!e.urls.includes(url)) e.urls.push(url);
      if(String(e.name) !== String(name)){
        e.aliases = Array.isArray(e.aliases) ? e.aliases : [];
        if(!e.aliases.includes(String(name))) e.aliases.push(String(name));
      }
    }
    save(data);
  }

  function removeById(id){
    const data = load();
    data.emojis = data.emojis.filter(e => e.id !== id);
    save(data);
  }

  function removeByUrl(url){
    const data = load();
    const base = normalizeUrl(url);
    for(const e of data.emojis){
      e.urls = (e.urls||[]).filter(u => normalizeUrl(u) !== base);
    }
    data.emojis = data.emojis.filter(e => (e.urls||[]).length > 0);
    save(data);
  }

  function resolveName({ url, id, unicode }){
    if(isUnicodeEmoji(unicode || url)){ return String(unicode || url); }
    const data = load();
    if(id && DEDUPE_BY_DISCORD_ID){
      const hit = data.emojis.find(e => e.id === id);
      if(hit && hit.name) return String(hit.name);
    }
    if(url){
      const base = normalizeUrl(url);
      if (DEDUPE_BY_NORMALIZED_URL){
        const byBase = data.emojis.find(x => (x.urls||[]).some(u => normalizeUrl(u) === base));
        if(byBase && byBase.name) return String(byBase.name);
      }
      const exact = data.emojis.find(x => (x.urls||[]).includes(url));
      if(exact && exact.name) return String(exact.name);
      
      const eid = extractId(url);
      if(DEDUPE_BY_DISCORD_ID && eid){
        const byId = data.emojis.find(x => x.id === eid);
        if(byId && byId.name) return String(byId.name);
      }
    }
    return null;
  }

  function isEmpty(){
    try{ return getAll().length === 0; }catch{ return true; }
  }

  function seedOnceFromList(list, flagKey='RUSTIFY_SEEDED_FROM_ADMIN'){
    try{
      if(localStorage.getItem(flagKey) === '1') return { seeded:false, count:0 };
      const arr = Array.isArray(list) ? list : [];
      let count = 0;
      for(const e of arr){
        if(e && e.url && e.name){
          addOrUpdate(e.url, e.name);
          count++;
        }
      }
      localStorage.setItem(flagKey, '1');
      return { seeded:true, count };
    }catch(err){
      return { seeded:false, error:String(err) };
    }
  }

  const api = { getAll, setAll, addOrUpdate, removeById, removeByUrl, resolveName, normalizeUrl, isEmpty, seedOnceFromList };
  try{ window.RustifyEmojiStore = api; }catch{}
})();