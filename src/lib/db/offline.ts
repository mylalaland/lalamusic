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

// 파일/메타데이터 함께 저장 (기존)
export const saveToOffline = async (track: any, blob?: Blob, metadata?: { lyrics?: string | null, cover_art?: string | null }) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // 가져온 기존 데이터가 있는지 확인
    const getReq = store.get(track.id);
    getReq.onsuccess = () => {
       const existing = getReq.result || {};
       
       store.put({ 
           ...existing,
           id: track.id,
           name: track.name || existing.name,
           artist: track.artist || existing.artist || 'Unknown',
           thumbnailLink: track.thumbnailLink || existing.thumbnailLink,
           mimeType: track.mimeType || existing.mimeType,
           lyrics: metadata?.lyrics !== undefined ? metadata.lyrics : existing.lyrics,
           cover_art: metadata?.cover_art !== undefined ? metadata.cover_art : existing.cover_art,
           size: track.size || existing.size,
           blob: blob || existing.blob, // Blob이 없으면 기존 유지
           savedAt: existing.savedAt || new Date() 
       });
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

// 메타데이터 단독 업데이트 함수
export const saveOfflineMetadata = async (trackId: string, metadata: { lyrics?: string | null, cover_art?: string | null }) => {
   return saveToOffline({ id: trackId }, undefined, metadata);
};

// 특정 트랙의 메타데이터 가져오기
export const getOfflineMetadata = async (trackId: string) => {
   const db = await initDB();
   return new Promise<any>((resolve, reject) => {
       const tx = db.transaction(STORE_NAME, 'readonly');
       const store = tx.objectStore(STORE_NAME);
       const request = store.get(trackId);
       request.onsuccess = () => resolve(request.result);
       request.onerror = () => reject(request.error);
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
