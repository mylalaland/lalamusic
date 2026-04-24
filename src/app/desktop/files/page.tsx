'use client'

import { useEffect, useState } from 'react'
import { getOfflineFiles, deleteOfflineFile } from '@/lib/db/offline'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import {
  Music, Play, FolderClosed, Download, RefreshCw, Heart, Clock,
  ChevronRight, ArrowLeft, Disc3, Trash2
} from 'lucide-react'

export default function DesktopFiles() {
  const [view, setView] = useState<'menu' | 'downloads' | 'favorites' | 'recents' | 'offlineFolders'>('menu')
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { setTrack, setPlaylist, currentTrack, isPlaying, favorites, recentTracks } = usePlayerStore()

  const loadFiles = async () => {
    setLoading(true)
    try {
      const data = await getOfflineFiles()
      setFiles(data.sort((a: any, b: any) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handlePlay = (file: any) => {
    const objectUrl = file.blob ? URL.createObjectURL(file.blob) : null
    const track = {
      id: file.id, name: file.name, artist: file.artist,
      thumbnailLink: file.thumbnailLink, cover_art: file.cover_art,
      lyrics: file.lyrics, src: objectUrl, mimeType: file.mimeType
    }
    const playlist = files.filter(f => f.blob).map(f => ({
      id: f.id, name: f.name, artist: f.artist,
      thumbnailLink: f.thumbnailLink, src: URL.createObjectURL(f.blob), mimeType: f.mimeType
    }))
    setPlaylist(playlist); setTrack(track)
  }

  const handleDelete = async (id: string) => {
    if (confirm('오프라인 파일을 삭제하겠습니까?')) {
      await deleteOfflineFile(id)
      setFiles(prev => prev.filter(f => f.id !== id))
    }
  }

  const offlineSections = [
    { key: 'downloads', label: 'DOWNLOADS', icon: Download, desc: 'Downloaded files' },
    { key: 'offlineFolders', label: 'OFFLINE_FOLDERS', icon: FolderClosed, desc: 'Cached folders' },
  ]

  // --- MENU VIEW ---
  if (view === 'menu') {
    return (
      <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.4px, transparent 0.4px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="px-8 pt-8 pb-4 relative z-10">
          <h1 className="font-['Work_Sans'] text-2xl font-bold text-[var(--text-main)] tracking-tight">LOCAL_FILES</h1>
          <p className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] tracking-[0.3em] mt-1">OFFLINE_STORAGE</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
          <h2 className="font-['Work_Sans'] text-[9px] tracking-[0.3em] text-[var(--tertiary)] uppercase mb-3">OFFLINE_FILES</h2>
          <div className="space-y-1">
            {offlineSections.map(item => {
              const Icon = item.icon
              return (
                <button key={item.key} onClick={() => { setView(item.key as any); loadFiles() }}
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

          <p className="font-['Noto_Serif'] text-xs text-[var(--text-muted)] mt-6 px-4 leading-relaxed">
            Connect 메뉴에서 다운로드한 곡과 오프라인 저장된 폴더를 관리합니다.
          </p>
        </div>
      </div>
    )
  }

  // --- LIST VIEWS ---
  let displayFiles = files.filter(f => f.name && f.name !== 'Unknown'); // 필터: 이름이 있는 정상적인 캐시 데이터만

  if (view === 'downloads') displayFiles = displayFiles.filter(f => f.blob) // 다운로드는 실제 Blob이 있는 것만
  else if (view === 'offlineFolders') displayFiles = displayFiles.filter(f => f.blob)

  const viewTitleMap: Record<string, string> = { downloads: 'DOWNLOADS', offlineFolders: 'OFFLINE_FOLDERS' }

  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
      </div>

      <div className="flex items-center gap-4 px-8 pt-6 pb-4 relative z-10">
        <button onClick={() => setView('menu')}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--tertiary)] transition border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight">{viewTitleMap[view]}</h1>
        <div className="flex-1" />
        <button onClick={loadFiles}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--tertiary)] transition border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
            <div className="w-4 h-4 border-2 border-[var(--tertiary)] border-t-transparent animate-spin mr-2" />
            <span className="font-['Work_Sans'] text-xs tracking-widest">SCANNING...</span>
          </div>
        ) : displayFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Download size={48} className="text-[var(--text-muted)] mb-4" />
            <p className="font-['Work_Sans'] text-xs text-[var(--text-muted)] tracking-widest uppercase">EMPTY_LIST</p>
            <p className="font-['Noto_Serif'] text-[10px] text-[color:var(--text-muted)]/60 mt-1">이 항목에 표시할 오프라인 파일이 없습니다.</p>
          </div>
        ) : view === 'offlineFolders' ? (
          <div className="flex flex-col mt-1">
             {(Object.entries(displayFiles.reduce((acc, f) => {
                const artist = f.artist || 'Unknown'
                if (!acc[artist]) acc[artist] = []
                acc[artist].push(f)
                return acc
             }, {} as Record<string, any[]>)) as [string, any[]][]).map(([artist, artistFiles], idx) => (
                <div key={idx} className="mb-4">
                  <h3 className="font-['Work_Sans'] text-xs font-bold text-[var(--text-main)] tracking-tight mb-2 border-b border-[color:var(--border-strong)]/30 pb-1">{artist}</h3>
                  {artistFiles.map((file, i) => {
                    const isActive = currentTrack?.id === file.id
                    return (
                        <div key={file.id} onClick={() => handlePlay(file)}
                          className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-l-2 ${
                            isActive ? 'bg-[color:var(--tertiary)]/5 border-[var(--tertiary)]' : 'border-transparent hover:bg-[var(--bg-container-high)] hover:border-[color:var(--tertiary)]/20'
                          }`}>
                          <div className="w-9 h-9 bg-[var(--bg-container)] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                            {isActive && isPlaying
                              ? <Disc3 size={14} className="animate-spin text-[var(--tertiary)]" />
                              : file.cover_art
                                ? <img src={file.cover_art} className="w-full h-full object-cover" alt="" />
                                : <Music size={14} className="text-[var(--text-muted)]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`font-['Work_Sans'] text-sm truncate block tracking-tight ${isActive ? 'text-[var(--tertiary)] font-bold' : 'text-[var(--text-main)]'}`}>
                              {file.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={(e) => { e.stopPropagation(); handlePlay(file) }} className="text-[var(--text-muted)] hover:text-[var(--tertiary)]">
                              <Play size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(file.id) }} className="text-[var(--text-muted)] hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                    )
                  })}
                </div>
             ))}
          </div>
        ) : (
          <div className="flex flex-col mt-1">
            {displayFiles.map((file, index) => {
              const isActive = currentTrack?.id === file.id
              return (
                <div key={file.id} onClick={() => handlePlay(file)}
                  className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-l-2 ${
                    isActive ? 'bg-[color:var(--tertiary)]/5 border-[var(--tertiary)]' : 'border-transparent hover:bg-[var(--bg-container-high)] hover:border-[color:var(--tertiary)]/20'
                  }`}>
                  <div className="w-9 h-9 bg-[var(--bg-container)] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {isActive && isPlaying
                      ? <Disc3 size={14} className="animate-spin text-[var(--tertiary)]" />
                      : file.cover_art
                        ? <img src={file.cover_art} className="w-full h-full object-cover" alt="" />
                        : <Music size={14} className="text-[var(--text-muted)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`font-['Work_Sans'] text-sm truncate block tracking-tight ${isActive ? 'text-[var(--tertiary)] font-bold' : 'text-[var(--text-main)]'}`}>
                      {file.name}
                    </span>
                    <span className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] truncate block">{file.artist || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); handlePlay(file) }} className="text-[var(--text-muted)] hover:text-[var(--tertiary)]">
                      <Play size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(file.id) }} className="text-[var(--text-muted)] hover:text-red-500">
                      <Trash2 size={14} />
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
