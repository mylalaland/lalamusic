import { create } from 'zustand'

interface FolderInfo {
  id: string
  name: string
}

interface ConnectState {
  path: FolderInfo[]
  items: any[]
  currentFolderId: string | null
  isAiProcessing: boolean // [NEW] AI 처리 상태 전역 관리
  isAiFiltered: boolean   // [NEW] 필터링 상태 전역 관리

  // 액션
  setPath: (path: FolderInfo[]) => void
  pushPath: (folder: FolderInfo) => void
  popPath: () => void
  jumpTo: (index: number) => void
  setItems: (items: any[]) => void
  setCurrentFolderId: (id: string | null) => void
  setIsAiProcessing: (isProcessing: boolean) => void // [NEW]
  setIsAiFiltered: (isFiltered: boolean) => void     // [NEW]
  reset: () => void
}

export const useConnectStore = create<ConnectState>((set) => ({
  path: [{ id: 'root', name: 'Google Drive' }],
  items: [],
  currentFolderId: null,
  isAiProcessing: false,
  isAiFiltered: false,

  setPath: (path) => set({ path }),
  pushPath: (folder) => set((state) => ({ path: [...state.path, folder] })),
  popPath: () => set((state) => ({ 
    path: state.path.length > 1 ? state.path.slice(0, -1) : state.path 
  })),
  jumpTo: (index) => set((state) => ({ 
    path: state.path.slice(0, index + 1) 
  })),
  setItems: (items) => set({ items }),
  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setIsAiProcessing: (isProcessing) => set({ isAiProcessing: isProcessing }),
  setIsAiFiltered: (isFiltered) => set({ isAiFiltered: isFiltered }),
  reset: () => set({ 
    path: [{ id: 'root', name: 'Google Drive' }], 
    items: [], 
    currentFolderId: null,
    isAiProcessing: false,
    isAiFiltered: false
  })
}))
