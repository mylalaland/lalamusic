'use client'

import { useState } from 'react'
import { searchLibraryWithAI, searchDriveWithAI } from '@/app/actions/ai'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { Search, Sparkles, Play, Music, Disc3, Clock } from 'lucide-react'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

function getFormatFromMime(mimeType?: string) {
  if (!mimeType) return 'AUDIO'
  const map: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
    'audio/wav': 'WAV', 'audio/mp4': 'M4A', 'audio/aac': 'AAC', 'audio/ogg': 'OGG',
  }
  return map[mimeType] || mimeType.replace('audio/', '').toUpperCase()
}

export default function DesktopSearch() {
  const [query, setQuery] = useState('')
  const [targetFolder, setTargetFolder] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  
  const { setTrack, setPlaylist, currentTrack, isPlaying } = usePlayerStore()
  const { aiProvider, aiApiKeys } = useSettingsStore()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      let data
      if (targetFolder.trim()) {
        data = await searchDriveWithAI(targetFolder.trim(), query, aiApiKeys[aiProvider], aiProvider)
      } else {
        data = await searchLibraryWithAI(query, aiApiKeys[aiProvider], aiProvider)
      }
      
      setResults(data)
      if (data && data.length > 0) {
        const playlist = data.map((t: any) => ({
          id: t.id, name: t.title || t.file_name, artist: t.artist || 'Unknown',
          thumbnailLink: t.thumbnail_link, src: t.drive_file_id, mimeType: t.mime_type
        }))
        setPlaylist(playlist)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handlePlayTrack = (track: any) => {
    const playlist = results.map(t => ({
      id: t.id, name: t.title || t.file_name, artist: t.artist || 'Unknown',
      thumbnailLink: t.thumbnail_link, src: t.drive_file_id, mimeType: t.mime_type
    }))
    const target = playlist.find(p => p.id === track.id)
    if (target) { setTrack(target) }
  }

  return (
    <div className="h-full flex flex-col relative" style={{ background: '#0a0e14' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(153,247,255,0.2) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#99f7ff 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Header & Search */}
      <div className="pt-16 pb-6 px-8 flex flex-col items-center relative z-10 max-w-3xl mx-auto w-full">
        <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-[#f1f3fc] mb-2 tracking-tight flex items-center gap-3">
          <Sparkles size={28} className="text-[#99f7ff]" />
          AI_SEARCH
        </h1>
        <p className="font-['Space_Grotesk'] text-xs text-[#72757d] tracking-[0.3em] uppercase mb-8">QUARK_FINDER — SEMANTIC_QUERY</p>

        <form onSubmit={handleSearch} className="w-full relative group flex flex-col gap-3">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[#72757d] group-focus-within:text-[#99f7ff] transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="신나는 아이돌 노래 틀어줘, 비오는 날 듣기 좋은 팝송..."
              className="w-full py-4 pl-14 pr-28 font-['Inter'] text-base text-[#f1f3fc] placeholder:text-[#44484f] outline-none transition-all"
              style={{ background: 'rgba(153,247,255,0.04)', border: '1px solid rgba(153,247,255,0.1)', backdropFilter: 'blur(10px)' }}
            />
            <button
              type="submit" disabled={loading || !query.trim()}
              className="absolute right-2 top-2 bottom-2 px-5 font-['Space_Grotesk'] text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-30"
              style={{ background: loading ? 'transparent' : 'linear-gradient(135deg, #99f7ff, #00f1fe)', color: loading ? '#99f7ff' : '#004145', border: loading ? '1px solid rgba(153,247,255,0.3)' : 'none' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#99f7ff] border-t-transparent animate-spin" />
                  SCANNING...
                </span>
              ) : 'SEARCH'}
            </button>
          </div>
          
          <div className="flex justify-end pr-2">
             <div className="flex items-center gap-2 text-[10px] font-['Space_Grotesk'] text-[#72757d]">
               <span>TARGET FOLDER ID:</span>
               <input type="text" value={targetFolder} onChange={e => setTargetFolder(e.target.value)} placeholder="root (Default)" className="bg-transparent border-b border-[#44484f] text-[#99f7ff] placeholder-[#44484f] outline-none w-48 focus:border-[#00f1fe] transition-colors" />
             </div>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(153,247,255,0.15) transparent' }}>
        {!searched ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search size={48} className="text-[#99f7ff]/15 mb-4" />
            <p className="font-['Space_Grotesk'] text-sm text-[#44484f] tracking-widest uppercase">AWAITING_QUERY...</p>
            <p className="font-['Inter'] text-xs text-[#44484f]/60 mt-2">원하는 분위기나 가수를 말해주세요</p>
          </div>
        ) : loading ? (
          <div className="space-y-2 py-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse" style={{ background: 'rgba(153,247,255,0.02)', border: '1px solid rgba(153,247,255,0.04)' }}>
                <div className="w-10 h-10 bg-[#1b2028]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[#1b2028] w-1/3" />
                  <div className="h-2 bg-[#1b2028] w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search size={48} className="text-[#44484f] mb-4" />
            <p className="font-['Space_Grotesk'] text-sm text-[#44484f] tracking-widest uppercase">NO_RESULTS_FOUND</p>
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Space_Grotesk'] text-xs tracking-[0.3em] text-[#99f7ff] uppercase">AI_RESULTS ({results.length})</h2>
              <button onClick={() => handlePlayTrack(results[0])}
                className="flex items-center gap-2 px-4 py-1.5 font-['Space_Grotesk'] text-xs tracking-wider text-[#004145] font-bold"
                style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)' }}>
                <Play size={12} fill="currentColor" /> PLAY_ALL
              </button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 px-3 py-2 mb-1" style={{ borderBottom: '1px solid rgba(153,247,255,0.06)' }}>
              <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">#</span>
              <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">제목</span>
              <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">아티스트</span>
              <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest">포맷</span>
              <span className="font-['Space_Grotesk'] text-[9px] text-[#44484f] tracking-widest text-right"><Clock size={10} /></span>
            </div>

            {results.map((track, index) => {
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
