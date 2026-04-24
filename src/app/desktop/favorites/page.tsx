'use client'

import React from 'react'
import { usePlayerStore, MusicFile } from '@/lib/store/usePlayerStore'
import { Heart, PlayCircle, Play, Music, Trash2 } from 'lucide-react'

export default function DesktopFavorites() {
  const { favorites, setTrack, setPlaylist, currentTrack, isPlaying, togglePlay, toggleFavorite } = usePlayerStore()
  
  const handlePlayAll = () => {
    if (favorites.length === 0) return
    setPlaylist(favorites)
    setTrack(favorites[0])
  }

  const handlePlayFile = (track: MusicFile) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }
    setPlaylist(favorites)
    setTrack(track)
  }

  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
      </div>

      <div className="px-8 pt-8 pb-4 relative z-10">
        <h1 className="font-['Work_Sans'] text-3xl font-bold text-[var(--text-main)] tracking-tight mb-4 flex items-center gap-3">
          <Heart size={28} className="text-[var(--tertiary)]" fill="currentColor" />
          FAVORITES
        </h1>
        <div className="flex items-center gap-4">
          <button 
             onClick={handlePlayAll}
             disabled={favorites.length === 0}
             className="flex items-center gap-2 px-6 py-2.5 text-sm font-['Work_Sans'] font-bold tracking-wide text-[var(--on-primary)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-[var(--shadow-ambient)]"
             style={{ background: 'var(--primary)' }}
          >
            <PlayCircle size={18} /> PLAY_ALL
          </button>
          <span className="text-xs font-['Work_Sans'] text-[var(--text-muted)] tracking-widest uppercase">
            {favorites.length} TRACKS
          </span>
        </div>
      </div>

      {/* TRACK LIST */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
        {favorites.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-32 gap-3 opacity-50">
             <Heart size={48} className="text-[var(--text-muted)]" />
             <p className="text-sm font-['Work_Sans'] text-[var(--text-muted)] tracking-[0.2em] uppercase">저장된 좋아요 항목이 없습니다.</p>
           </div>
        ) : (
          <div className="space-y-[2px]">
            {favorites.map((track, idx) => {
              const active = currentTrack?.id === track.id
              return (
                <div key={`${track.id}-${idx}`}
                  onDoubleClick={() => handlePlayFile(track)}
                  className={`group flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer select-none
                    ${active ? 'bg-[color:var(--tertiary)]/10 border border-[color:var(--tertiary)]/20' : 'hover:bg-[var(--bg-container-highest)] border border-transparent'}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-8 text-center text-[10px] font-['Work_Sans'] font-bold text-[var(--text-muted)] group-hover:text-[var(--tertiary)] transition-colors relative">
                      {active ? (
                        <div className="w-full flex justify-center">
                          <div className="w-2.5 h-2.5 bg-[var(--tertiary)] rounded-full animate-pulse shadow-[0_0_8px_var(--tertiary)]" />
                        </div>
                      ) : (
                        <span className="group-hover:hidden">{idx + 1}</span>
                      )}
                      {!active && (
                        <button onClick={() => handlePlayFile(track)} className="hidden group-hover:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--tertiary)]">
                          <Play size={12} fill="currentColor" />
                        </button>
                      )}
                    </div>
                    
                    <div className="w-10 h-10 relative bg-[var(--bg-container)] flex-shrink-0 border border-[var(--border-light)] overflow-hidden flex items-center justify-center">
                      {(track as any).thumbnailLink || (track as any).cover_art ? (
                        <img src={(track as any).thumbnailLink || (track as any).cover_art} alt="cover" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={16} className="text-[var(--text-muted)]" />
                      )}
                    </div>
                    
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className={`text-sm font-medium truncate ${active ? 'text-[var(--tertiary)]' : 'text-[var(--text-main)]'}`}>{track.name}</span>
                      <span className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{track.artist || 'Unknown Artist'}</span>
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                     <button onClick={(e) => { e.stopPropagation(); toggleFavorite(track) }} 
                        className="p-2 text-[var(--tertiary)] hover:scale-110 transition-transform"
                        title="좋아요 취소">
                        <Heart size={14} fill="currentColor" />
                     </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
