import { create } from 'zustand'

interface ListState {
  // 상태 변수
  selectedPlaylist: any | null // 현재 보고 있는 플레이리스트 정보
  tracks: any[]                // 현재 보고 있는 곡 목록
  
  // 액션
  setSelectedPlaylist: (playlist: any | null) => void
  setTracks: (tracks: any[]) => void
}

export const useListStore = create<ListState>((set) => ({
  selectedPlaylist: null,
  tracks: [],

  setSelectedPlaylist: (playlist) => set({ selectedPlaylist: playlist }),
  setTracks: (tracks) => set({ tracks: tracks }),
}))