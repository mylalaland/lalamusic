'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getScanSettings } from '@/app/actions/settings'
import { getDriveContents } from '@/app/actions/library'
import { getPlaylists, addTrackToPlaylist } from '@/app/actions/playlist'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { usePlayerStore, MusicFile } from '@/lib/store/usePlayerStore'
import { useConnectStore } from '@/lib/store/useConnectStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { 
  Folder, Music, Play, Pause, Search, ChevronRight, Loader2, 
  Download, Heart, Clock, Disc3, Shuffle, ListPlus, PlayCircle, XCircle, ListMusic, Sparkles
} from 'lucide-react'

/* ────── 유틸리티 ────── */
function getFormatFromMime(mimeType?: string, fileName?: string): string {
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'M4A';
    if (lower.endsWith('.flac')) return 'FLAC';
    if (lower.endsWith('.mp3')) return 'MP3';
    if (lower.endsWith('.wav')) return 'WAV';
    if (lower.endsWith('.aac')) return 'AAC';
  }
  if (!mimeType) return ''
  const map: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
    'audio/wav': 'WAV', 'audio/x-wav': 'WAV',
    'audio/mp4': 'M4A', 'audio/x-m4a': 'M4A', 'audio/m4a': 'M4A',
    'audio/aac': 'AAC', 'audio/ogg': 'OGG', 'audio/opus': 'OPUS',
    'audio/aiff': 'AIFF', 'audio/x-aiff': 'AIFF',
    'audio/webm': 'WEBM', 'audio/wma': 'WMA', 'audio/x-ms-wma': 'WMA',
  }
  return map[mimeType] || mimeType.replace('audio/', '').toUpperCase()
}

