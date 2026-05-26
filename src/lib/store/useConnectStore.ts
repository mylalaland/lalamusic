import { create } from 'zustand'

interface FolderInfo {
  id: string
  name: string
}

interface ConnectState {
  path: FolderInfo[]
  items: any[]
  originalItems: any[]          // [NEW] 필터링/검색 전 원본 데이터 캐시
  currentFolderId: string | null
  isAiProcessing: boolean
  isAiFiltered: boolean
  serverSort: string            // [NEW] 정렬 상태 유지 (name, modified, size)
  filterBy: string              // [NEW] 필터 상태 유지 (all, folders, files)

  // 액션
  setPath: (path: FolderInfo[]) => void
  pushPath: (folder: FolderInfo) => void
  popPath: () => void
  jumpTo: (index: number) => void
  setItems: (items: any[]) => void
  setOriginalItems: (items: any[]) => void   // [NEW]
  setCurrentFolderId: (id: string | null) => void
  setIsAiProcessing: (isProcessing: boolean) => void
  setIsAiFiltered: (isFiltered: boolean) => void
  setServerSort: (sort: string) => void      // [NEW]
  setFilterBy: (filter: string) => void      // [NEW]
  reset: () => void
}

export const useConnectStore = create<ConnectState>((set) => ({
  path: [{ id: 'root', name: 'Google Drive' }],
  items: [],
  originalItems: [],
  currentFolderId: null,
  isAiProcessing: false,
  isAiFiltered: false,
  serverSort: 'name',
  filterBy: 'all',

  setPath: (path) => set({ path }),
  pushPath: (folder) => set((state) => ({ path: [...state.path, folder] })),
  popPath: () => set((state) => ({ 
    path: state.path.length > 1 ? state.path.slice(0, -1) : state.path 
  })),
  jumpTo: (index) => set((state) => ({ 
    path: state.path.slice(0, index + 1) 
  })),
  setItems: (items) => set({ items }),
  setOriginalItems: (items) => set({ originalItems: items }),
  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setIsAiProcessing: (isProcessing) => set({ isAiProcessing: isProcessing }),
  setIsAiFiltered: (isFiltered) => set({ isAiFiltered: isFiltered }),
  setServerSort: (sort) => set({ serverSort: sort }),
  setFilterBy: (filter) => set({ filterBy: filter }),
  reset: () => set({ 
    path: [{ id: 'root', name: 'Google Drive' }], 
    items: [], 
    originalItems: [],
    currentFolderId: null,
    isAiProcessing: false,
    isAiFiltered: false,
    serverSort: 'name',
    filterBy: 'all'
  })
}))
