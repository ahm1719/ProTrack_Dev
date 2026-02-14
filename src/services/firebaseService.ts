
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, writeBatch, collection, Firestore, query, onSnapshotsInSync } from 'firebase/firestore';
import { FirebaseConfig, SyncAction } from '../types';

let db: Firestore | null = null;
let unsubscribers: (() => void)[] = [];

export const initFirebase = (config: FirebaseConfig) => {
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(app);
    return !!db;
  } catch (error: any) {
    console.error("Firebase Init Error:", error);
    return false;
  }
};

/**
 * Granularly subscribes to different data collections.
 * Each callback is only fired when its specific data changes in the cloud.
 */
export const subscribeToCollections = (callbacks: {
    onTasks?: (tasks: any[]) => void;
    onLogs?: (logs: any[]) => void;
    onObservations?: (obs: any[]) => void;
    onConfig?: (config: any) => void;
    onOffDays?: (days: any[]) => void;
}) => {
  if (!db) return;
  const firestore = db;

  // Clear existing listeners
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  try {
    // Root listener for Config and OffDays
    const rootUnsub = onSnapshot(doc(firestore, 'protrack', 'user_data'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.offDays && callbacks.onOffDays) callbacks.onOffDays(data.offDays);
        if (data.appConfig && callbacks.onConfig) callbacks.onConfig(data.appConfig);
      }
    });
    unsubscribers.push(rootUnsub);

    // Sub-collection listeners
    const tasksUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'tasks')), (snapshot) => {
      if (!snapshot.metadata.hasPendingWrites && callbacks.onTasks) {
          callbacks.onTasks(snapshot.docs.map(d => d.data()));
      }
    });
    unsubscribers.push(tasksUnsub);

    const logsUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'logs')), (snapshot) => {
      if (!snapshot.metadata.hasPendingWrites && callbacks.onLogs) {
          callbacks.onLogs(snapshot.docs.map(d => d.data()));
      }
    });
    unsubscribers.push(logsUnsub);

    const obsUnsub = onSnapshot(query(collection(firestore, 'protrack', 'user_data', 'observations')), (snapshot) => {
      if (!snapshot.metadata.hasPendingWrites && callbacks.onObservations) {
          callbacks.onObservations(snapshot.docs.map(d => d.data()));
      }
    });
    unsubscribers.push(obsUnsub);

  } catch (err) {
    console.error("Sync Setup Error:", err);
  }

  return () => {
      unsubscribers.forEach(u => u());
      unsubscribers = [];
  };
};

export const syncData = async (actions: SyncAction[]) => {
  if (!db || actions.length === 0) return;
  const firestore = db;
  const batch = writeBatch(firestore);

  // Helper to remove undefined values which cause Firestore writes to fail
  const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

  actions.forEach(action => {
    let collectionName = '';
    if (action.type === 'task') collectionName = 'tasks';
    else if (action.type === 'log') collectionName = 'logs';
    else if (action.type === 'observation') collectionName = 'observations';

    if (collectionName && action.id) {
        const ref = doc(firestore, 'protrack', 'user_data', collectionName, action.id);
        if (action.action === 'delete') {
            batch.delete(ref);
        } else {
            batch.set(ref, sanitize(action.data), { merge: true });
        }
    } else if (action.type === 'offDays' || action.type === 'config') {
        const ref = doc(firestore, 'protrack', 'user_data');
        if (action.type === 'offDays') batch.set(ref, { offDays: action.data }, { merge: true });
        if (action.type === 'config') batch.set(ref, { appConfig: sanitize(action.data) }, { merge: true });
    } else if (action.type === 'full' && action.data) {
        // Special case: Push all local data to cloud (Initial Setup)
        const data = action.data;
        data.tasks?.forEach((t: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'tasks', t.id), sanitize(t)));
        data.logs?.forEach((l: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'logs', l.id), sanitize(l)));
        data.observations?.forEach((o: any) => batch.set(doc(firestore, 'protrack', 'user_data', 'observations', o.id), sanitize(o)));
        batch.set(doc(firestore, 'protrack', 'user_data'), { 
            offDays: data.offDays || [],
            appConfig: sanitize(data.appConfig || {})
        }, { merge: true });
    }
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error("Sync Batch Error:", error);
  }
};

export const isFirebaseInitialized = () => !!db;
