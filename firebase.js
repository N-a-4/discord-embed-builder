import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkZnGPLaWLbjcrljsHi0VkKd1vVyU4t10",
  authDomain: "rustify-5f619.firebaseapp.com",
  projectId: "rustify-5f619",
  storageBucket: "rustify-5f619.firebasestorage.app",
  messagingSenderId: "109265697836",
  appId: "1:109265697836:web:983876049f21f6e9446589"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Login immediately
(async () => {
  try {
    await signInWithEmailAndPassword(auth, "nprokop.fl@gmail.com", "rhtrth");
    console.log("✅ Firebase: вход выполнен");
  } catch (err) {
    console.error("❌ Firebase login error:", err);
  }
})();

export { app, auth, db };
export default app;
