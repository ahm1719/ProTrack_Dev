import { AppConfig, DailyLog, Observation, Task } from "../types";

// Type definitions for File System Access API
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: any): Promise<PermissionState>;
  requestPermission(descriptor?: any): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
  }
}

// --- IndexedDB Helper for Persisting Handles ---
const DB_NAME = 'ProTrack_DB';
const STORE_NAME = 'handles';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const storeDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, 'backup_dir');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("Failed to store handle in DB", e);
  }
};

export const getStoredDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('backup_dir');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error("Failed to retrieve handle from DB", e);
    return null;
  }
};

export const verifyPermission = async (handle: FileSystemDirectoryHandle, readWrite = true): Promise<boolean> => {
  const options = readWrite ? { mode: 'readwrite' } : {};
  // Check if permission was already granted
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  // Request permission. If the user grants permission, return true.
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }
  // The user didn't grant permission, so return false.
  return false;
};

// --- Main Service Functions ---

export const selectBackupFolder = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!('showDirectoryPicker' in window)) {
    alert("Your browser does not support the File System Access API (Chrome, Edge, or Opera required).");
    return null;
  }

  try {
    const handle = await window.showDirectoryPicker();
    // Persist the handle immediately upon selection
    await storeDirectoryHandle(handle);
    return handle;
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error("Error selecting folder:", error);
      alert("Could not access folder. " + error.message);
    }
    return null;
  }
};

export const performBackup = async (
  dirHandle: FileSystemDirectoryHandle, 
  data: { tasks: Task[], logs: DailyLog[], observations: Observation[], offDays: string[], appConfig: AppConfig }
): Promise<boolean> => {
  try {
    // Check permission state (without prompting)
    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
        console.warn("Backup skipped: Permission not granted. User intervention required.");
        return false;
    }

    // Generate filename with timestamp: ProTrack_Backup_2023-10-27_14-30.json
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
    const filename = `ProTrack_Backup_${dateStr}_${timeStr}.json`;

    // 1. Get file handle (create if doesn't exist)
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });

    // 2. Create writable stream
    const writable = await fileHandle.createWritable();

    // 3. Write data
    const jsonContent = JSON.stringify(data, null, 2);
    await writable.write(jsonContent);

    // 4. Close file
    await writable.close();

    return true;
  } catch (error) {
    console.error("Backup failed:", error);
    return false;
  }
};

export const saveManualBackup = async (data: any) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
  const filename = `ProTrack_Backup_${dateStr}_${timeStr}.json`;

  // 1. Try modern File System Access API (Save As Dialog)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JSON Backup',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Backup skipped', err);
      // If abort, just return, don't fallback to legacy download as user cancelled intention.
      return;
    }
  } 

  // 2. Fallback for browsers without File System API
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};