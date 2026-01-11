import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, Firestore } from 'firebase/firestore';
import { FirebaseConfig } from '../types';

let db: Firestore | null = null;
let unsubscribe: (() => void) | null = null;

export const initFirebase = (config: FirebaseConfig) => {
  try {
    const apps = getApps();
    // Ensure we don't have a zombie app with different config
    const app = apps.length === 0 ? initializeApp(config) : getApp();
    
    // Initialize Firestore
    db = getFirestore(app);
    
    // Simple verification that db was initialized
    if (!db) {
      throw new Error("Firestore service could not be initialized.");
    }
    
    return true;
  } catch (error: any) {
    console.error("Firebase Init Error:", error);
    // Provide a more user-friendly error if it's the specific "Service firestore is not available"
    if (error.message && error.message.includes("Service firestore is not available")) {
      throw new Error("Browser Configuration Error: Please refresh the page to apply the latest updates. (Version Mismatch)");
    }
    throw error;
  }
};

export const subscribeToData = (
  callback: (data: { tasks: any[], logs: any[], observations: any[], offDays: any[] }) => void
) => {
  if (!db) {
    console.warn("Attempted to subscribe but Firestore is not initialized.");
    return;
  }

  // Unsubscribe previous listener if exists
  if (unsubscribe) unsubscribe();

  try {
    // Listen to a single document 'data' in collection 'protrack'
    unsubscribe = onSnapshot(doc(db, 'protrack', 'user_data'), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (!docSnapshot.metadata.hasPendingWrites) {
          callback({
            tasks: data.tasks || [],
            logs: data.logs || [],
            observations: data.observations || [],
            offDays: data.offDays || []
          });
        }
      }
    }, (error) => {
      console.error("Sync Error:", error);
    });
  } catch (err) {
    console.error("Failed to set up snapshot listener:", err);
  }

  return unsubscribe;
};

export const saveDataToCloud = async (data: { tasks: any[], logs: any[], observations: any[], offDays: any[] }) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'protrack', 'user_data'), data, { merge: true });
  } catch (error) {
    console.error("Save to Cloud Error:", error);
  }
};

export const isFirebaseInitialized = () => !!db;