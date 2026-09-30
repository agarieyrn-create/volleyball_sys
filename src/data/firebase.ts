import { getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// 環境変数 (VITE_) または firebase-applet-config.json から自動構成
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || (projectId ? `${projectId}.firebaseapp.com` : '');
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || (projectId ? `${projectId}.firebasestorage.app` : '');
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '';
const firestoreDatabaseId = firebaseAppletConfig.firestoreDatabaseId || '(default)';

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

export const isFirebaseConfigured = Boolean(apiKey && projectId);

let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    // カスタム databaseId が指定されている場合は指定
    if (firestoreDatabaseId && firestoreDatabaseId !== '(default)') {
      db = getFirestore(app, firestoreDatabaseId);
    } else {
      db = getFirestore(app);
    }
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
}

export { db };
