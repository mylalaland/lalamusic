import { create } from 'zustand'

export interface MusicFile {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string | null
  artist?: string | null
  album?: string | null
  title?: string | null     // [NEW] 진짜 제목 추가
  cover_art?: string | null
  lyrics?: string | null
}

// ... (나머지 코드는 기존과 동일하므로 생략, 위 인터페이스만 수정해주시면 됩니다)
// 혹시 헷갈리시면 기존 파일의 'MusicFile' 인터페이스 부분에 'title?: string | null' 한 줄만 추가하세요.

interface PlayerState {
  isPlaying: boolean
  currentTrack: MusicFile | null
  playlist: MusicFile[] 
  isExpanded: boolean   
  
  setTrack: (track: MusicFile) => void
  setPlaylist: (list: MusicFile[]) => void
  togglePlay: () => void
  setExpanded: (expanded: boolean) => void
  playNext: () => void
  playPrev: () => void
  updateTrackMetadata: (id: string, metadata: Partial<MusicFile>) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentTrack: null,
  playlist: [],
  isExpanded: false,

  setTrack: (track) => set({ currentTrack: track, isPlaying: true }),
  setPlaylist: (list) => set({ playlist: list }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setExpanded: (expanded) => set({ isExpanded: expanded }),

  playNext: () => {
    const { playlist, currentTrack } = get()
    if (!currentTrack) return
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id)
    if (currentIndex < playlist.length - 1) {
      set({ currentTrack: playlist[currentIndex + 1], isPlaying: true })
    }
  },

  playPrev: () => {
    const { playlist, currentTrack } = get()
    if (!currentTrack) return
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id)
    if (currentIndex > 0) {
      set({ currentTrack: playlist[currentIndex - 1], isPlaying: true })
    }
  },

  updateTrackMetadata: (id, metadata) => set((state) => {
      if (state.currentTrack?.id === id) {
          return { currentTrack: { ...state.currentTrack, ...metadata } }
      }
      return {}
  }),
}))