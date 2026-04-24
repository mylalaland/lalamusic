'use client'

import { useEffect, useState } from 'react'
import { getPlaylists, createPlaylist, deletePlaylist, getPlaylistTracks } from '@/app/actions/playlist'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { useListStore } from '@/lib/store/useListStore'
import {
  ListMusic, Plus, Music, Play, ArrowLeft, Shuffle,
  Clock, Disc3, Trash2
} from 'lucide-react'

function getFormatFromMime(mimeType?: string, fileName?: string) {
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'M4A';
    if (lower.endsWith('.flac')) return 'FLAC';
    if (lower.endsWith('.mp3')) return 'MP3';
    if (lower.endsWith('.wav')) return 'WAV';
    if (lower.endsWith('.aac')) return 'AAC';
  }
  if (!mimeType) return 'AUDIO'
  const map: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
    'audio/wav': 'WAV', 'audio/mp4': 'M4A', 'audio/aac': 'AAC', 'audio/ogg': 'OGG',
  }
  return map[mimeType] || mimeType.replace('audio/', '').toUpperCase()
}

export default function DesktopLists() {
  const [playlists, setPlaylists] = useState<any[]>([])
  const { selectedPlaylist, tracks, setSelectedPlaylist, setTracks } = useListStore()
  const { setPlaylist, setTrack, currentTrack, isPlaying } = usePlayerStore()
  const [loading, setLoading] = useState(false)
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null)

  useEffect(() => { loadPlaylists() }, [])

  const loadPlaylists = async () => {
    try { setPlaylists(await getPlaylists()) } catch (e) { console.error(e) }
  }

  const handleCreate = async () => {
    if (newListName.trim()) { 
        await createPlaylist(newListName.trim())
        setShowCreateModal(false)
        setNewListName('')
        loadPlaylists() 
    }
  }

  const handleSelect = async (pl: any) => {
    setSelectedPlaylist(pl)
    setLoading(true)
    setTracks(await getPlaylistTracks(pl.id))
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await deletePlaylist(id)
    if (selectedPlaylist?.id === id) { setSelectedPlaylist(null); setTracks([]) }
    setShowDeleteModal(null)
    loadPlaylists()
  }

  const toMusicFile = (t: any) => ({
    id: t.id, name: t.title || t.file_name, artist: t.artist || 'Unknown',
    thumbnailLink: t.thumbnail_link, src: t.drive_file_id, mimeType: t.mime_type
  })

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    const pl = tracks.map(toMusicFile)
    setPlaylist(pl); setTrack(pl[0])
  }

  const handleShuffle = () => {
    if (tracks.length === 0) return
    const pl = tracks.map(toMusicFile)
    const shuffled = [...pl].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled); setTrack(shuffled[0])
  }

  const handlePlayTrack = (track: any) => {
    const pl = tracks.map(toMusicFile)
    const target = pl.find(p => p.id === track.id)
    if (target) { setPlaylist(pl); setTrack(target) }
  }

  // --- PLAYLIST DETAIL ---
  if (selectedPlaylist) {
    return (
      <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 px-8 pt-6 pb-4 relative z-10">
          <button onClick={() => { setSelectedPlaylist(null); setTracks([]) }}
            className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--tertiary)] transition border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight">{selectedPlaylist.name}</h1>
            <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase">PLAYLIST</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-8 py-3 flex items-center gap-3 relative z-10">
          <button onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-1.5 font-['Work_Sans'] text-xs tracking-wider text-[var(--on-primary)] font-bold"
            style={{ background: 'var(--primary)' }}>
            <Play size={12} fill="currentColor" /> PLAY_ALL
          </button>
          <button onClick={handleShuffle}
            className="flex items-center gap-2 px-4 py-1.5 text-[var(--text-muted)] font-['Work_Sans'] text-xs tracking-wider hover:text-[var(--tertiary)] transition border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30">
            <Shuffle size={12} /> SHUFFLE
          </button>
          <span className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] tracking-widest ml-2">{tracks.length} TRACKS</span>
        </div>

        {/* Table Header */}
        <div className="px-8">
          <div className="grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--bg-container-high)' }}>
            <span className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-widest">#</span>
            <span className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-widest">제목</span>
            <span className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-widest">아티스트</span>
            <span className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-widest">포맷</span>
            <span className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-widest text-right"><Clock size={10} /></span>
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
              <div className="w-4 h-4 border-2 border-[var(--tertiary)] border-t-transparent animate-spin mr-2" />
              <span className="font-['Work_Sans'] text-xs tracking-widest">LOADING...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Music size={48} className="text-[var(--text-muted)] mb-4" />
              <p className="font-['Work_Sans'] text-xs text-[var(--text-muted)] tracking-widest uppercase">EMPTY_PLAYLIST</p>
            </div>
          ) : (
            <div className="flex flex-col mt-1">
              {tracks.map((track, index) => {
                const isActive = currentTrack?.id === track.id
                const fmt = getFormatFromMime(track.mime_type ?? undefined, track.title || track.file_name)
                return (
                  <div key={track.id} onClick={() => handlePlayTrack(track)}
                    className={`group grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 items-center px-3 py-2.5 cursor-pointer transition-all border-l-2 ${
                      isActive ? 'bg-[color:var(--tertiary)]/5 border-[var(--tertiary)]' : 'border-transparent hover:bg-[var(--bg-container-high)] hover:border-[color:var(--tertiary)]/20'
                    }`}>
                    <span className="font-['Work_Sans'] text-[11px] text-[var(--text-muted)] text-center">
                      {isActive && isPlaying ? <Disc3 size={14} className="animate-spin text-[var(--tertiary)] mx-auto" /> : index + 1}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-[var(--bg-container)] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {track.thumbnail_link
                          ? <img src={track.thumbnail_link} className="w-full h-full object-cover" alt="" />
                          : <Music size={14} className="text-[var(--text-muted)]" />}
                      </div>
                      <span className={`font-['Work_Sans'] text-sm truncate tracking-tight ${isActive ? 'text-[var(--tertiary)] font-bold' : 'text-[var(--text-main)]'}`}>
                        {track.title || track.file_name?.replace(/\.[^.]+$/, '')}
                      </span>
                    </div>
                    <span className="font-['Noto_Serif'] text-xs text-[var(--text-muted)] truncate">{track.artist || 'Unknown'}</span>
                    <span className="text-[9px] font-['Work_Sans'] text-[color:var(--tertiary)]/60 bg-[color:var(--tertiary)]/8 px-1.5 py-0.5 border border-[color:var(--tertiary)]/15 text-center w-fit">{fmt}</span>
                    <span className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] text-right">
                      {track.duration ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '--:--'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- PLAYLISTS MAIN VIEW ---
  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4 relative z-10">
        <div>
          <h1 className="font-['Work_Sans'] text-2xl font-bold text-[var(--text-main)] tracking-tight">PLAYLISTS</h1>
          <p className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] tracking-[0.3em] mt-1">CUSTOM_COLLECTIONS</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 font-['Work_Sans'] text-xs tracking-wider text-[var(--tertiary)] border border-[color:var(--tertiary)]/30 hover:bg-[color:var(--tertiary)]/5 transition">
          <Plus size={14} /> NEW_LIST
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <button onClick={() => setShowCreateModal(true)}
              className="w-20 h-20 flex items-center justify-center mb-4 border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30 hover:bg-[color:var(--tertiary)]/5 transition">
              <Plus size={32} className="text-[var(--text-muted)]" />
            </button>
            <p className="font-['Work_Sans'] text-xs text-[var(--text-muted)] tracking-widest uppercase">NO_PLAYLISTS</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-2">
            {playlists.map(pl => (
              <div key={pl.id} onClick={() => handleSelect(pl)}
                className="group p-4 cursor-pointer transition-all border border-transparent hover:border-[color:var(--tertiary)]/15 hover:bg-[color:var(--tertiary)]/5">
                <div className="aspect-square w-full bg-[var(--bg-container)] border border-white/5 mb-3 flex items-center justify-center relative overflow-hidden">
                  <ListMusic size={40} className="text-[var(--text-muted)]" />
                  <button onClick={(e) => { e.stopPropagation(); handlePlayAll() }}
                    className="absolute bottom-2 right-2 w-9 h-9 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
                    style={{ background: 'var(--primary)' }}>
                    <Play size={14} fill="#004145" className="text-[var(--on-primary)] ml-0.5" />
                  </button>
                </div>
                <h3 className="font-['Work_Sans'] text-sm text-[var(--text-main)] truncate font-medium">{pl.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Playlist</p>
                  <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(pl.id) }}
                    className="text-[var(--text-muted)] hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-main)]/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] p-6 w-96 shadow-[var(--shadow-ambient)] rounded-md">
            <h2 className="font-['Work_Sans'] text-lg text-[var(--text-main)] font-bold mb-4">NEW_PLAYLIST</h2>
            <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus
              placeholder="플레이리스트 이름을 입력하세요" className="w-full bg-[var(--bg-surface)] border border-[color:var(--border-light)] px-4 py-3 text-sm text-[var(--text-main)] font-['Work_Sans'] focus:outline-none focus:border-[color:var(--tertiary)]/50 mb-6" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 font-['Work_Sans'] text-xs tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition">CANCEL</button>
              <button onClick={handleCreate} className="px-5 py-2 font-['Work_Sans'] font-bold text-[var(--on-primary)] tracking-wider transition hover:scale-105"
                style={{ background: 'var(--primary)' }}>CREATE</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[color:var(--bg-surface)]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[var(--bg-container)] border border-red-500/30 p-6 w-96 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <h2 className="font-['Work_Sans'] text-lg text-[var(--text-main)] font-bold mb-2">DELETE PLAYLIST</h2>
            <p className="text-sm text-[var(--text-muted)] font-['Work_Sans'] mb-6">정말 이 플레이리스트를 삭제하시겠습니까?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="px-4 py-2 font-['Work_Sans'] text-xs tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition">CANCEL</button>
              <button onClick={() => handleDelete(showDeleteModal)} className="px-5 py-2 font-['Work_Sans'] font-bold bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition tracking-wider">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
