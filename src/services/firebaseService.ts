
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc, writeBatch, collection, Firestore, deleteField, query } from 'firebase/firestore';
import { FirebaseConfig, SyncAction } from '../types';

let db: Firestore | null = null;
let unsubscribers: (() => void)[] = [];

// Local cache to aggregate updates from multiple collections before notifying app
let localCache: {
  tasks: any[];
  logs: any[];
  observations: any[];
  offDays: any[];
  appConfig?: any;
} = { tasks: [], logs: [], observations: [], offDays: [] };

export const initFirebase = (config: FirebaseConfig) => {
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(app);
    
    if (!db) throw new Error("Firestore service could not be initialized.");
    
    return true;
  } catch (error: any) {
    console.error("Firebase Init Error:", error);
    if (error.message && error.message.includes("Service firestore is not available")) {
      throw new Error("Browser Configuration Error: Please refresh the page. (Version Mismatch)");
    }
    throw error;
  }
};

// Helper to migrate legacy monolithic data to subcollections
const migrateLegacyData = async (legacyData: any) => {
  if (!db) return;
  const firestore = db;
  console.log("Starting legacy data migration...");
  const batch = writeBatch(firestore);
  const rootRef = doc(firestore, 'protrack', 'user_data');

  if (Array.isArray(legacyData.tasks) && legacyData.tasks.length > 0) {
    legacyData.tasks.forEach((t: any) => {
      batch.set(doc(firestore, 'protrack', 'user_data', 'tasks', t.id), t);
    });
  }
  
  if (Array.isArray(legacyData.logs) && legacyData.logs.length > 0) {
    legacyData.logs.forEach((l: any) => {
      batch.set(doc(firestore, 'protrack', 'user_data', 'logs', l.id), l);
    });
  }

  if (Array.isArray(legacyData.observations) && legacyData.observations.length > 0) {
    legacyData.observations.forEach((o: any) => {
      batch.set(doc(firestore, 'protrack', 'user_data', 'observations', o.id), o);
    });
  }

  // Clean up root document (remove arrays, keep settings/offdays)
  batch.update(rootRef, {
    tasks: deleteField(),
    logs: deleteField(),
    observations: deleteField(),
    migrationStatus: 'completed_' + new Date().toISOString()
  });

  try {
    await batch.commit();
    console.log("Migration completed successfully.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
};

export const subscribeToData = (
  callback: (data: { tasks: any[], logs: any[], observations: any[], offDays: any[], appConfig?: any }) => void
) => {
  if (!db) return;
  const firestore = db;

  // Clear existing listeners
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  const notify = () => {
    callback({
      tasks: localCache.tasks,
      logs: localCache.logs,
      observations: localCache.observations,
      offDays: localCache.offDays,
      appConfig: localCache.appConfig
    });
  };

  try {
    // 1. Listen to Root Document (Settings & OffDays & Legacy Check)
    const rootUnsub = onSnapshot(doc(firestore, 'protrack', 'user_data'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check for Legacy Data & Migrate if needed
        if (data.tasks && Array.isArray(data.tasks)) {
           migrateLegacyData(data);
           return; // Migration will trigger updates via collection listeners
        }

        localCache.offDays = data.offDays || [];
        // Only update config if present to avoid overwriting local defaults with undefined
        if (data.appConfig) localCache.appConfig = data.appConfig; 
        
        notify();
      }
    });
    unsubscribers.push(rootUnsub);

    // 2. Listen to Tasks Collection
    const tasksUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'tasks')), (snapshot) => {
      localCache.tasks = snapshot.docs.map(d => d.data());
      notify();
    });
    unsubscribers.push(tasksUnsub);

    // 3. Listen to Logs Collection
    const logsUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'logs')), (snapshot) => {
      localCache.logs = snapshot.docs.map(d => d.data());
      notify();
    });
    unsubscribers.push(logsUnsub);

    // 4. Listen to Observations Collection
    const obsUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'observations')), (snapshot) => {
      localCache.observations = snapshot.docs.map(d => d.data());
      notify();
    });
    unsubscribers.push(obsUnsub);

  } catch (err) {
    console.error("Sync Setup Error:", err);
  }

  return () => unsubscribers.forEach(u => u());
};

// New Granular Sync Function
export const syncData = async (actions: SyncAction[]) => {
  if (!db) return;
  const firestore = db;
  
  if (actions.length === 0) return;

  // If actions contain 'full' overwrite (e.g. restore from backup), handle separately
  const fullOverwrite = actions.find(a => a.type === 'full');
  if (fullOverwrite) {
      if (fullOverwrite.data) {
          // This is expensive, but rare (Restore Backup)
          const data = fullOverwrite.data;
          const batch = writeBatch(firestore);
          
          // We will just upsert.
          data.tasks?.forEach((t: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'tasks', t.id), t));
          data.logs?.forEach((l: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'logs', l.id), l));
          data.observations?.forEach((o: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'observations', o.id), o));
          
          batch.set(doc(firestore, 'protrack', 'user_data'), { 
              offDays: data.offDays || [],
              appConfig: data.appConfig || {}
          }, { merge: true });

          await batch.commit();
      }
      return;
  }

  const batch = writeBatch(firestore);

  actions.forEach(action => {
    let collectionName = '';
    if (action.type === 'task') collectionName = 'tasks';
    if (action.type === 'log') collectionName = 'logs';
    if (action.type === 'observation') collectionName = 'observations';

    if (collectionName) {
        const ref = doc(firestore, 'protrack', 'user_data', collectionName, action.id!);
        if (action.action === 'delete') {
            batch.delete(ref);
        } else {
            batch.set(ref, action.data, { merge: true });
        }
    } else if (action.type === 'offDays' || action.type === 'config') {
        const ref = doc(firestore, 'protrack', 'user_data');
        if (action.type === 'offDays') batch.set(ref, { offDays: action.data }, { merge: true });
        if (action.type === 'config') batch.set(ref, { appConfig: action.data }, { merge: true });
    }
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error("Sync Error:", error);
  }
};

// Deprecated: Kept for compatibility but should not be used in granular mode
export const saveDataToCloud = async (data: any) => {
    // This function is effectively replaced by syncData but we keep it empty or redirecting
    // if something calls it unexpectedly.
    console.warn("Legacy saveDataToCloud called. Use syncData with granular actions.");
};

export const isFirebaseInitialized = () => !!db;