function formatFileSize(size?: string | number): string {
  if (!size) return ''
  const bytes = typeof size === 'string' ? parseInt(size) : size
  if (isNaN(bytes)) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function getExtFromName(name: string): string {
  const match = name.match(/\.(\w+)$/)
  return match ? match[1].toUpperCase() : ''
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function extractDateValue(name: string): number {
  // 예: (24.12.12) 또는 (24.10) 매칭. 
  const match = name.match(/\((\d{2})\.(\d{2})(?:\.(\d{2}))?[^\)]*\)/)
  if (match) {
    const yr = match[1]
    const mo = match[2]
    const da = match[3] || '01'
    return parseInt(`20${yr}${mo}${da}`, 10)
  }
  return 0
}

/* ────── 썸네일 Lazy Loader 컴포넌트 ────── */
function LazyThumbnail({ fileId, mimeType, thumbnailLink }: { fileId: string, mimeType?: string, thumbnailLink?: string | null }) {
  const [coverArt, setCoverArt] = useState<string | null>(thumbnailLink || null)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || loaded) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLoaded(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    // Drive에서 이미 thumbnailLink를 받았으면 DB도 안 봄
    if (coverArt) return
    let cancelled = false
    const load = async () => {
      try {
        // 1. IndexedDB 오프라인 캐시 확인
        const { getOfflineMetadata } = await import('@/lib/db/offline')
        const meta = await getOfflineMetadata(fileId).catch(() => null)
        if (meta?.cover_art && !cancelled) {
          setCoverArt(meta.cover_art)
          return
        }
        // 2. Supabase music_files 테이블에서 thumbnail check
        const resp = await fetch(`/api/metadata?id=${fileId}`)
        if (resp.ok) {
          const data = await resp.json()
          if (data?.cover_art && !cancelled) setCoverArt(data.cover_art)
          else if (data?.thumbnail_link && !cancelled) setCoverArt(data.thumbnail_link)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [loaded, fileId, coverArt])

  // Google Drive thumbnailLink는 CORS 문제가 있으므로 프록시 처리
  const getProxiedUrl = (url: string | null): string | null => {
    if (!url) return null
    // lh3.googleusercontent.com 등 Google 도메인의 경우 프록시 경유
    if (url.includes('googleusercontent.com') || url.includes('google.com')) {
      return `/api/thumbnail?url=${encodeURIComponent(url)}`
    }
    return url
  }

  const displayUrl = getProxiedUrl(coverArt)

  return (
    <div ref={ref} className="w-9 h-9 shrink-0 flex items-center justify-center overflow-hidden relative bg-[var(--bg-surface)] border border-[color:var(--tertiary)]/10">
      <Music size={12} className="text-[var(--text-muted)] absolute" />
      {displayUrl && (
        <img src={displayUrl} referrerPolicy="no-referrer"
          className="w-full h-full object-cover relative z-10"
          onError={(e: any) => { e.currentTarget.style.display = 'none'; setCoverArt(null) }} />
      )}
    </div>
  )
}

/* ────── 트랙 시간 Lazy Loader 컴포넌트 ────── */
function LazyDuration({ fileId, durationMs }: { fileId: string, durationMs?: number | null }) {
  const [dur, setDur] = useState<string>(() => {
    // Drive API에서 videoMediaMetadata.durationMillis가 있으면 즉시 표시
    if (durationMs && durationMs > 0) return formatDuration(durationMs / 1000)
    return '--:--'
  })
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || loaded) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLoaded(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    // Drive에서 이미 duration을 받았으면 스킵
    if (durationMs && durationMs > 0) return
    let cancelled = false
    const load = async () => {
      try {
        // Supabase DB에서 조회 (이미 라이브러리에 동기화된 곡)
        const resp = await fetch(`/api/metadata?id=${fileId}`)
        if (resp.ok) {
          const data = await resp.json()
          if (data?.duration && !cancelled) {
            setDur(formatDuration(data.duration))
          }
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [loaded, fileId, durationMs])

  return (
    <div ref={ref} className="text-center text-[11px] text-[var(--text-muted)] font-['Noto_Serif'] tabular-nums">
      {dur}
    </div>
  )
}

/* ────── 페이지 ────── */
export default function DesktopConnect() {
  const { path, setPath, items, setItems, currentFolderId, setCurrentFolderId } = useConnectStore()
  const { 
    setTrack, setPlaylist, playlist, currentTrack, isPlaying, togglePlay,
    favorites, toggleFavorite 
  } = usePlayerStore()
  
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  
  // Playlist Modal State
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [trackToAdd, setTrackToAdd] = useState<any>(null)
  const [playlists, setPlaylists] = useState<any[]>([])
  
  const [allowedExts, setAllowedExts] = useState<string[]>([])
  const [localSearch, setLocalSearch] = useState('')
  const [serverSearch, setServerSearch] = useState('')
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  const [isAiSearching, setIsAiSearching] = useState(false)
  
  const { aiProvider, aiApiKeys } = useSettingsStore()
  const [serverSort, setServerSort] = useState('name_asc') // name_asc, modified_desc, size_desc
  const [filterBy, setFilterBy] = useState('all') // all, folders, files
  const [visibleCount, setVisibleCount] = useState(50)
  const [isInitialized, setIsInitialized] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const currentFolder = path.length > 0 ? path[path.length - 1] : { id: 'root', name: 'Google Drive' }

  useEffect(() => {
    const init = async () => {
        const settings = await getScanSettings()
        const rootId = settings?.base_folder_id || 'root'
        const rootName = settings?.base_folder_name || 'Google Drive'
        setAllowedExts(settings?.allowed_extensions || [])
        
        if (path.length === 0) {
            setPath([{ id: rootId, name: rootName }])
        }
        setIsInitialized(true)
    }
    init()
  }, [])

  useEffect(() => {
    if (isInitialized && path.length > 0) {
        loadFolder(currentFolder.id)
        setVisibleCount(50) // 페이지 전환 시 리셋
    }
  }, [path, serverSearch, serverSort, filterBy, isInitialized])

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 30)
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [items])

  const [error, setError] = useState<string | null>(null)

  const loadFolder = async (folderId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { folders, files } = await getDriveContents(folderId, allowedExts, serverSearch, serverSort, filterBy)
      setItems([...folders, ...files])
      setCurrentFolderId(folderId)
    } catch (e: any) {
      console.error('loadFolder error:', e)
      setError(e?.message || '폴더를 불러오는 중 오류가 발생했습니다. 다시 로그인해 주세요.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiSearchQuery.trim()) return
    const apiKey = aiApiKeys[aiProvider]
    if (!apiKey) {
      setError('AI 검색을 사용하려면 설정에서 API Key를 먼저 등록해야 합니다.')
      return
    }
    
    setIsAiSearching(true)
    setError(null)
    setLocalSearch('')
    try {
      const { searchDriveWithAI } = await import('@/app/actions/ai')
      const results = await searchDriveWithAI(currentFolder.id, aiSearchQuery, apiKey, aiProvider)
      setItems(results)
    } catch (e: any) {
      console.error('AI Search Error:', e)
      setError(e?.message || 'AI 검색 중 오류가 발생했습니다.')
      setItems([])
    } finally {
      setIsAiSearching(false)
    }
  }

  const handleNavigate = (folder: {id: string, name: string}) => {
    setPath([...path, folder])
  }

  const buildMusicFiles = (): MusicFile[] => {
    return items.filter(i => {
      const isAudioMime = i.mimeType?.includes('audio')
      const isAudioExt = i.name && /\.(mp3|flac|m4a|wav|aac|ogg)$/i.test(i.name)
      const isOctet = i.mimeType === 'application/octet-stream'
      return isAudioMime || isAudioExt || (isOctet && i.name && /\.(mp3|flac|m4a|wav|aac)$/i.test(i.name))
    }).map(f => ({
      id: f.id, name: f.name, artist: 'Google Drive', 
      thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
    }))
  }

  const handlePlayFile = (file: any) => {
    if (currentTrack?.id === file.id) {
      togglePlay()
      return
    }
    const musicFiles = buildMusicFiles()
    const target = musicFiles.find(t => t.id === file.id)
    if (target) {
        setPlaylist(musicFiles)
        setTrack(target)
    }
  }

  const handlePlayAll = async () => {
    let musicFiles = buildMusicFiles()
    
    // 폴더만 있는 환경이라면, 자식 폴더들 내부에 있는 파일들 중 최대 200곡을 랜덤 조회
    if (musicFiles.length === 0) {
      const folderIds = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder').map(f => f.id)
      if (folderIds.length > 0) {
        setLoading(true)
        const subFiles = await import('@/app/actions/library').then(m => m.getRandomAudioFilesFromFolders(folderIds, allowedExts, 200))
        setLoading(false)
        if (subFiles.length > 0) {
          musicFiles = subFiles.map(f => ({
            id: f.id as string, name: (f.name as string) || 'Unknown', artist: 'Google Drive', 
            thumbnailLink: f.thumbnailLink, src: f.id as string, mimeType: (f.mimeType as string) || ''
          }))
        }
      }
    }

    if (musicFiles.length > 0) { setPlaylist(musicFiles); setTrack(musicFiles[0]) }
  }

  const handleShuffleAll = async () => {
    let musicFiles = buildMusicFiles()
    
    if (musicFiles.length === 0) {
      const folderIds = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder').map(f => f.id)
      if (folderIds.length > 0) {
        setLoading(true)
        const subFiles = await import('@/app/actions/library').then(m => m.getRandomAudioFilesFromFolders(folderIds, allowedExts, 200))
        setLoading(false)
        if (subFiles.length > 0) {
          musicFiles = subFiles.map(f => ({
            id: f.id as string, name: (f.name as string) || 'Unknown', artist: 'Google Drive', 
            thumbnailLink: f.thumbnailLink, src: f.id as string, mimeType: (f.mimeType as string) || ''
          }))
        }
      }
    }

    if (musicFiles.length > 0) {
      const shuffled = [...musicFiles].sort(() => Math.random() - 0.5)
      setPlaylist(shuffled)
      setTrack(shuffled[0])
    }
  }

  const handleAddToQueue = (file: any) => {
    const track: MusicFile = {
      id: file.id, name: file.name, artist: 'Google Drive',
      thumbnailLink: file.thumbnailLink, src: file.id, mimeType: file.mimeType
    }
    setPlaylist([...playlist, track])
    // Optional: add a toast here
  }

  const handleOpenPlaylistModal = async (file: any) => {
    setTrackToAdd(file)
    setShowPlaylistModal(true)
    const lists = await getPlaylists()
    setPlaylists(lists)
  }

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!trackToAdd) return
    const originalId = trackToAdd.id
    
    // Ensure file is in DB by analyzing it first
    await analyzeMusicMetadata(originalId)
    await addTrackToPlaylist(playlistId, originalId)
    
    setShowPlaylistModal(false)
    setTrackToAdd(null)
    alert('플레이리스트에 추가되었습니다.')
  }

  const handleDownload = async (file: any) => {
    if (downloadingId) return
    setDownloadingId(file.id)
    try {
      // 1. 브라우저 OS 실제 로컬 PC 다운로드 트리거
      const url = `/api/stream?id=${file.id}&mimeType=${encodeURIComponent(file.mimeType || '')}&download=true&name=${encodeURIComponent(file.name)}`
      window.open(url, '_blank')

      // 2. 앱 자체 내부 오프라인 캐싱 (FILES -> DOWNLOADS 연동)
      const res = await fetch(`/api/stream?id=${file.id}&mimeType=${encodeURIComponent(file.mimeType || '')}`)
      if (!res.ok) throw new Error('Download failed')
      
      const arrayBuffer = await res.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: file.mimeType || 'audio/mpeg' })
      
      const { analyzeMusicMetadata } = await import('@/app/actions/metadata')
      const metaRes = await analyzeMusicMetadata(file.id)
      const metadata = metaRes.success && metaRes.heavyMetadata ? metaRes.heavyMetadata : undefined
      
      const { saveToOffline } = await import('@/lib/db/offline')
      await saveToOffline(file, blob, metadata)
    } catch (e) {
      console.error(e)
      alert('오프라인 저장 중 오류가 발생했습니다.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleSortToggle = (key: string) => {
     if (serverSort === `${key}_asc`) {
         setServerSort(`${key}_desc`)
     } else {
         setServerSort(`${key}_asc`)
     }
  }

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(localSearch.toLowerCase()))
  
  // Local sort logic removed since we use server sorted data, but we preserve local folder/file separation
  const sortedItems = [...filteredItems].sort((a, b) => {
    const isAFolder = a.mimeType === 'application/vnd.google-apps.folder' ? 1 : 0
    const isBFolder = b.mimeType === 'application/vnd.google-apps.folder' ? 1 : 0
    if (isAFolder !== isBFolder) return isBFolder - isAFolder
    return 0 // Keep server sort order
  })

  const musicCount = items.filter(i => i.mimeType?.includes('audio')).length
  const displayItems = sortedItems.slice(0, visibleCount)
  const hasMore = displayItems.length < sortedItems.length

  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--bg-surface)' }}>
       {/* 상단 그라디언트 */}
       <div className="absolute top-0 left-0 right-0 h-72 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--bg-container-high), transparent)' }}/>
       <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--tertiary) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}/>
       
       {/* 내비게이션 바 */}
       <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 relative border-b border-[var(--border-light)] analog-glass">
          <div className="flex items-center gap-1 text-sm min-w-0">
             {path.map((p, idx) => (
                <div key={p.id} className="flex items-center shrink-0">
                   {idx > 0 && <ChevronRight size={14} className="text-[var(--text-muted)] mx-1" />}
                   <button 
                      onClick={() => setPath(path.slice(0, idx + 1))}
                      className={`font-['Work_Sans'] transition-colors truncate max-w-[200px] ${idx === path.length - 1 ? 'text-[var(--text-main)] font-bold text-base' : 'text-[var(--text-muted)] text-xs hover:text-[var(--tertiary)]'}`}
                    >
                        {p.name}
                   </button>
                </div>
             ))}
          </div>
          
          <div className="flex items-center gap-3">
              {/* Type Filter */}
              <select 
                  value={filterBy} onChange={e => setFilterBy(e.target.value)}
                  className="bg-transparent text-[var(--tertiary)] text-xs font-['Work_Sans'] outline-none border border-[color:var(--tertiary)]/20 px-2 py-1.5 focus:border-[color:var(--tertiary)]/50 cursor-pointer"
              >
                  <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-main)]">ALL_TYPES</option>
                  <option value="folders" className="bg-[var(--bg-surface)] text-[var(--text-main)]">FOLDERS_ONLY</option>
                  <option value="files" className="bg-[var(--bg-surface)] text-[var(--text-main)]">AUDIO_ONLY</option>
              </select>

              {/* Sort Order */}
              <select 
                  value={serverSort} onChange={e => setServerSort(e.target.value)}
                  className="bg-transparent text-[var(--tertiary)] text-xs font-['Work_Sans'] outline-none border border-[color:var(--tertiary)]/20 px-2 py-1.5 focus:border-[color:var(--tertiary)]/50 cursor-pointer"
              >
                  <option value="name" className="bg-[var(--bg-surface)] text-[var(--text-main)]">SORT: NAME</option>
                  <option value="modified" className="bg-[var(--bg-surface)] text-[var(--text-main)]">SORT: NEWEST</option>
                  <option value="size" className="bg-[var(--bg-surface)] text-[var(--text-main)]">SORT: SIZE</option>
              </select>

              {/* AI Search Bar */}
              <form onSubmit={handleAiSearch} className="relative group flex items-center ml-2 border border-[color:var(--tertiary)]/30 bg-[color:var(--tertiary)]/5 focus-within:border-[color:var(--tertiary)] transition-colors">
                  <Sparkles size={14} className={`absolute left-3 text-[var(--tertiary)] ${isAiSearching ? 'animate-spin' : ''}`} />
                  <input 
                     type="text" placeholder="AI Global Search (Current Folder)..." 
                     value={aiSearchQuery} 
                     onChange={e => setAiSearchQuery(e.target.value)}
                     disabled={isAiSearching}
                     className="w-64 bg-transparent py-1.5 pl-9 pr-3 text-sm text-[var(--text-main)] outline-none font-['Work_Sans'] placeholder:text-[var(--tertiary)]/50 disabled:opacity-50"
                  />
                  {isAiSearching && <span className="absolute right-2 text-[9px] text-[var(--tertiary)] animate-pulse">SEARCHING...</span>}
              </form>

              {/* Local Search Bar */}
              <div className="relative group ml-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--tertiary)] transition-colors" />
                  <input 
                     type="text" placeholder="Local Filter 🔎" 
                     value={localSearch} 
                     onChange={e => setLocalSearch(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') setServerSearch(localSearch) }}
                     className="w-40 bg-[var(--bg-container-highest)] border border-[color:var(--border-strong)]/30 py-1.5 pl-9 pr-8 text-sm text-[var(--text-main)] outline-none transition-all font-['Work_Sans'] placeholder-[var(--text-muted)] focus:border-[color:var(--tertiary)]/50 focus:bg-[var(--bg-container-high)]"
                  />
                  {serverSearch && (
                      <button onClick={() => { setLocalSearch(''); setServerSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--tertiary)]">
                          <XCircle size={14} />
                      </button>
                  )}
              </div>
          </div>
       </div>

       {/* 폴더 헤더 */}
       <div className="px-6 pb-3 pt-1 relative z-1">
          <h1 className="font-['Work_Sans'] text-2xl font-bold text-[var(--text-main)] tracking-tight mb-3 truncate">
            {currentFolder.name}
          </h1>
          <div className="flex items-center gap-3">
            <button onClick={handlePlayAll}
              className="flex items-center gap-2 px-5 py-2 text-sm font-['Work_Sans'] font-bold tracking-wide text-[var(--on-primary)] transition-all hover:scale-105 active:scale-95 shadow-[var(--shadow-ambient)]"
              style={{ background: 'var(--primary)' }}
            >
              <PlayCircle size={16} /> PLAY_ALL
            </button>
            <button onClick={handleShuffleAll}
              className="flex items-center gap-2 px-5 py-2 text-sm font-['Work_Sans'] font-bold tracking-wide text-[var(--tertiary)] border border-[color:var(--tertiary)]/30 transition-all hover:bg-[color:var(--tertiary)]/5"
            >
              <Shuffle size={16} /> SHUFFLE
            </button>
            <span className="text-xs font-['Work_Sans'] text-[var(--text-muted)] tracking-widest uppercase ml-2">{musicCount} TRACKS</span>
          </div>
       </div>

       {/* 테이블 헤더 */}
       <div className="px-6">
          <div className="grid grid-cols-[32px_minmax(0,1fr)_100px_80px_60px_70px] gap-3 px-3 py-2 border-b border-[color:var(--tertiary)]/8 text-[9px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-['Work_Sans'] font-bold select-none" style={{ background: 'var(--bg-surface)' }}>
              <div className="text-center">#</div>
              <div className="flex items-center gap-1 cursor-pointer hover:text-[var(--tertiary)] transition" onClick={() => handleSortToggle('name')}>
                 TITLE {serverSort === 'name_asc' ? '↑' : serverSort === 'name_desc' ? '↓' : ''}
              </div>
              <div className="text-right">FORMAT</div>
              <div className="text-right cursor-pointer hover:text-[var(--tertiary)] transition" onClick={() => handleSortToggle('size')}>
                 SIZE {serverSort === 'size_asc' ? '↑' : serverSort === 'size_desc' ? '↓' : ''}
              </div>
              <div className="text-right flex items-center justify-end gap-1 cursor-pointer hover:text-[var(--tertiary)] transition" onClick={() => handleSortToggle('modified')}>
                 DATE {serverSort === 'modified_asc' ? '↑' : serverSort === 'modified_desc' ? '↓' : ''}
              </div>
              <div className="text-center">TIME</div>
          </div>
       </div>
       {/* 트랙 리스트 */}
       <div className="flex-1 overflow-y-auto px-6 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3">
               <Loader2 className="animate-spin text-[var(--tertiary)]" size={24}/>
               <span className="text-[11px] font-['Work_Sans'] text-[var(--text-muted)] tracking-[0.3em] uppercase">SCANNING_DRIVE...</span>
             </div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="w-16 h-16 flex items-center justify-center border border-red-500/20" style={{ background: 'rgba(255,89,89,0.05)' }}>
                 <span className="text-2xl">⚠️</span>
               </div>
               <span className="text-sm font-['Work_Sans'] text-red-500 tracking-wide uppercase">CONNECTION_ERROR</span>
               <p className="text-xs font-['Noto_Serif'] text-[var(--text-muted)] max-w-sm text-center leading-relaxed">{error}</p>
               <div className="flex gap-3 mt-2">
                 <button onClick={() => loadFolder(currentFolder.id)}
                   className="flex items-center gap-2 px-5 py-2 text-xs font-['Work_Sans'] tracking-wider text-[var(--tertiary)] border border-[color:var(--tertiary)]/30 hover:bg-[color:var(--tertiary)]/5 transition font-bold">
                   RETRY
                 </button>
                 <button onClick={() => window.location.href = '/'}
                   className="flex items-center gap-2 px-5 py-2 text-xs font-['Work_Sans'] tracking-wider text-[var(--text-muted)] border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30 hover:text-[var(--tertiary)] transition font-bold">
                   RE_LOGIN
                 </button>
               </div>
             </div>
          ) : (
             <div className="flex flex-col">
                 {displayItems.map((item, index) => {
                     const isFolder = item.mimeType === 'application/vnd.google-apps.folder'
                     const isActive = currentTrack?.id === item.id
                     const isCurrentlyPlaying = isActive && isPlaying
                     const fmt = isFolder ? '' : (getFormatFromMime(item.mimeType, item.name) || getExtFromName(item.name))
                     const size = isFolder ? '' : formatFileSize(item.size)
                     const isFav = favorites.some((f: any) => f.id === item.id)
                     
                     return (
                         <div 
                            key={item.id}
                            onClick={() => isFolder ? handleNavigate({id: item.id, name: item.name}) : handlePlayFile(item)}
                            className={`group grid grid-cols-[32px_minmax(0,1fr)_100px_80px_60px_70px] gap-3 items-center px-3 py-2 transition-all cursor-pointer select-none border-l-2 ${
                              isActive 
                                ? 'bg-[color:var(--tertiary)]/5 border-[var(--tertiary)]' 
                                : 'border-transparent hover:bg-white/[0.03] hover:border-[color:var(--tertiary)]/20'
                            }`}
                         >
                            {/* # */}
                            <div className="text-center relative">
                              <span className={`text-[13px] font-['Work_Sans'] group-hover:hidden ${isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)]'}`}>
                                {isCurrentlyPlaying ? <Disc3 size={14} className="animate-spin text-[var(--tertiary)] mx-auto" /> : index + 1}
                              </span>
                              <button onClick={(e) => { e.stopPropagation(); isFolder ? handleNavigate({id: item.id, name: item.name}) : handlePlayFile(item) }}
                                className="hidden group-hover:flex items-center justify-center w-full">
                                {isCurrentlyPlaying 
                                  ? <Pause size={14} fill="currentColor" className="text-[var(--tertiary)]" /> 
                                  : <Play size={14} fill="currentColor" className={isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-main)]'} />}
                              </button>
                            </div>
                            
                            {/* 제목 + 썸네일 */}
                            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                {isFolder ? (
                                  <div className="w-9 h-9 shrink-0 flex items-center justify-center overflow-hidden bg-[color:var(--tertiary)]/5 border border-[color:var(--tertiary)]/10">
                                    <Folder size={16} className="text-[color:var(--tertiary)]/60"/>
                                  </div>
                                ) : (
                                  <LazyThumbnail fileId={item.id} mimeType={item.mimeType} thumbnailLink={item.thumbnailLink} />
                                )}
                                <div className="flex flex-col truncate min-w-0">
                                   <span className={`font-['Work_Sans'] font-semibold truncate text-[13px] tracking-tight ${isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-main)]'}`}>
                                     {item.name.replace(/\.[^.]+$/, '')}
                                   </span>
                                   {!isFolder && (
                                     <span className="text-[10px] text-[var(--text-muted)] font-['Noto_Serif'] truncate">
                                       Google Drive
                                     </span>
                                   )}
                                </div>
                            </div>
                            
                            {/* 포맷 */}
                            <div className="text-center">
                                {isFolder ? (
                                  <span className="text-[10px] text-[var(--text-muted)] font-['Noto_Serif']">폴더</span>
                                ) : fmt ? (
                                  <span className="text-[9px] font-['Work_Sans'] text-[color:var(--tertiary)]/70 bg-[color:var(--tertiary)]/5 px-2 py-0.5 border border-[color:var(--tertiary)]/15 tracking-widest font-bold">{fmt}</span>
                                ) : null}
                            </div>

                            {/* 크기 */}
                            <div className="text-right text-[11px] text-[var(--text-muted)] font-['Noto_Serif'] tabular-nums">
                                {size}
                            </div>

                            {/* 시간 — DB에서 lazy load */}
                            {isFolder ? (
                              <div className="text-center text-[11px] text-[var(--text-muted)]"></div>
                            ) : (
                              <LazyDuration fileId={item.id} durationMs={item.videoMediaMetadata?.durationMillis ? Number(item.videoMediaMetadata.durationMillis) : null} />
                            )}
                            
                            {/* 액션 */}
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                               {!isFolder && (
                                 <>
                                   <button onClick={(e) => { e.stopPropagation(); toggleFavorite({ id: item.id, name: item.name, mimeType: item.mimeType, artist: 'Google Drive', src: item.id, thumbnailLink: item.thumbnailLink, cover_art: item.thumbnailLink }) }} 
                                     className={`p-1 transition-colors ${isFav ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] hover:text-[var(--tertiary)]'}`}
                                     title="즐겨찾기">
                                     <Heart size={13} fill={isFav ? 'currentColor' : 'none'} />
                                   </button>
                                   <button onClick={(e) => { e.stopPropagation(); handleAddToQueue(item) }}
                                     className="p-1 text-[var(--text-muted)] hover:text-[var(--tertiary)] transition-colors" title="대기열에 추가">
                                     <ListPlus size={13} />
                                   </button>
                                   <button onClick={(e) => { e.stopPropagation(); handleOpenPlaylistModal(item) }}
                                     className="p-1 text-[var(--text-muted)] hover:text-[var(--tertiary)] transition-colors" title="플레이리스트에 저장">
                                     <ListMusic size={13} />
                                   </button>
                                   <button onClick={(e) => { e.stopPropagation(); handleDownload(item) }}
                                     className={`p-1 transition-colors ${downloadingId === item.id ? 'text-[#00ff88] animate-pulse' : 'text-[var(--text-muted)] hover:text-[var(--tertiary)]'}`} title={downloadingId === item.id ? "다운로드 중..." : "다운로드"}>
                                     {downloadingId === item.id ? <Disc3 size={13} className="animate-spin" /> : <Download size={13} />}
                                   </button>
                                 </>
                               )}
                            </div>
                         </div>
                     )
                 })}

                 {/* Infinite scroll sentinel */}
                 {hasMore && (
                   <div ref={sentinelRef} className="flex items-center justify-center py-4">
                     <span className="text-[10px] font-['Work_Sans'] text-[var(--text-muted)] tracking-widest">LOADING_MORE...</span>
                   </div>
                 )}

                 {filteredItems.length === 0 && !loading && (
                   <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                     <Music size={40} className="opacity-30 mb-3" />
                     <span className="text-xs font-['Work_Sans'] tracking-[0.2em] uppercase">
                       {localSearch || serverSearch || aiSearchQuery ? 'NO_RESULTS' : 'EMPTY_FOLDER'}
                     </span>
                   </div>
                 )}
             </div>
          )}
       </div>

      {showPlaylistModal && trackToAdd && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-main)]/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowPlaylistModal(false)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] p-6 w-96 shadow-[var(--shadow-ambient)] rounded-md" onClick={e => e.stopPropagation()}>
            <h2 className="font-['Work_Sans'] text-lg text-[var(--text-main)] font-bold mb-2">ADD TO PLAYLIST</h2>
            <p className="font-['Work_Sans'] text-xs text-[var(--tertiary)] truncate mb-4 border-b border-[var(--border-light)] pb-2">{trackToAdd.name}</p>
            
            <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,89,227,0.15) transparent' }}>
              {playlists.length === 0 ? (
                 <p className="text-[var(--text-muted)] text-xs font-['Work_Sans'] py-4 text-center">플레이리스트가 없습니다.<br/>LISTS 메뉴에서 생성해주세요.</p>
              ) : (
                playlists.map(pl => (
                  <button key={pl.id} onClick={() => handleAddToPlaylist(pl.id)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 group hover:bg-[color:var(--tertiary)]/5 transition border-l-2 border-transparent hover:border-[var(--tertiary)]">
                    <ListMusic size={14} className="text-[var(--text-muted)] group-hover:text-[var(--tertiary)]" />
                    <span className="font-['Work_Sans'] text-sm text-[var(--text-main)]">{pl.name}</span>
                  </button>
                ))
              )}
            </div>
            
            <div className="flex justify-end mt-4 pt-3 border-t border-[color:var(--border-strong)]/30">
              <button onClick={() => setShowPlaylistModal(false)} className="px-4 py-1.5 font-['Work_Sans'] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
