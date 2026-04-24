'use client'

import { useState } from 'react'
import { searchLibraryWithAI, searchDriveWithAI } from '@/app/actions/ai'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { Search, Sparkles, Play, Music, Disc3, Clock } from 'lucide-react'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

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

export default function DesktopSearch() {
  const [query, setQuery] = useState('')
  const [targetFolder, setTargetFolder] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { setTrack, setPlaylist, currentTrack, isPlaying } = usePlayerStore()
  const { aiProvider, aiApiKeys } = useSettingsStore()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    setError(null)
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
    } catch (err: any) { 
      console.error(err)
      setError(err.message || '검색 중 오류가 발생했습니다.')
    }
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
    <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-15"
          style={{ background: 'radial-gradient(ellipse, var(--bg-container-high) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* Header & Search */}
      <div className="pt-16 pb-6 px-8 flex flex-col items-center relative z-10 max-w-3xl mx-auto w-full">
        <h1 className="font-['Noto_Serif'] text-3xl font-bold text-[var(--text-main)] mb-2 tracking-tight flex items-center gap-3">
          <Sparkles size={28} className="text-[var(--tertiary)]" />
          Semantic Search
        </h1>
        <p className="font-['Work_Sans'] text-xs text-[var(--text-muted)] tracking-widest uppercase mb-8 font-bold">Discover your music naturally</p>

        <form onSubmit={handleSearch} className="w-full relative group flex flex-col gap-3">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-[var(--tertiary)] transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="신나는 아이돌 노래 틀어줘, 비오는 날 듣기 좋은 팝송..."
              className="w-full py-4 pl-14 pr-32 font-['Work_Sans'] text-base text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none transition-all rounded-md bg-[var(--bg-container)] border border-[var(--border-strong)] focus:border-[var(--tertiary)] shadow-sm"
            />
            <button
              type="submit" disabled={loading || !query.trim()}
              className="absolute right-2 top-2 bottom-2 px-6 font-['Work_Sans'] text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-50 bg-[var(--primary)] text-[var(--on-primary)] rounded-sm shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[var(--on-primary)] border-t-transparent animate-spin rounded-full" />
                  Scanning
                </span>
              ) : 'Search'}
            </button>
          </div>
          
          <div className="flex justify-end pr-2">
             <div className="flex items-center gap-2 text-[11px] font-['Work_Sans'] font-bold text-[var(--text-muted)]">
               <span>TARGET FOLDER ID:</span>
               <input type="text" value={targetFolder} onChange={e => setTargetFolder(e.target.value)} placeholder="root (Default)" className="bg-[var(--bg-container)] px-2 py-1 border border-[var(--border-strong)] rounded-sm text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none w-48 focus:border-[var(--tertiary)] transition-colors shadow-inner" />
             </div>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-8 pb-8 relative z-10 analog-scrollbar">
        {!searched ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search size={48} className="text-[var(--text-muted)] opacity-30 mb-4" />
            <p className="font-['Work_Sans'] text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase">Waiting for query...</p>
            <p className="font-['Work_Sans'] font-medium text-xs text-[var(--text-muted)] mt-2">원하는 분위기나 가수를 말해주세요</p>
          </div>
        ) : loading ? (
          <div className="space-y-2 py-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse bg-[var(--bg-container)] border border-[var(--border-strong)] rounded-md">
                <div className="w-10 h-10 bg-[var(--bg-container-highest)] rounded-sm" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[var(--bg-container-highest)] w-1/3 rounded-sm" />
                  <div className="h-2 bg-[var(--bg-container-highest)] w-1/4 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 flex items-center justify-center border border-red-500/20 mb-4 rounded-full bg-red-500/5">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="font-['Work_Sans'] text-sm font-bold text-red-500 tracking-widest uppercase mb-2">Search Error</p>
            <p className="font-['Work_Sans'] font-medium text-xs text-[var(--text-muted)] max-w-sm">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search size={48} className="text-[var(--text-muted)] opacity-50 mb-4" />
            <p className="font-['Work_Sans'] text-sm font-bold text-[var(--text-muted)] tracking-widest uppercase">No Results Found</p>
          </div>
        ) : (
          <div className="mt-2 bg-[var(--bg-surface)] p-6 rounded-lg border border-[var(--border-light)] shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-['Work_Sans'] text-xs font-bold tracking-[0.15em] text-[var(--text-main)] uppercase">Search Results <span className="text-[var(--text-muted)]">({results.length})</span></h2>
              <button onClick={() => handlePlayTrack(results[0])}
                className="flex items-center gap-2 px-5 py-2 font-['Work_Sans'] text-xs tracking-wider text-[var(--on-primary)] bg-[var(--primary)] rounded-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] font-bold uppercase transition-transform">
                <Play size={14} fill="currentColor" /> Play All
              </button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 px-3 py-2 mb-2 border-b border-[var(--border-strong)]">
              <span className="font-['Work_Sans'] font-bold text-[10px] text-[var(--text-muted)] tracking-widest uppercase">#</span>
              <span className="font-['Work_Sans'] font-bold text-[10px] text-[var(--text-muted)] tracking-widest uppercase">Title</span>
              <span className="font-['Work_Sans'] font-bold text-[10px] text-[var(--text-muted)] tracking-widest uppercase">Artist</span>
              <span className="font-['Work_Sans'] font-bold text-[10px] text-[var(--text-muted)] tracking-widest uppercase">Format</span>
              <span className="font-['Work_Sans'] font-bold text-[10px] text-[var(--text-muted)] tracking-widest uppercase text-right"><Clock size={12} /></span>
            </div>

            {/* List */}
            <div className="space-y-1">
              {results.map((track, index) => {
                const isActive = currentTrack?.id === track.id
                const fmt = getFormatFromMime(track.mime_type ?? undefined, (track.title || track.file_name) ?? undefined)
                return (
                  <div key={track.id} onClick={() => handlePlayTrack(track)}
                    className={`group grid grid-cols-[30px_1fr_150px_60px_60px] gap-3 items-center px-3 py-2.5 cursor-pointer transition-all rounded-md border ${
                      isActive ? 'bg-[var(--bg-container-high)] border-[var(--border-strong)] shadow-[var(--shadow-pressed)]' : 'border-transparent hover:bg-[var(--bg-container)] hover:border-[var(--border-light)]'
                    }`}>
                    <span className="font-['Work_Sans'] font-bold text-[11px] text-[var(--text-muted)] text-center">
                      {isActive && isPlaying ? <Disc3 size={14} className="animate-spin text-[var(--tertiary)] mx-auto" /> : index + 1}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-[var(--bg-container)] border border-[var(--border-strong)] rounded-sm flex items-center justify-center shrink-0 overflow-hidden shadow-[var(--shadow-ambient)] relative">
                        {track.thumbnail_link
                          ? <img src={track.thumbnail_link} className="w-full h-full object-cover" alt="" />
                          : <Music size={14} className="text-[var(--text-muted)] absolute opacity-50" />}
                      </div>
                      <span className={`font-['Noto_Serif'] text-[15px] truncate tracking-tight ${isActive ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-main)]'}`}>
                        {track.title || track.file_name?.replace(/\.[^.]+$/, '')}
                      </span>
                    </div>
                    <span className="font-['Work_Sans'] text-[11px] text-[var(--text-muted)] font-medium truncate">{track.artist || 'Unknown'}</span>
                    <span className="text-[9px] font-['Work_Sans'] font-bold text-[var(--text-muted)] tracking-wider uppercase px-2 py-0.5 bg-[var(--bg-container-high)] rounded-sm border border-[var(--border-light)] text-center w-fit">{fmt}</span>
                    <span className="font-['Work_Sans'] font-bold text-[11px] text-[var(--text-muted)] text-right">
                      {track.duration ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '--:--'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
