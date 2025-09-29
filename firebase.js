import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase client setup for Rustify (no auto-login).
 * Place this file at the project root as `firebase.js` (so imports like "../firebase.js" work from src files).
 */

const firebaseConfig = {
  apiKey: "AIzaSyCkZnGPLaWLbjcrljsHi0VkKd1vVyU4t10",
  authDomain: "rustify-5f619.firebaseapp.com",
  projectId: "rustify-5f619",
  storageBucket: "rustify-5f619.firebasestorage.app",
  messagingSenderId: "109265697836",
  appId: "1:109265697836:web:983876049f21f6e9446589"
};

// Initialize (idempotent)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Core SDKs
const auth = getAuth(app);
const db = getFirestore(app);

// IMPORTANT: No auto-login here. Auth flow is handled in the app (onAuthStateChanged / signInAnonymously).

export { app, auth, db };
export default app;


