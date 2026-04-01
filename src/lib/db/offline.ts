const DB_NAME = 'slowi-music-db';
const STORE_NAME = 'offline-files';

// DB 초기화
const initDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
};

// 파일 저장
export const saveToOffline = async (track: any, blob: Blob, metadata?: { lyrics?: string | null, cover_art?: string | null }) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Blob과 메타데이터 함께 저장
    store.put({ 
        id: track.id,
        name: track.name,
        artist: track.artist || 'Unknown',
        thumbnailLink: track.thumbnailLink,
        mimeType: track.mimeType,
        lyrics: metadata?.lyrics || null,     // [NEW] 가사 저장
        cover_art: metadata?.cover_art || null, // [NEW] 앨범 아트 저장
        size: track.size,
        blob: blob, 
        savedAt: new Date() 
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

// 모든 파일 가져오기
export const getOfflineFiles = async () => {
  const db = await initDB();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 파일 삭제
export const deleteOfflineFile = async (id: string) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
