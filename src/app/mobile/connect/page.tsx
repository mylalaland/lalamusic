'use client'

import { useEffect, useState, useRef } from 'react'
import { recommendMusic } from '@/app/actions/ai'
import { getScanSettings } from '@/app/actions/settings'
import { getDriveContents, searchAudioFilesRecursive, getRandomAudioFilesFromFolders } from '@/app/actions/library'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { useConnectStore } from '@/lib/store/useConnectStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { saveToOffline } from '../../../lib/db/offline'
import { 
  Folder, Music, Search, Grid, List, X, Sparkles, RefreshCcw, ChevronRight, Home, 
  Play, ArrowLeft, Loader2, Download, ListPlus, Shuffle, ArrowUpDown, ChevronDown
} from 'lucide-react'

const Icon = {
  Folder: Folder as any, Music: Music as any, Search: Search as any,
  Grid: Grid as any, List: List as any, X: X as any,
  Sparkles: Sparkles as any, RefreshCcw: RefreshCcw as any,
  ChevronRight: ChevronRight as any, Home: Home as any,
  Play: Play as any, ArrowLeft: ArrowLeft as any,
  Loader2: Loader2 as any, Download: Download as any,
  ListPlus: ListPlus as any, Shuffle: Shuffle as any,
  ArrowUpDown: ArrowUpDown as any, ChevronDown: ChevronDown as any
}

