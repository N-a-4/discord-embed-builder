import { initializeApp } from "firebase/app";

// ВСТАВЬ свои значения ниже (оставь как есть, если ты уже подставил реальные)
const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// Инициализация единожды и экспорт инстанса
const app = initializeApp(firebaseConfig);
export default app;