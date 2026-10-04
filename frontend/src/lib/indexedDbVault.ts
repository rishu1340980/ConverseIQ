/**
 * ConverseIQ Offline Audio Vault
 * Persists audio chunks to IndexedDB every few seconds to guarantee that
 * sudden call drops, network cuts, or accidental tab closures do not destroy
 * recorded audio before AI MoM synthesis.
 */

const DB_NAME = 'ConverseIQ_Vault';
const DB_VERSION = 1;
const STORE_NAME = 'meeting_recordings';

interface StoredMeetingSession {
  sessionId: string;
  meetingTitle: string;
  attendeeNames: string;
  createdAt: number;
  durationSeconds: number;
  mimeType: string;
  chunks: Blob[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function initSessionVault(
  sessionId: string,
  meetingTitle: string,
  attendeeNames: string,
  mimeType: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const sessionData: StoredMeetingSession = {
      sessionId,
      meetingTitle,
      attendeeNames,
      createdAt: Date.now(),
      durationSeconds: 0,
      mimeType,
      chunks: [],
    };

    store.put(sessionData);
  } catch (err) {
    console.warn('Vault initialization notice:', err);
  }
}

export async function appendChunkToVault(
  sessionId: string,
  chunk: Blob,
  currentDurationSeconds: number
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const getReq = store.get(sessionId);
    getReq.onsuccess = () => {
      const session = getReq.result as StoredMeetingSession | undefined;
      if (session) {
        session.chunks.push(chunk);
        session.durationSeconds = currentDurationSeconds;
        store.put(session);
      }
    };
  } catch (err) {
    console.warn('Vault chunk append notice:', err);
  }
}

export async function getLatestUnsavedSession(): Promise<StoredMeetingSession | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = (request.result || []) as StoredMeetingSession[];
        if (!all.length) {
          resolve(null);
          return;
        }

        // Return latest session within last 24 hours that has chunks
        const valid = all
          .filter((s) => s.chunks && s.chunks.length > 0 && Date.now() - s.createdAt < 24 * 60 * 60 * 1000)
          .sort((a, b) => b.createdAt - a.createdAt);

        resolve(valid.length > 0 ? valid[0] : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearVaultSession(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(sessionId);
  } catch (err) {
    console.warn('Vault clear notice:', err);
  }
}

export function assembleAudioBlob(session: StoredMeetingSession): Blob {
  const mimeType = session.mimeType || 'audio/webm;codecs=opus';
  return new Blob(session.chunks, { type: mimeType });
}
