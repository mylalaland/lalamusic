'use client'

import { useEffect, useState } from 'react'
import { getPlaylists, createPlaylist, deletePlaylist, getPlaylistTracks } from '@/app/actions/playlist'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { useListStore } from '@/lib/store/useListStore'
import {
  ListMusic, Plus, Music, Play, ArrowLeft, Shuffle,
  Clock, Disc3, Trash2
} from 'lucide-react'

function getFormatFromMime(mimeType?: string) {
  if (!mimeType) return 'AUDIO'
  const map: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
    'audio/wav': 'WAV', 'audio/mp4': 'M4A', 'audio/aac': 'AAC', 'audio/ogg': 'OGG',
  }
  return map[mimeType] || 'AUDIO'
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
      <div className="h-full flex flex-col relative" style={{ background: '#0a0e14' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, rgba(255,89,227,0.15) 0%, transparent 100%)' }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#ff59e3 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 px-8 pt-6 pb-4 relative z-10">
          <button onClick={() => { setSelectedPlaylist(null); setTracks([]) }}
            className="w-8 h-8 flex items-center justify-center text-[#72757d] hover:text-[#99f7ff] transition border border-[#44484f]/50 hover:border-[#99f7ff]/30">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#f1f3fc] tracking-tight">{selectedPlaylist.name}</h1>
            <p className="font-['Space_Grotesk'] text-[9px] text-[#ff59e3] tracking-[0.3em] uppercase">PLAYLIST</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-8 py-3 flex items-center gap-3 relative z-10">
          <button onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-1.5 font-['Space_Grotesk'] text-xs tracking-wider text-[#004145] font-bold"
            style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)' }}>
            <Play size={12} fill="currentColor" /> PLAY_ALL
          </button>
          <button onClick={handleShuffle}
            className="flex items-center gap-2 px-4 py-1.5 text-[#72757d] font-['Space_Grotesk'] text-xs tracking-wider hover:text-[#99f7ff] transition border border-[#44484f]/50 hover:border-[#99f7ff]/30">
            <Shuffle size={12} /> SHUFFLE
          </button>
          <span className="font-['Space_Grotesk'] text-[10px] text-[#44484f] tracking-widest ml-2">{tracks.length} TRACKS</span>
        </div>

        {/* Table Header */}
        <div className="px-8">
          <div className="grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 px-3 py-2" style={{ borderBottom: '1px solid rgba(153,247,255,0.06)' }}>
            <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">#</span>
            <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">제목</span>
            <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">아티스트</span>
            <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">포맷</span>
            <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest text-right"><Clock size={10} /></span>
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(153,247,255,0.15) transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#72757d]">
              <div className="w-4 h-4 border-2 border-[#99f7ff] border-t-transparent animate-spin mr-2" />
              <span className="font-['Space_Grotesk'] text-xs tracking-widest">LOADING...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Music size={48} className="text-[#44484f] mb-4" />
              <p className="font-['Space_Grotesk'] text-xs text-[#44484f] tracking-widest uppercase">EMPTY_PLAYLIST</p>
            </div>
          ) : (
            <div className="flex flex-col mt-1">
              {tracks.map((track, index) => {
                const isActive = currentTrack?.id === track.id
                const fmt = getFormatFromMime(track.mime_type)
                return (
                  <div key={track.id} onClick={() => handlePlayTrack(track)}
                    className={`group grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 items-center px-3 py-2.5 cursor-pointer transition-all border-l-2 ${
                      isActive ? 'bg-[#99f7ff]/5 border-[#99f7ff]' : 'border-transparent hover:bg-white/3 hover:border-[#99f7ff]/20'
                    }`}>
                    <span className="font-['Space_Grotesk'] text-[11px] text-[#72757d] text-center">
                      {isActive && isPlaying ? <Disc3 size={14} className="animate-spin text-[#99f7ff] mx-auto" /> : index + 1}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-[#1b2028] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {track.thumbnail_link
                          ? <img src={track.thumbnail_link} className="w-full h-full object-cover" alt="" />
                          : <Music size={14} className="text-[#44484f]" />}
                      </div>
                      <span className={`font-['Space_Grotesk'] text-sm truncate tracking-tight ${isActive ? 'text-[#99f7ff] font-bold' : 'text-[#f1f3fc]'}`}>
                        {track.title || track.file_name?.replace(/\.[^.]+$/, '')}
                      </span>
                    </div>
                    <span className="font-['Inter'] text-xs text-[#72757d] truncate">{track.artist || 'Unknown'}</span>
                    <span className="text-[9px] font-['Space_Grotesk'] text-[#99f7ff]/60 bg-[#99f7ff]/8 px-1.5 py-0.5 border border-[#99f7ff]/15 text-center w-fit">{fmt}</span>
                    <span className="font-['Space_Grotesk'] text-[10px] text-[#72757d] text-right">
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
    <div className="h-full flex flex-col relative" style={{ background: '#0a0e14' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, rgba(255,89,227,0.15) 0%, transparent 100%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#ff59e3 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4 relative z-10">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-[#f1f3fc] tracking-tight">PLAYLISTS</h1>
          <p className="font-['Space_Grotesk'] text-[10px] text-[#44484f] tracking-[0.3em] mt-1">CUSTOM_COLLECTIONS</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 font-['Space_Grotesk'] text-xs tracking-wider text-[#99f7ff] border border-[#99f7ff]/30 hover:bg-[#99f7ff]/5 transition">
          <Plus size={14} /> NEW_LIST
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(153,247,255,0.15) transparent' }}>
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <button onClick={() => setShowCreateModal(true)}
              className="w-20 h-20 flex items-center justify-center mb-4 border border-[#44484f]/50 hover:border-[#99f7ff]/30 hover:bg-[#99f7ff]/5 transition">
              <Plus size={32} className="text-[#44484f]" />
            </button>
            <p className="font-['Space_Grotesk'] text-xs text-[#44484f] tracking-widest uppercase">NO_PLAYLISTS</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-2">
            {playlists.map(pl => (
              <div key={pl.id} onClick={() => handleSelect(pl)}
                className="group p-4 cursor-pointer transition-all border border-transparent hover:border-[#ff59e3]/15 hover:bg-[#ff59e3]/5">
                <div className="aspect-square w-full bg-[#1b2028] border border-white/5 mb-3 flex items-center justify-center relative overflow-hidden">
                  <ListMusic size={40} className="text-[#44484f]" />
                  <button onClick={(e) => { e.stopPropagation(); handlePlayAll() }}
                    className="absolute bottom-2 right-2 w-9 h-9 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
                    style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)' }}>
                    <Play size={14} fill="#004145" className="text-[#004145] ml-0.5" />
                  </button>
                </div>
                <h3 className="font-['Space_Grotesk'] text-sm text-[#f1f3fc] truncate font-medium">{pl.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="font-['Inter'] text-[10px] text-[#72757d]">Playlist</p>
                  <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(pl.id) }}
                    className="text-[#44484f] hover:text-red-400 transition opacity-0 group-hover:opacity-100">
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
        <div className="fixed inset-0 z-50 bg-[#0a0e14]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#1b2028] border border-[#ff59e3]/30 p-6 w-96 shadow-[0_0_30px_rgba(255,89,227,0.1)]">
            <h2 className="font-['Space_Grotesk'] text-lg text-[#f1f3fc] font-bold mb-4">NEW_PLAYLIST</h2>
            <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus
              placeholder="플레이리스트 이름을 입력하세요" className="w-full bg-[#0a0e14] border border-[#ff59e3]/20 px-4 py-3 text-sm text-[#f1f3fc] font-['Space_Grotesk'] focus:outline-none focus:border-[#ff59e3]/50 mb-6" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 font-['Space_Grotesk'] text-xs tracking-wider text-[#72757d] hover:text-[#f1f3fc] transition">CANCEL</button>
              <button onClick={handleCreate} className="px-5 py-2 font-['Space_Grotesk'] font-bold text-[#004145] tracking-wider transition hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #ff59e3, #ff80ed)' }}>CREATE</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[#0a0e14]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#1b2028] border border-red-500/30 p-6 w-96 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <h2 className="font-['Space_Grotesk'] text-lg text-[#f1f3fc] font-bold mb-2">DELETE PLAYLIST</h2>
            <p className="text-sm text-[#72757d] font-['Space_Grotesk'] mb-6">정말 이 플레이리스트를 삭제하시겠습니까?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="px-4 py-2 font-['Space_Grotesk'] text-xs tracking-wider text-[#72757d] hover:text-[#f1f3fc] transition">CANCEL</button>
              <button onClick={() => handleDelete(showDeleteModal)} className="px-5 py-2 font-['Space_Grotesk'] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white transition tracking-wider">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
