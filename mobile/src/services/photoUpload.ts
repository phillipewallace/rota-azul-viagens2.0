/**
 * Upload de fotos com fila offline (IndexedDB)
 * Endpoint: POST /api/photos/route/:routeId/point/:pointId
 */
import { API_BASE_URL } from './config';

const DB_NAME = 'photo-queue-db';
const STORE = 'pending-photos';

interface PendingPhoto {
  id: string;
  routeId: string;
  pointId: string;
  operationType: string;
  blob: Blob;
  filename: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueue(photo: PendingPhoto): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(photo);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dequeue(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listPending(): Promise<PendingPhoto[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingPhoto[]);
    req.onerror = () => reject(req.error);
  });
}

async function uploadOne(p: PendingPhoto): Promise<void> {
  const fd = new FormData();
  fd.append('photos', p.blob, p.filename);
  fd.append('operationType', p.operationType);
  const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token') || '';
  const res = await fetch(`${API_BASE_URL}/photos/route/${p.routeId}/point/${p.pointId}/photos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload falhou: ${res.status}`);
}

export async function uploadPhotos(
  routeId: string,
  pointId: string,
  operationType: string,
  files: Blob[]
): Promise<{ uploaded: number; queued: number }> {
  let uploaded = 0;
  let queued = 0;
  for (const [i, blob] of files.entries()) {
    const photo: PendingPhoto = {
      id: `${routeId}-${pointId}-${Date.now()}-${i}`,
      routeId,
      pointId,
      operationType,
      blob,
      filename: `photo-${Date.now()}-${i}.jpg`,
      createdAt: Date.now(),
    };
    try {
      await uploadOne(photo);
      uploaded++;
    } catch (e) {
      console.warn('[PHOTO] Upload falhou, enfileirando:', e);
      await enqueue(photo);
      queued++;
    }
  }
  return { uploaded, queued };
}

export async function flushQueue(): Promise<number> {
  const pending = await listPending();
  let sent = 0;
  for (const p of pending) {
    try {
      await uploadOne(p);
      await dequeue(p.id);
      sent++;
    } catch (e) {
      console.warn('[PHOTO] Re-tentativa falhou:', e);
    }
  }
  return sent;
}

// Auto-flush quando voltar online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue().then((n) => n > 0 && console.log(`[PHOTO] ${n} fotos sincronizadas`));
  });
}
