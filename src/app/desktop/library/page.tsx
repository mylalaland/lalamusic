'use client'

import { useEffect, useState, useMemo } from 'react'
import { getLibraryTracks, getLibraryCount } from '@/app/actions/library'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import {
  Search, Music, Play, Shuffle, Heart, Clock, Bookmark, Disc3,
  Star, Users, Mic2, Hash, PenTool, ChevronRight, ArrowLeft, Loader2
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

const quickAccess = [
  { key: 'favorites',  label: 'FAVORITES',  icon: Heart,    desc: 'Liked tracks' },
  { key: 'recents',    label: 'RECENTS',     icon: Clock,    desc: 'Recently played' },
  { key: 'bookmarks',  label: 'BOOKMARKS',   icon: Bookmark, desc: 'Audio bookmarks' },
]
const categories = [
  { key: 'songs',    label: 'ALL_TRACKS',  icon: Music },
  { key: 'albums',   label: 'ALBUMS',      icon: Disc3 },
  { key: 'artists',  label: 'ARTISTS',     icon: Users },
  { key: 'genres',   label: 'GENRES',      icon: Hash },
]

export default function DesktopLibrary() {
  const { setTrack, setPlaylist, currentTrack, isPlaying, recentTracks, favorites } = usePlayerStore()
  const [view, setView] = useState<'menu' | 'songs' | 'recents' | 'favorites' | 'albums' | 'artists' | 'bookmarks' | 'genres'>('menu')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [groupedItems, setGroupedItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [trackCount, setTrackCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { getLibraryCount().then(setTrackCount) }, [])

  const loadAllTracks = async () => {
    setLoading(true)
    const data = await getLibraryTracks('', 5000, 0)
    setTracks(data)
    setLoading(false)
  }

  const handleMenuClick = async (key: string) => {
    setView(key as any)
    setSelectedGroup(null)
    if (key === 'recents') { /* store에서 바로 사용 */ }
    else if (key === 'bookmarks') {
      if (bookmarks.length === 0) {
        setLoading(true)
        const { getBookmarks } = await import('@/app/actions/bookmarks')
        const data = await getBookmarks()
        setBookmarks(data)
        setLoading(false)
      }
    } else if (key === 'albums' || key === 'artists' || key === 'genres') {
      setLoading(true)
      const field = key === 'albums' ? 'album' : key === 'artists' ? 'artist' : 'genre'
      const { getLibraryGroups } = await import('@/app/actions/library')
      const groups = await getLibraryGroups(field)
      setGroupedItems(groups.sort((a: any, b: any) => b.count - a.count))
      setLoading(false)
    } else {
      if (tracks.length === 0) await loadAllTracks()
    }
  }

  const handlePlayTrack = (track: any) => {
    const list = view === 'bookmarks' ? bookmarks.map(b => ({...b.track, _bookmarkObj: b})) : tracks
    const playlist = list.map(t => ({
      id: t.id, name: t.title || t.file_name, artist: t.artist || 'Unknown',
      thumbnailLink: t.thumbnail_link, src: t.drive_file_id, mimeType: t.mime_type
    }))
    const target = playlist.find(p => p.id === track.id)
    if (target) {
      if (track._bookmarkObj) (target as any).initialPosition = track._bookmarkObj.position
      setPlaylist(playlist); setTrack(target)
    }
  }

  const handlePlayAll = () => {
    const list = filteredTracks
    if (list.length === 0) return
    const playlist = list.map(t => ({
      id: t.id, name: t.title || t.file_name, artist: t.artist || 'Unknown',
      thumbnailLink: t.thumbnail_link, src: t.drive_file_id, mimeType: t.mime_type
    }))
    setPlaylist(playlist); setTrack(playlist[0])
  }

  const handleShuffle = () => {
    const list = filteredTracks
    if (list.length === 0) return
    const playlist = list.map(t => ({
      id: t.id, name: t.title || t.file_name, artist: t.artist || 'Unknown',
      thumbnailLink: t.thumbnail_link, src: t.drive_file_id, mimeType: t.mime_type
    }))
    const shuffled = [...playlist].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled); setTrack(shuffled[0])
  }

  const filteredTracks = useMemo(() => {
    let base = tracks
    if (view === 'recents') base = recentTracks as any[]
    else if (view === 'favorites') base = favorites as any[]
    else if (view === 'bookmarks') base = bookmarks.map(b => ({...b.track, _bookmarkObj: b}))
    if (selectedGroup) {
      if (view === 'albums') base = base.filter(t => t.album === selectedGroup)
      if (view === 'artists') base = base.filter(t => t.artist === selectedGroup)
      if (view === 'genres') base = base.filter(t => t.genre === selectedGroup)
    }
    if (!searchQuery) return base
    return base.filter(t =>
      (t.title || t.file_name || t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [tracks, recentTracks, favorites, view, selectedGroup, searchQuery, bookmarks])

  // --- MENU VIEW ---
  if (view === 'menu') {
    return (
      <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="px-8 pt-8 pb-4 relative z-10">
          <h1 className="font-['Work_Sans'] text-2xl font-bold text-[var(--text-main)] tracking-tight">CORE_STORAGE</h1>
          <p className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] tracking-[0.3em] mt-1">{trackCount} INDEXED_TRACKS</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
          {/* Quick Access */}
          <h2 className="font-['Work_Sans'] text-[9px] tracking-[0.3em] text-[var(--tertiary)] uppercase mb-3 mt-4">QUICK_ACCESS</h2>
          <div className="space-y-1 mb-8">
            {quickAccess.map(item => {
              const Icon = item.icon
              return (
                <button key={item.key} onClick={() => handleMenuClick(item.key)}
                  className="w-full flex items-center gap-4 px-4 py-3 transition-all group hover:bg-[color:var(--tertiary)]/5 border border-transparent hover:border-[color:var(--tertiary)]/10">
                  <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'var(--bg-container-high)', border: '1px solid var(--bg-container-high)' }}>
                    <Icon size={16} className="text-[var(--tertiary)]" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-['Work_Sans'] text-sm text-[var(--text-main)] tracking-tight font-medium">{item.label}</span>
                    <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">{item.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--tertiary)] transition-colors" />
                </button>
              )
            })}
          </div>

          {/* Categories */}
          <h2 className="font-['Work_Sans'] text-[9px] tracking-[0.3em] text-[var(--tertiary)] uppercase mb-3">CATEGORIES</h2>
          <div className="space-y-1">
            {categories.map(item => {
              const Icon = item.icon
              return (
                <button key={item.key} onClick={() => handleMenuClick(item.key)}
                  className="w-full flex items-center gap-4 px-4 py-3 transition-all group hover:bg-[color:var(--tertiary)]/5 border border-transparent hover:border-[color:var(--tertiary)]/10">
                  <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'var(--bg-container-high)', border: '1px solid var(--bg-container-high)' }}>
                    <Icon size={16} className="text-[var(--tertiary)]" />
                  </div>
                  <span className="font-['Work_Sans'] text-sm text-[var(--text-main)] tracking-tight font-medium flex-1 text-left">{item.label}</span>
                  <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--tertiary)] transition-colors" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // --- TRACKS LIST VIEW ---
  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-6 pb-4 relative z-10">
        <button onClick={() => { if (selectedGroup) setSelectedGroup(null); else setView('menu') }}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--tertiary)] transition border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight uppercase">
          {selectedGroup || view.toUpperCase().replace('S', '_LIST')}
        </h1>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-48 py-1.5 pl-8 pr-3 font-['Work_Sans'] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none border border-[color:var(--border-strong)]/30 focus:border-[color:var(--tertiary)]/50 transition-colors"
            style={{ background: 'var(--bg-container-highest)' }} />
        </div>
      </div>

      {/* Grid View for Albums/Artists/Genres */}
      {(view === 'albums' || view === 'artists' || view === 'genres') && !selectedGroup ? (
        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
              <Loader2 className="animate-spin mr-2" size={16} />
              <span className="font-['Work_Sans'] text-xs tracking-widest">LOADING...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-2">
              {groupedItems.map((item, idx) => (
                <div key={idx} onClick={() => { setSelectedGroup(item.name); if (tracks.length === 0) loadAllTracks() }}
                  className="group p-4 cursor-pointer transition-all hover:bg-[color:var(--tertiary)]/5 border border-transparent hover:border-[color:var(--tertiary)]/10">
                  <div className={`aspect-square w-full bg-[var(--bg-container)] border border-white/5 flex items-center justify-center mb-3 ${view === 'artists' ? 'rounded-full' : ''} overflow-hidden`}>
                    {item.cover ? <img src={item.cover} className="w-full h-full object-cover" /> : (
                      view === 'artists' ? <Users size={32} className="text-[var(--text-muted)]" /> :
                      view === 'genres' ? <Hash size={32} className="text-[var(--text-muted)]" /> :
                      <Disc3 size={32} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--text-main)] truncate font-medium">{item.name}</h3>
                  <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mt-0.5">{item.count} tracks</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
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
            <span className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] tracking-widest ml-2">{filteredTracks.length} TRACKS</span>
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
                <Loader2 className="animate-spin mr-2" size={16} />
                <span className="font-['Work_Sans'] text-xs tracking-widest">INDEXING...</span>
              </div>
            ) : (
              <div className="flex flex-col mt-1">
                {filteredTracks.map((track, index) => {
                  const isActive = currentTrack?.id === track.id
                  const fmt = getFormatFromMime(track.mime_type ?? undefined, (track.title || track.file_name) ?? undefined)
                  return (
                    <div key={track.id || index} onClick={() => handlePlayTrack(track)}
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
                          {track.title || track.file_name?.replace(/\.[^.]+$/, '') || track.name}
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
        </>
      )}
    </div>
  )
}
