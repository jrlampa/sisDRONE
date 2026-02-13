import { openDB } from 'idb';

const DB_NAME = 'sisdrone-offline-db';
const STORE_NAME = 'sync-queue';

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  data: unknown;
  timestamp: number;
}

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const addToQueue = async (request: Omit<QueuedRequest, 'id' | 'timestamp'>) => {
  const db = await initDB();
  await db.add(STORE_NAME, { ...request, timestamp: Date.now() });
};

export const getQueue = async (): Promise<QueuedRequest[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const removeFromQueue = async (id: number) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};

export const clearQueue = async () => {
  const db = await initDB();
  await db.clear(STORE_NAME);
};
