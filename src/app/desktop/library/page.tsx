'use client'

import { useEffect, useState, useMemo } from 'react'
import { getLibraryTracks, getLibraryCount } from '@/app/actions/library'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import {
  Search, Music, Play, Shuffle, Heart, Clock, Bookmark, Disc3,
  Star, Users, Mic2, Hash, PenTool, ChevronRight, ArrowLeft, Loader2
} from 'lucide-react'

function getFormatFromMime(mimeType?: string) {
  if (!mimeType) return 'AUDIO'
  const map: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
    'audio/wav': 'WAV', 'audio/mp4': 'M4A', 'audio/aac': 'AAC', 'audio/ogg': 'OGG',
  }
  return map[mimeType] || 'AUDIO'
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
      <div className="h-full flex flex-col relative" style={{ background: '#0a0e14' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, rgba(153,247,255,0.15) 0%, transparent 100%)' }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#99f7ff 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="px-8 pt-8 pb-4 relative z-10">
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-[#f1f3fc] tracking-tight">CORE_STORAGE</h1>
          <p className="font-['Space_Grotesk'] text-[10px] text-[#44484f] tracking-[0.3em] mt-1">{trackCount} INDEXED_TRACKS</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(153,247,255,0.15) transparent' }}>
          {/* Quick Access */}
          <h2 className="font-['Space_Grotesk'] text-[9px] tracking-[0.3em] text-[#99f7ff] uppercase mb-3 mt-4">QUICK_ACCESS</h2>
          <div className="space-y-1 mb-8">
            {quickAccess.map(item => {
              const Icon = item.icon
              return (
                <button key={item.key} onClick={() => handleMenuClick(item.key)}
                  className="w-full flex items-center gap-4 px-4 py-3 transition-all group hover:bg-[#99f7ff]/5 border border-transparent hover:border-[#99f7ff]/10">
                  <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'rgba(153,247,255,0.06)', border: '1px solid rgba(153,247,255,0.1)' }}>
                    <Icon size={16} className="text-[#99f7ff]" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-['Space_Grotesk'] text-sm text-[#f1f3fc] tracking-tight font-medium">{item.label}</span>
                    <p className="font-['Inter'] text-[10px] text-[#44484f]">{item.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#44484f] group-hover:text-[#99f7ff] transition-colors" />
                </button>
              )
            })}
          </div>

          {/* Categories */}
          <h2 className="font-['Space_Grotesk'] text-[9px] tracking-[0.3em] text-[#99f7ff] uppercase mb-3">CATEGORIES</h2>
          <div className="space-y-1">
            {categories.map(item => {
              const Icon = item.icon
              return (
                <button key={item.key} onClick={() => handleMenuClick(item.key)}
                  className="w-full flex items-center gap-4 px-4 py-3 transition-all group hover:bg-[#99f7ff]/5 border border-transparent hover:border-[#99f7ff]/10">
                  <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'rgba(153,247,255,0.06)', border: '1px solid rgba(153,247,255,0.1)' }}>
                    <Icon size={16} className="text-[#99f7ff]" />
                  </div>
                  <span className="font-['Space_Grotesk'] text-sm text-[#f1f3fc] tracking-tight font-medium flex-1 text-left">{item.label}</span>
                  <ChevronRight size={14} className="text-[#44484f] group-hover:text-[#99f7ff] transition-colors" />
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
    <div className="h-full flex flex-col relative" style={{ background: '#0a0e14' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, rgba(153,247,255,0.1) 0%, transparent 100%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#99f7ff 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-6 pb-4 relative z-10">
        <button onClick={() => { if (selectedGroup) setSelectedGroup(null); else setView('menu') }}
          className="w-8 h-8 flex items-center justify-center text-[#72757d] hover:text-[#99f7ff] transition border border-[#44484f]/50 hover:border-[#99f7ff]/30">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#f1f3fc] tracking-tight uppercase">
          {selectedGroup || view.toUpperCase().replace('S', '_LIST')}
        </h1>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44484f]" />
          <input type="text" placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-48 py-1.5 pl-8 pr-3 font-['Inter'] text-xs text-[#f1f3fc] placeholder:text-[#44484f] outline-none"
            style={{ background: 'rgba(153,247,255,0.04)', border: '1px solid rgba(153,247,255,0.1)' }} />
        </div>
      </div>

      {/* Grid View for Albums/Artists/Genres */}
      {(view === 'albums' || view === 'artists' || view === 'genres') && !selectedGroup ? (
        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(153,247,255,0.15) transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#72757d]">
              <Loader2 className="animate-spin mr-2" size={16} />
              <span className="font-['Space_Grotesk'] text-xs tracking-widest">LOADING...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-2">
              {groupedItems.map((item, idx) => (
                <div key={idx} onClick={() => { setSelectedGroup(item.name); if (tracks.length === 0) loadAllTracks() }}
                  className="group p-4 cursor-pointer transition-all hover:bg-[#99f7ff]/5 border border-transparent hover:border-[#99f7ff]/10">
                  <div className={`aspect-square w-full bg-[#1b2028] border border-white/5 flex items-center justify-center mb-3 ${view === 'artists' ? 'rounded-full' : ''} overflow-hidden`}>
                    {item.cover ? <img src={item.cover} className="w-full h-full object-cover" /> : (
                      view === 'artists' ? <Users size={32} className="text-[#44484f]" /> :
                      view === 'genres' ? <Hash size={32} className="text-[#44484f]" /> :
                      <Disc3 size={32} className="text-[#44484f]" />
                    )}
                  </div>
                  <h3 className="font-['Space_Grotesk'] text-sm text-[#f1f3fc] truncate font-medium">{item.name}</h3>
                  <p className="font-['Inter'] text-[10px] text-[#72757d] mt-0.5">{item.count} tracks</p>
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
              className="flex items-center gap-2 px-4 py-1.5 font-['Space_Grotesk'] text-xs tracking-wider text-[#004145] font-bold"
              style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)' }}>
              <Play size={12} fill="currentColor" /> PLAY_ALL
            </button>
            <button onClick={handleShuffle}
              className="flex items-center gap-2 px-4 py-1.5 text-[#72757d] font-['Space_Grotesk'] text-xs tracking-wider hover:text-[#99f7ff] transition border border-[#44484f]/50 hover:border-[#99f7ff]/30">
              <Shuffle size={12} /> SHUFFLE
            </button>
            <span className="font-['Space_Grotesk'] text-[10px] text-[#44484f] tracking-widest ml-2">{filteredTracks.length} TRACKS</span>
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
                <Loader2 className="animate-spin mr-2" size={16} />
                <span className="font-['Space_Grotesk'] text-xs tracking-widest">INDEXING...</span>
              </div>
            ) : (
              <div className="flex flex-col mt-1">
                {filteredTracks.map((track, index) => {
                  const isActive = currentTrack?.id === track.id
                  const fmt = getFormatFromMime(track.mime_type)
                  return (
                    <div key={track.id || index} onClick={() => handlePlayTrack(track)}
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
                          {track.title || track.file_name?.replace(/\.[^.]+$/, '') || track.name}
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
        </>
      )}
    </div>
  )
}
