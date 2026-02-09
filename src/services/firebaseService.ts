
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc, writeBatch, collection, Firestore, deleteField, query } from 'firebase/firestore';
import { FirebaseConfig, SyncAction } from '../types';

let db: Firestore | null = null;
let unsubscribers: (() => void)[] = [];

// Local cache to aggregate updates
let localCache: {
  tasks: any[];
  logs: any[];
  observations: any[];
  offDays: any[];
  appConfig?: any;
} = { tasks: [], logs: [], observations: [], offDays: [] };

// Track which collections have received their first snapshot to prevent wiping local state with empty cache
const hydrationState = {
    tasks: false,
    logs: false,
    observations: false,
    root: false
};

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

  batch.update(rootRef, {
    tasks: deleteField(),
    logs: deleteField(),
    observations: deleteField(),
    migrationStatus: 'completed_' + new Date().toISOString()
  });

  try {
    await batch.commit();
    console.log("Migration completed.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
};

export const subscribeToData = (
  callback: (data: { tasks: any[], logs: any[], observations: any[], offDays: any[], appConfig?: any }) => void
) => {
  if (!db) return;
  const firestore = db;

  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  const notify = () => {
    // CRITICAL: Only notify the app if we have received at least one snapshot from every major collection
    // This prevents "disappearing data" where an empty cache overwrites local state on startup
    if (hydrationState.tasks && hydrationState.logs && hydrationState.observations && hydrationState.root) {
        callback({
          tasks: localCache.tasks,
          logs: localCache.logs,
          observations: localCache.observations,
          offDays: localCache.offDays,
          appConfig: localCache.appConfig
        });
    }
  };

  try {
    const rootUnsub = onSnapshot(doc(firestore, 'protrack', 'user_data'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tasks && Array.isArray(data.tasks)) {
           migrateLegacyData(data);
           return;
        }
        localCache.offDays = data.offDays || [];
        if (data.appConfig) localCache.appConfig = data.appConfig; 
        hydrationState.root = true;
        notify();
      } else {
        hydrationState.root = true;
        notify();
      }
    });
    unsubscribers.push(rootUnsub);

    const tasksUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'tasks')), (snapshot) => {
      localCache.tasks = snapshot.docs.map(d => d.data());
      hydrationState.tasks = true;
      notify();
    });
    unsubscribers.push(tasksUnsub);

    const logsUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'logs')), (snapshot) => {
      localCache.logs = snapshot.docs.map(d => d.data());
      hydrationState.logs = true;
      notify();
    });
    unsubscribers.push(logsUnsub);

    const obsUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'observations')), (snapshot) => {
      localCache.observations = snapshot.docs.map(d => d.data());
      hydrationState.observations = true;
      notify();
    });
    unsubscribers.push(obsUnsub);

  } catch (err) {
    console.error("Sync Setup Error:", err);
  }

  return () => unsubscribers.forEach(u => u());
};

export const syncData = async (actions: SyncAction[]) => {
  if (!db) return;
  const firestore = db;
  if (actions.length === 0) return;

  const fullOverwrite = actions.find(a => a.type === 'full');
  if (fullOverwrite && fullOverwrite.data) {
      const data = fullOverwrite.data;
      const batch = writeBatch(firestore);
      data.tasks?.forEach((t: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'tasks', t.id), t));
      data.logs?.forEach((l: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'logs', l.id), l));
      data.observations?.forEach((o: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'observations', o.id), o));
      batch.set(doc(firestore, 'protrack', 'user_data'), { 
          offDays: data.offDays || [],
          appConfig: data.appConfig || {}
      }, { merge: true });
      await batch.commit();
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

export const isFirebaseInitialized = () => !!db;
