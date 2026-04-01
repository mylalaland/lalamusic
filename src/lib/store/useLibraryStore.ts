import { create } from 'zustand'

interface LibraryState {
  // Navigation & View State
  currentView: 'menu' | 'tracks' | 'playlists' | 'foldermap' | 'folder_detail'
  
  // Data State
  tracks: any[]
  playlists: any[]
  folders: any[]
  totalCount: number
  
  // Settings State
  baseFolderId: string | null 
  
  // Selection State
  selectedFolder: any | null
  folderTracks: any[]
  selectedPlaylist: any | null
  playlistTracks: any[]
  
  // [NEW] 다중 선택 및 정렬 상태
  selectedFolderIds: string[] // 체크된 폴더 ID 목록
  sortBy: 'name' | 'artist' | 'album' | 'date' // 'date' 추가됨
  sortOrder: 'asc' | 'desc' // 정렬 방향
  
  // UI/Search State
  loading: boolean
  page: number
  hasMore: boolean
  searchQuery: string
  isAiMode: boolean
  
  // Actions
  setState: (state: Partial<LibraryState>) => void
  toggleFolderSelection: (id: string) => void // 체크박스 토글 함수
  reset: () => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  currentView: 'menu',
  tracks: [],
  playlists: [],
  folders: [],
  totalCount: 0,
  baseFolderId: null,
  
  selectedFolder: null,
  folderTracks: [],
  selectedPlaylist: null,
  playlistTracks: [],
  
  // 초기값 설정
  selectedFolderIds: [],
  sortBy: 'date', // 기본: 최신순
  sortOrder: 'desc', // 기본: 내림차순 (최신이 위로)
  
  loading: false,
  page: 0,
  hasMore: true,
  searchQuery: '',
  isAiMode: false,

  setState: (newState) => set((state) => ({ ...state, ...newState })),
  
  // 폴더 다중 선택 토글 로직
  toggleFolderSelection: (id) => set((state) => {
      const exists = state.selectedFolderIds.includes(id)
      return {
          selectedFolderIds: exists 
              ? state.selectedFolderIds.filter(fid => fid !== id)
              : [...state.selectedFolderIds, id]
      }
  }),
  
  reset: () => set({
    currentView: 'menu',
    tracks: [],
    playlists: [],
    folders: [],
    searchQuery: '',
    isAiMode: false,
    selectedFolderIds: []
  })
}))