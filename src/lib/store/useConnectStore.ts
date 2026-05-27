import { create } from 'zustand'

interface FolderInfo {
  id: string
  name: string
}

interface ConnectState {
  path: FolderInfo[]
  items: any[]
  originalItems: any[]
  currentFolderId: string | null
  isAiProcessing: boolean
  isAiFiltered: boolean
  serverSort: string
  filterBy: string
  folderCache: Record<string, any[]>  // [NEW] 폴더별 캐시
  settingsLoaded: boolean             // [NEW] 설정 로딩 완료 여부
  cachedAllowedExts: string[]         // [NEW] 설정 캐시

  setPath: (path: FolderInfo[]) => void
  pushPath: (folder: FolderInfo) => void
  popPath: () => void
  jumpTo: (index: number) => void
  setItems: (items: any[]) => void
  setOriginalItems: (items: any[]) => void
  setCurrentFolderId: (id: string | null) => void
  setIsAiProcessing: (v: boolean) => void
  setIsAiFiltered: (v: boolean) => void
  setServerSort: (sort: string) => void
  setFilterBy: (filter: string) => void
  setCacheForFolder: (folderId: string, items: any[]) => void
  getCacheForFolder: (folderId: string) => any[] | null
  clearCache: () => void
  setSettingsLoaded: (v: boolean) => void
  setCachedAllowedExts: (exts: string[]) => void
  reset: () => void
}

export const useConnectStore = create<ConnectState>((set, get) => ({
  path: [{ id: 'root', name: 'Google Drive' }],
  items: [],
  originalItems: [],
  currentFolderId: null,
  isAiProcessing: false,
  isAiFiltered: false,
  serverSort: 'name',
  filterBy: 'all',
  folderCache: {},
  settingsLoaded: false,
  cachedAllowedExts: [],

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
  setIsAiProcessing: (v) => set({ isAiProcessing: v }),
  setIsAiFiltered: (v) => set({ isAiFiltered: v }),
  setServerSort: (sort) => set({ serverSort: sort, folderCache: {} }),  // 정렬 변경 시 캐시 초기화
  setFilterBy: (filter) => set({ filterBy: filter, folderCache: {} }),  // 필터 변경 시 캐시 초기화
  
  setCacheForFolder: (folderId, items) => set((state) => ({
    folderCache: { ...state.folderCache, [folderId]: items }
  })),
  getCacheForFolder: (folderId) => {
    return get().folderCache[folderId] || null
  },
  clearCache: () => set({ folderCache: {} }),
  setSettingsLoaded: (v) => set({ settingsLoaded: v }),
  setCachedAllowedExts: (exts) => set({ cachedAllowedExts: exts }),
  
  reset: () => set({ 
    path: [{ id: 'root', name: 'Google Drive' }], 
    items: [], originalItems: [],
    currentFolderId: null,
    isAiProcessing: false, isAiFiltered: false,
    serverSort: 'name', filterBy: 'all',
    folderCache: {},
    settingsLoaded: false, cachedAllowedExts: []
  })
}))
