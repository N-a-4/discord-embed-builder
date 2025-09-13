// rustify_custom_emojis.js
// Single source of truth for your global emojis.
// Fill the URLs and keep the names exactly as you want them to appear in exports.

export const customEmojis = [
  // пример:
  { name: 'support', url: 'https://your.cdn/emoji/support.png' },
  { name: 'rating',  url: 'https://your.cdn/emoji/rating.png'  },
  // добавляй свои:
  { name: 'my_emoji', url: 'https://your.cdn/emoji/my_emoji.png' },
];

// Автоматически прокинем в window на случай прямого использования экспортера
try { if (typeof window !== 'undefined') window.RustifyCustomEmojis = customEmojis; } catch {}