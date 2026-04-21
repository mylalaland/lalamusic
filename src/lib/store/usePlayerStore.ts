import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MusicFile {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string | null
  artist?: string | null
  album?: string | null
  title?: string | null
  cover_art?: string | null
  lyrics?: string | null
  duration?: number
  src?: string | null
}

export interface PlayerState {
  isPlaying: boolean
  currentTrack: MusicFile | null
  playlist: MusicFile[] 
  isExpanded: boolean   
  
  // Phase 3: Library & Quick Access states
  favorites: MusicFile[] // User's favorited tracks (changed from string IDs to support full offline rendering)
  recentTracks: MusicFile[] // History of recently played tracks
  
  eqGains: number[] // 5-band EQ gains (-12 to 12)
  setEqGain: (index: number, gain: number) => void
  
  setTrack: (track: MusicFile) => void
  setPlaylist: (list: MusicFile[]) => void
  togglePlay: () => void
  setExpanded: (expanded: boolean) => void
  playNext: () => void
  playPrev: () => void
  updateTrackMetadata: (id: string, metadata: Partial<MusicFile>) => void
  
  toggleFavorite: (track: MusicFile) => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      isPlaying: false,
      currentTrack: null,
      playlist: [],
      isExpanded: false,
      
      favorites: [],
      recentTracks: [],
      eqGains: [0, 0, 0, 0, 0],

      setEqGain: (index: number, gain: number) => set((state) => {
        const newGains = [...state.eqGains];
        newGains[index] = gain;
        return { eqGains: newGains };
      }),

      setTrack: (track) => set((state) => {
        // Add to recent tracks (keep last 50)
        const filteredRecent = state.recentTracks.filter(t => t.id !== track.id)
        const newRecent = [track, ...filteredRecent].slice(0, 50)
        
        return { 
          currentTrack: track, 
          isPlaying: true, // will be handled asynchronously by Audio Hook
          recentTracks: newRecent
        }
      }),
      
      setPlaylist: (list) => set({ playlist: list }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setExpanded: (expanded) => set({ isExpanded: expanded }),

      playNext: () => {
        const { playlist, currentTrack } = get()
        if (!currentTrack) return
        const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id)
        if (currentIndex < playlist.length - 1) {
          const nextTrack = playlist[currentIndex + 1]
          get().setTrack(nextTrack)
        }
      },

      playPrev: () => {
        const { playlist, currentTrack } = get()
        if (!currentTrack) return
        const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id)
        if (currentIndex > 0) {
          const prevTrack = playlist[currentIndex - 1]
          get().setTrack(prevTrack)
        }
      },

      updateTrackMetadata: (id, metadata) => set((state) => {
          if (state.currentTrack?.id === id) {
              return { currentTrack: { ...state.currentTrack, ...metadata } }
          }
          return {}
      }),
      
      toggleFavorite: (track) => set((state) => {
        // Handle migration from string[] to MusicFile[] gracefully
        const existingFavorites = Array.isArray(state.favorites) 
           ? state.favorites.filter((f: any) => typeof f !== 'string') // drop legacy string IDs
           : []
        
        const isFav = existingFavorites.some(f => f.id === track.id)
        return {
          favorites: isFav 
            ? existingFavorites.filter(f => f.id !== track.id) 
            : [...existingFavorites, track]
        }
      })
    }),
    {
      name: 'lala-player-storage',
      // Only persist these specific fields to localStorage
      partialize: (state) => ({ 
        favorites: state.favorites,
        recentTracks: state.recentTracks,
        eqGains: state.eqGains
      }),
    }
  )
)