export default function ConnectPage() {
  const { 
    path, setPath, items, setItems, originalItems, setOriginalItems,
    currentFolderId, setCurrentFolderId,
    isAiProcessing, setIsAiProcessing, isAiFiltered, setIsAiFiltered,
    serverSort, setServerSort, filterBy, setFilterBy,
    setCacheForFolder, getCacheForFolder,
    settingsLoaded, setSettingsLoaded, cachedAllowedExts, setCachedAllowedExts
  } = useConnectStore()
  
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [searchMode, setSearchMode] = useState<false | 'text' | 'ai'>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showSortSheet, setShowSortSheet] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { setTrack, setPlaylist, playlist } = usePlayerStore()
  const { aiProvider, aiApiKeys, aiModels } = useSettingsStore()

  const currentFolder = path.length > 0 ? path[path.length - 1] : { id: 'root', name: 'Google Drive' }

  // ================================================================
  // 1. 설정 로드 (최초 한 번만 — 캐시)
  // ================================================================
  useEffect(() => {
    if (settingsLoaded) return
    const init = async () => {
      try {
        const settings = await getScanSettings()
        const rootId = settings?.base_folder_id || 'root'
        const rootName = settings?.base_folder_name || 'Google Drive'
        const exts = settings?.allowed_extensions || []
        setCachedAllowedExts(exts)
        
        if (path.length > 0 && path[0].id !== rootId) {
          setPath([{ id: rootId, name: rootName }])
        } else if (path.length === 0) {
          setPath([{ id: rootId, name: rootName }])
        }
      } finally {
        setSettingsLoaded(true)
      }
    }
    init()
  }, [])

  // ================================================================
  // 2. 폴더 진입 시 — 캐시 우선, 없으면 로드
  // ================================================================
  useEffect(() => {
    if (!settingsLoaded) return
    if (path.length === 0) return

    const folderId = currentFolder.id
    
    // 이미 이 폴더의 데이터를 표시 중이면 스킵
    if (folderId === currentFolderId && items.length > 0) return
    
    // 캐시에서 먼저 확인
    const cached = getCacheForFolder(folderId)
    if (cached && cached.length > 0) {
      setItems(cached)
      setOriginalItems(cached)
      setCurrentFolderId(folderId)
      return
    }
    
    loadFolder(folderId)
  }, [path, settingsLoaded])

  // ================================================================
  // 폴더 로드 (API 호출)
  // ================================================================
  const loadFolder = async (folderId: string) => {
    setLoading(true)
    setIsAiFiltered(false)
    setErrorMsg(null)
    
    try {
      const { folders, files } = await getDriveContents(folderId, cachedAllowedExts, '', serverSort, filterBy)
      const combined = [...folders, ...files]
      setItems(combined)
      setOriginalItems(combined)
      setCurrentFolderId(folderId)
      setCacheForFolder(folderId, combined)
    } catch (e: any) {
      setErrorMsg(e?.message || '폴더 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  // 정렬/필터 변경 시 → 현재 폴더 강제 리로드
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return }
    if (!settingsLoaded || !currentFolderId) return
    loadFolder(currentFolder.id)
  }, [serverSort, filterBy])

  // ================================================================
  // 네비게이션
  // ================================================================
  const handleNavigate = (folder: {id: string, name: string}) => {
    setPath([...path, folder])
    setSearchMode(false)
    setErrorMsg(null)
  }

  const handleJumpTo = (index: number) => {
    setPath(path.slice(0, index + 1))
    setErrorMsg(null)
  }

  // ================================================================
  // 재생
  // ================================================================
  const isAudioFile = (item: any) => 
    item.mimeType?.includes('audio') || /\.(mp3|flac|m4a|wav|aac|ogg|opus|wma)$/i.test(item.name || '')

  const handlePlayFile = (file: any) => {
    const musicFiles = items.filter(isAudioFile).map(f => ({
      id: f.id, name: f.name, artist: 'Google Drive',
      thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
    }))
    const targetTrack = musicFiles.find(t => t.id === file.id)
    if (targetTrack) { setPlaylist(musicFiles); setTrack(targetTrack) }
  }

  const handlePlayAll = async () => {
    let musicFiles = items.filter(isAudioFile).map(f => ({
      id: f.id, name: f.name, artist: 'Google Drive',
      thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
    }))
    
    // 폴더에 음악이 없고 하위 폴더만 있으면 재귀 검색
    if (musicFiles.length === 0) {
      setLoading(true)
      try {
        const folders = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder')
        const results = await getRandomAudioFilesFromFolders(folders.map(f => f.id), cachedAllowedExts, 50)
        musicFiles = results.filter(isAudioFile).map((f: any) => ({
          id: f.id, name: f.name, artist: 'Google Drive',
          thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
        }))
      } catch (e) {
        setErrorMsg('음악 로딩 실패')
      } finally {
        setLoading(false)
      }
    }
    
    if (musicFiles.length > 0) { setPlaylist(musicFiles); setTrack(musicFiles[0]) }
  }

  const handleShuffleAll = async () => {
    let musicFiles = items.filter(isAudioFile).map(f => ({
      id: f.id, name: f.name, artist: 'Google Drive',
      thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
    }))

    // 폴더에 음악이 없고 하위 폴더만 있으면 재귀 검색
    if (musicFiles.length === 0) {
      setLoading(true)
      try {
        const folders = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder')
        const results = await getRandomAudioFilesFromFolders(folders.map(f => f.id), cachedAllowedExts, 50)
        musicFiles = results.filter(isAudioFile).map((f: any) => ({
          id: f.id, name: f.name, artist: 'Google Drive',
          thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
        }))
      } catch (e) {
        setErrorMsg('음악 로딩 실패')
      } finally {
        setLoading(false)
      }
    }

    if (musicFiles.length > 0) {
      const shuffled = [...musicFiles].sort(() => Math.random() - 0.5)
      setPlaylist(shuffled); setTrack(shuffled[0])
    }
  }

  const handleAddToQueue = (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    setPlaylist([...playlist, {
      id: item.id, name: item.name, artist: 'Google Drive',
      thumbnailLink: item.thumbnailLink, src: item.id, mimeType: item.mimeType
    }])
  }

  // ================================================================
  // 텍스트 검색 (재귀)
  // ================================================================
  const handleTextSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true); setErrorMsg(null)
    try {
      const results = await searchAudioFilesRecursive(currentFolder.id, searchQuery.trim(), cachedAllowedExts, 0)
      if (results.length > 0) {
        setItems(results); setIsAiFiltered(true)
        setSearchMode(false); setSearchQuery('')
      } else { setErrorMsg('검색 결과가 없습니다.') }
    } catch { setErrorMsg('검색 오류') }
    finally { setIsSearching(false) }
  }

  // ================================================================
  // AI 검색 (재귀 + 에러 표시)
  // ================================================================
  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    const apiKey = aiApiKeys[aiProvider]
    if (!apiKey) { setErrorMsg('AI API Key가 없습니다. 설정에서 등록해주세요.'); return }

    setIsAiProcessing(true); setErrorMsg(null)
    try {
      let audioFiles = originalItems.filter(i => i.mimeType !== 'application/vnd.google-apps.folder')
      if (audioFiles.length === 0) {
        audioFiles = await searchAudioFilesRecursive(currentFolder.id, '', cachedAllowedExts, 3000)
      }
      const limitedFiles = audioFiles.slice(0, 3000)
      if (limitedFiles.length === 0) { setErrorMsg('이 폴더에 음악 파일이 없어요!'); return }

      const result = await recommendMusic(searchQuery, limitedFiles, apiKey, aiProvider, aiModels[aiProvider])
      
      if (result.error) {
        setErrorMsg(`AI 오류: ${result.error}`)
      } else if (result.songs && result.songs.length > 0) {
        setItems(result.songs); setIsAiFiltered(true)
        setSearchMode(false); setSearchQuery('')
      } else {
        setErrorMsg('AI가 적절한 곡을 찾지 못했어요.')
      }
    } catch (e: any) {
      setErrorMsg(`AI 오류: ${e?.message || '알 수 없는 오류'}`)
    } finally { setIsAiProcessing(false) }
  }

  const resetFilter = () => { loadFolder(currentFolder.id) }

  // 오프라인 다운로드 (확인 없이 바로 저장)
  const handleDownload = async (e: React.MouseEvent, item: any) => {
    e.preventDefault(); e.stopPropagation()
    if (downloadingId) return
    setDownloadingId(item.id); setDownloadProgress(0)
    try {
      let metadata: any = { lyrics: null, cover_art: null }
      try {
        const metaRes = await analyzeMusicMetadata(item.id)
        if (metaRes.success && metaRes.heavyMetadata) metadata = metaRes.heavyMetadata
      } catch {}
      const res = await fetch(`/api/stream?id=${item.id}`)
      if (!res.ok) throw new Error('Download failed')
      const contentLength = +(res.headers.get('Content-Length') || 0)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('ReadableStream not supported')
      const chunks = []; let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value); received += value.length
        if (contentLength) setDownloadProgress((received / contentLength) * 100)
      }
      await saveToOffline(item, new Blob(chunks), metadata)
    } catch {}
    finally { setDownloadingId(null); setDownloadProgress(0) }
  }

  // 정렬 라벨
  const getSortLabel = () => {
    const m: Record<string, string> = {
      'name': '이름↑', 'name_asc': '이름↑', 'name_desc': '이름↓',
      'modified': '최신순', 'modified_desc': '최신순', 'modified_asc': '오래된순',
      'size_desc': '큰순', 'size_asc': '작은순'
    }
    return m[serverSort] || '정렬'
  }

  const audioCount = items.filter(isAudioFile).length

  // ================================================================
  // 렌더링
  // ================================================================
  if (!settingsLoaded) {
    return <div className="pb-32 analog-surface min-h-screen flex items-center justify-center"><Icon.Loader2 className="animate-spin text-[var(--text-muted)]" size={32} /></div>
  }

  return (
    <div className="pb-32 analog-surface min-h-screen text-[var(--text-main)] relative">
      {/* AI/검색 로딩 오버레이 */}
      {(isAiProcessing || isSearching) && (
        <div className="fixed inset-0 z-40 bg-[color:var(--bg-surface)]/80 flex flex-col items-center justify-center backdrop-blur-sm">
          <Icon.Sparkles size={48} className="text-[var(--tertiary)] animate-spin mb-4" />
          <p className="text-lg font-bold text-[var(--tertiary)] animate-pulse">
            {isAiProcessing ? 'AI가 노래를 고르고 있어요...' : '검색 중...'}
          </p>
        </div>
      )}

      {/* 헤더 */}
      <div className="sticky top-0 bg-[color:var(--bg-surface)]/90 backdrop-blur-md z-20 border-b border-[var(--border-strong)] h-[56px] flex items-center px-3">
        {searchMode ? (
          <form onSubmit={searchMode === 'ai' ? handleAiSearch : handleTextSearch} className="flex-1 flex items-center gap-2 animate-in fade-in" onTouchStart={e => e.stopPropagation()}>
            {searchMode === 'ai' 
              ? <Icon.Sparkles size={18} className="text-[var(--tertiary)] animate-pulse shrink-0" />
              : <Icon.Search size={18} className="text-[var(--primary)] shrink-0" />
            }
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchMode === 'ai' ? "AI에게 물어보세요..." : "곡 이름 검색 (하위 폴더 포함)"}
              autoFocus className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]" />
            <button type="button" onClick={() => { setSearchMode(false); setSearchQuery('') }}>
              <Icon.X size={18} className="text-[var(--text-muted)]"/>
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between w-full overflow-hidden">
            {/* 뒤로가기 + 현재 폴더 이름 */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {path.length > 1 && (
                <button onClick={() => handleJumpTo(path.length - 2)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0">
                  <Icon.ArrowLeft size={20} />
                </button>
              )}
              <div className="flex items-center overflow-x-auto scrollbar-hide flex-1 min-w-0">
                {path.map((folder, idx) => (
                  <div key={folder.id} className="flex items-center shrink-0">
                    {idx > 0 && <Icon.ChevronRight size={12} className="text-[color:var(--text-muted)]/50 mx-0.5" />}
                    <button onClick={() => handleJumpTo(idx)}
                      className={`py-1 px-1.5 rounded text-xs whitespace-nowrap transition ${
                        idx === path.length - 1 ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-muted)]'
                      }`}>
                      {idx === 0 ? <Icon.Home size={12} className="inline" /> : null}
                      <span className="truncate max-w-[100px] inline-block align-middle">{idx === 0 ? '' : folder.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 도구 버튼 */}
            <div className="flex items-center gap-0.5 shrink-0">
              {isAiFiltered && (
                <button onClick={resetFilter} className="p-1.5 text-[var(--tertiary)]"><Icon.RefreshCcw size={16}/></button>
              )}
              <button onClick={() => setShowSortSheet(true)} className="p-1.5 text-[var(--text-muted)] flex items-center gap-0.5" onTouchStart={e => e.stopPropagation()}>
                <Icon.ArrowUpDown size={16}/><span className="text-[9px] font-bold">{getSortLabel()}</span>
              </button>
              <button onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} className="p-1.5 text-[var(--text-muted)]">
                {viewMode === 'list' ? <Icon.Grid size={16}/> : <Icon.List size={16}/>}
              </button>
              <button onClick={() => setSearchMode('text')} className="p-1.5 text-[var(--primary)]"><Icon.Search size={16}/></button>
              <button onClick={() => setSearchMode('ai')} className="p-1.5 text-[var(--tertiary)]"><Icon.Sparkles size={16}/></button>
            </div>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {errorMsg && (
        <div className="mx-3 mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-xs text-red-400">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 ml-2"><Icon.X size={14}/></button>
        </div>
      )}

      {/* 컨텐츠 */}
      <div className={`p-2 ${viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-0.5'}`}>
        {/* Play All */}
        {!loading && items.length > 0 && (
          <div className="flex gap-2 mb-2 col-span-full">
            <button onClick={handlePlayAll} className="flex-1 py-2.5 bg-[var(--tertiary)]/10 text-[var(--tertiary)] rounded-xl font-bold hover:bg-[var(--tertiary)]/20 flex items-center justify-center gap-2 text-sm border border-[var(--tertiary)]/20">
              <Icon.Play size={16} fill="currentColor"/> Play All {audioCount > 0 ? `(${audioCount})` : ''}
            </button>
            <button onClick={handleShuffleAll} className="w-12 bg-[var(--bg-container-high)] rounded-xl flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-strong)]">
              <Icon.Shuffle size={18} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="col-span-full text-center py-20 flex flex-col items-center text-[var(--text-muted)]">
            <Icon.Loader2 className="animate-spin mb-2" size={24}/> <span className="text-sm">Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-20 text-[var(--text-muted)]">
            {isAiFiltered ? "추천 결과가 없어요 😅" : "빈 폴더"}
          </div>
        ) : (
          items.map(item => (
            <div key={item.id}
              onClick={() => item.mimeType === 'application/vnd.google-apps.folder' ? handleNavigate({id: item.id, name: item.name}) : handlePlayFile(item)}
              className={`cursor-pointer active:scale-[0.98] transition-transform ${
                viewMode === 'list' 
                  ? 'flex items-center gap-3 p-2.5 hover:bg-[var(--bg-container-high)] rounded-lg' 
                  : 'flex flex-col items-center p-2 hover:bg-[var(--bg-container-high)] rounded-xl aspect-[3/4]'
              }`}>
              {/* 아이콘 */}
              <div className={`flex items-center justify-center bg-[var(--bg-container)] rounded-lg overflow-hidden shrink-0 relative ${
                viewMode === 'list' ? 'w-10 h-10' : 'w-full aspect-square mb-1.5'
              }`}>
                {item.mimeType === 'application/vnd.google-apps.folder' ? (
                  <Icon.Folder size={viewMode === 'list' ? 20 : 28} className="text-[var(--tertiary)]" fill="currentColor" fillOpacity={0.2} />
                ) : (
                  <>
                    <Icon.Music size={viewMode === 'list' ? 18 : 28} className="absolute text-[color:var(--text-muted)]/40" />
                    {item.thumbnailLink && (
                      <img src={item.thumbnailLink} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                        className="w-full h-full object-cover relative z-10" onError={e => e.currentTarget.style.display = 'none'} />
                    )}
                  </>
                )}
              </div>
              {/* 텍스트 */}
              <div className={`min-w-0 ${viewMode === 'list' ? 'flex-1' : 'w-full text-center'}`}>
                <p className={`font-medium truncate text-[var(--text-main)] ${viewMode === 'list' ? 'text-sm' : 'text-[11px]'}`}>
                  {item.name.replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma)$/i, '')}
                </p>
                {viewMode === 'list' && item.mimeType !== 'application/vnd.google-apps.folder' && item.size && (
                  <p className="text-[11px] text-[var(--text-muted)]">{(parseInt(item.size)/1024/1024).toFixed(1)} MB</p>
                )}
              </div>
              {/* 우측 액션 */}
              {viewMode === 'list' && item.mimeType === 'application/vnd.google-apps.folder' && (
                <Icon.ChevronRight size={16} className="text-[var(--text-muted)] shrink-0"/>
              )}
              {item.mimeType !== 'application/vnd.google-apps.folder' && (
                <div className="flex items-center shrink-0 z-30">
                  <button onClick={e => handleAddToQueue(e, item)} className="p-1.5 text-[var(--text-muted)]"><Icon.ListPlus size={18}/></button>
                  <button onClick={e => handleDownload(e, item)} className="p-1.5 text-[var(--text-muted)]">
                    {downloadingId === item.id ? (
                      <div className="w-[16px] h-[16px] relative">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" fill="none" stroke="var(--bg-container-highest)" strokeWidth="4" />
                          <circle cx="12" cy="12" r="10" fill="none" stroke="var(--tertiary)" strokeWidth="4"
                            strokeDasharray="62.83" strokeDashoffset={62.83 - (62.83 * downloadProgress) / 100} />
                        </svg>
                      </div>
                    ) : <Icon.Download size={18}/>}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ================================================================ */}
      {/* 정렬/필터 하단 시트 (Bottom Sheet) */}
      {/* ================================================================ */}
      {showSortSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 animate-in fade-in" onClick={() => setShowSortSheet(false)} onTouchStart={e => e.stopPropagation()} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-strong)] rounded-t-2xl animate-in slide-in-from-bottom max-h-[70vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            onTouchStart={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[var(--text-muted)]/30 rounded-full mx-auto mt-3 mb-4" />
            
            <div className="px-5 pb-6">
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-3">정렬</h3>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { key: 'name', label: '이름 ↑' },
                  { key: 'name_desc', label: '이름 ↓' },
                  { key: 'modified_desc', label: '최신 수정순' },
                  { key: 'modified_asc', label: '오래된 순' },
                  { key: 'size_desc', label: '크기 큰 순' },
                  { key: 'size_asc', label: '크기 작은 순' },
                ].map(opt => (
                  <button key={opt.key}
                    onClick={() => { setServerSort(opt.key); setShowSortSheet(false) }}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition border ${
                      serverSort === opt.key 
                        ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/10 border-[var(--tertiary)]/30 font-bold' 
                        : 'text-[var(--text-main)] bg-[var(--bg-container-high)] border-[var(--border-strong)]'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <h3 className="font-bold text-sm text-[var(--text-main)] mb-3">필터</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'all', label: '전체' },
                  { key: 'folders', label: '폴더만' },
                  { key: 'files', label: '음악만' },
                ].map(opt => (
                  <button key={opt.key}
                    onClick={() => { setFilterBy(opt.key); setShowSortSheet(false) }}
                    className={`py-3 rounded-xl text-sm font-medium transition border ${
                      filterBy === opt.key 
                        ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/10 border-[var(--tertiary)]/30 font-bold' 
                        : 'text-[var(--text-main)] bg-[var(--bg-container-high)] border-[var(--border-strong)]'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}