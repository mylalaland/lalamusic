'use client'

import { useEffect, useState, useRef } from 'react'
import { getPlaylists, createPlaylist, deletePlaylist, getPlaylistTracks, removeTrackFromPlaylist } from '@/app/actions/playlist'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { useListStore } from '@/lib/store/useListStore' 
import { ListMusic, Plus, Trash2, Music, Play, ArrowLeft, X, Shuffle } from 'lucide-react'

export default function ListsPage() {
  const [playlists, setPlaylists] = useState<any[]>([])
  
  // 전역 스토어 사용 (탭 이동 시 상태 유지)
  const { selectedPlaylist, tracks, setSelectedPlaylist, setTracks } = useListStore()
  const { setPlaylist, setTrack } = usePlayerStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPlaylists()
    
    // [NEW] 스크롤 위치 복원
    const savedScroll = sessionStorage.getItem('lists_scroll_pos')
    if (containerRef.current && savedScroll) {
        containerRef.current.scrollTop = Number(savedScroll)
    }
  }, [])

  // [NEW] 스크롤 위치 저장 핸들러
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop
      sessionStorage.setItem('lists_scroll_pos', String(scrollTop))
  }

  const loadPlaylists = async () => {
    // [FIX] 세션 스토리지 캐싱으로 탭 이동 시 상태 유지
    const cached = sessionStorage.getItem('playlists_cache')
    if (cached) {
        setPlaylists(JSON.parse(cached))
    }

    try {
        const data = await getPlaylists()
        setPlaylists(data)
        sessionStorage.setItem('playlists_cache', JSON.stringify(data))
    } catch (e) { console.error(e) }
  }

  const handleCreate = async () => {
    const name = prompt('새 플레이리스트 이름:')
    if (name) {
      await createPlaylist(name)
      loadPlaylists() 
    }
  }

  const handleSelect = async (pl: any) => {
    setSelectedPlaylist(pl) 
    const data = await getPlaylistTracks(pl.id)
    setTracks(data)         
  }

  const handleBack = () => {
    setSelectedPlaylist(null)
    setTracks([])
  }

  const handleDeletePlaylist = async (e: any, id: string) => {
    e.stopPropagation() 
    if (confirm('정말 이 플레이리스트를 삭제하시겠습니까?')) {
      await deletePlaylist(id)
      if (selectedPlaylist?.id === id) handleBack()
      loadPlaylists()
    }
  }

  // 곡 삭제 핸들러
  const handleRemoveTrack = async (e: any, trackId: string) => {
    e.stopPropagation() 
    if (!confirm("이 곡을 플레이리스트에서 뺄까요?")) return

    const res = await removeTrackFromPlaylist(selectedPlaylist.id, trackId)
    if (res.success) {
        setTracks(tracks.filter(t => t.id !== trackId))
    } else {
        alert("삭제 실패: " + res.error)
    }
  }

  // [NEW] 셔플 재생 핸들러
  const handleShuffle = () => {
    if (tracks.length === 0) return
    // 배열 섞기 (Fisher-Yates가 더 좋지만 간단히 sort 사용)
    const shuffled = [...tracks].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled)
    setTrack(shuffled[0])
  }

  return (
    <div className="min-h-screen analog-surface text-[var(--text-main)] flex flex-col pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-[color:var(--bg-surface)]/90 backdrop-blur-md z-20 border-b border-[var(--border-strong)]">
        <div className="px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedPlaylist ? (
                <button onClick={handleBack} className="p-2 -ml-2 hover:bg-[var(--bg-container-high)] rounded-full transition">
                    <ArrowLeft />
                </button>
            ) : (
                <ListMusic size={24} className="text-[var(--tertiary)]" />
            )}
            <h1 className="text-2xl font-bold text-[var(--text-main)] truncate max-w-[200px]">
              {selectedPlaylist ? selectedPlaylist.name : 'Playlists'}
            </h1>
          </div>
          
          {!selectedPlaylist && (
              <button 
                  onClick={handleCreate} 
                  className="p-3 bg-[var(--tertiary)] rounded-full hover:bg-[var(--tertiary)]/80 shadow-lg transition active:scale-95"
              >
                  <Plus size={24} />
              </button>
          )}
        </div>
      </div>

      <div className="p-4 flex-1">


        {!selectedPlaylist && (
            <div className="space-y-3">
                {playlists.length === 0 && (
                    <div className="text-center py-20 text-[color:var(--text-muted)]/80 flex flex-col items-center">
                        <ListMusic size={48} className="mb-4 opacity-20"/>
                        <p>플레이리스트가 없습니다.</p>
                        <p className="text-sm mt-2 text-[color:var(--text-muted)]/60">우측 상단 + 버튼을 눌러 만들어보세요.</p>
                    </div>
                )}
                {playlists.map(pl => (
                    <div key={pl.id} onClick={() => handleSelect(pl)} 
                         className="bg-[color:var(--bg-container)]/60 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[var(--bg-container-high)] transition border border-[var(--border-strong)] group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[var(--bg-container-high)] rounded-lg flex items-center justify-center text-[color:var(--text-muted)]/80 group-hover:text-[var(--tertiary)] transition">
                                <ListMusic size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-lg text-[var(--text-main)] group-hover:text-[var(--text-main)]">{pl.name}</p>
                                <p className="text-xs text-[color:var(--text-muted)]/80">{new Date(pl.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <button onClick={(e) => handleDeletePlaylist(e, pl.id)} className="p-3 text-[color:var(--text-muted)]/60 hover:text-red-500 hover:bg-red-500/10 rounded-full transition">
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* 상세 뷰 */}
        {selectedPlaylist && (
            <div className="space-y-1">
                {tracks.length > 0 ? (
                    <div className="flex gap-2 mb-6">
                        {/* Play All 버튼 */}
                        <button onClick={() => { setPlaylist(tracks); setTrack(tracks[0]); }} 
                                className="flex-1 py-4 bg-[var(--tertiary)]/10 text-[var(--tertiary)] rounded-xl font-bold hover:bg-[var(--tertiary)]/20 flex items-center justify-center gap-2 transition border border-[var(--tertiary)]/20">
                            <Play size={20} fill="currentColor"/> Play All ({tracks.length})
                        </button>
                        
                        {/* [NEW] 셔플 버튼 */}
                        <button onClick={handleShuffle} 
                                className="w-16 bg-[var(--bg-container-high)] rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container-highest)] transition border border-[var(--border-strong)]">
                            <Shuffle size={24} />
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-20 text-[color:var(--text-muted)]/80 flex flex-col items-center">
                        <Music size={48} className="mb-4 opacity-20"/>
                        <p>아직 곡이 없습니다.</p>
                        <p className="text-sm mt-2 text-[color:var(--text-muted)]/60">Library 탭에서 노래 옆 + 버튼을 눌러 추가하세요.</p>
                    </div>
                )}
                
                {tracks.map((track, i) => (
                    <div key={i} onClick={() => { setPlaylist(tracks); setTrack(track); }} 
                         className="flex items-center gap-3 p-3 hover:bg-[var(--bg-container-highest)] rounded-xl cursor-pointer group transition">
                        <div className="w-12 h-12 bg-[var(--bg-container-high)] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {track.cover_art || track.thumbnail_link || track.thumbnailLink ? (
                                <img 
                                    src={track.cover_art || track.thumbnail_link || track.thumbnailLink} 
                                    loading="lazy" 
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Music size={20} className="text-[color:var(--text-muted)]/80"/>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-[var(--text-main)]">{track.name}</p>
                            <p className="truncate text-xs text-[color:var(--text-muted)]/80">{track.artist || 'Unknown'}</p>
                        </div>
                        
                        <button 
                            onClick={(e) => handleRemoveTrack(e, track.id)}
                            className="p-2 text-[color:var(--text-muted)]/60 hover:text-red-500 hover:bg-[var(--bg-container-highest)] rounded-full transition"
                            title="플레이리스트에서 제거"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}