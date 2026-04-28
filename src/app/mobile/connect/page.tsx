'use client'

import { useEffect, useState } from 'react'
import { recommendMusic } from '@/app/actions/ai'
import { getScanSettings } from '@/app/actions/settings'
import { getDriveContents } from '@/app/actions/library'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
// [수정] 경로 주의: 실제 프로젝트 구조에 맞춰 import 경로를 확인해주세요. (예: @/store/useAppStore)
import { useConnectStore } from '@/lib/store/useConnectStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { saveToOffline } from '../../../lib/db/offline'
import { Folder, Music, Search, Grid, List, X, Sparkles, RefreshCcw, ChevronRight, Home, Play, FileAudio, ArrowLeft, Loader2, Download, CheckCircle2, ListPlus, Shuffle } from 'lucide-react'

const Icon = {
  Folder: Folder as any,
  Music: Music as any,
  Search: Search as any,
  Grid: Grid as any,
  List: List as any,
  X: X as any,
  Sparkles: Sparkles as any,
  RefreshCcw: RefreshCcw as any,
  ChevronRight: ChevronRight as any,
  Home: Home as any,
  Play: Play as any,
  FileAudio: FileAudio as any,
  ArrowLeft: ArrowLeft as any,
  Loader2: Loader2 as any,
  Download: Download as any,
  CheckCircle2: CheckCircle2 as any,
  ListPlus: ListPlus as any,
  Shuffle: Shuffle as any
}

export default function ConnectPage() {
  // --- 상태 관리 ---
  // [수정] Connect 전용 스토어 사용
  const { 
    path, setPath, items, setItems, currentFolderId, setCurrentFolderId,
    isAiProcessing, setIsAiProcessing, isAiFiltered, setIsAiFiltered 
  } = useConnectStore()
  
  const [baseFolder, setBaseFolder] = useState<{id: string, name: string} | null>(null) // Music Root 제한
  const [allowedExts, setAllowedExts] = useState<string[]>([]) // [NEW] 허용된 확장자

  const [originalItems, setOriginalItems] = useState<any[]>([]) // 필터링 복구용은 로컬 유지
  const [loading, setLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true) // [NEW] 초기 설정 로딩 상태 (깜빡임 방지)
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list') // [복구] 보기 모드
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0) // [NEW] 다운로드 진행률 (0~100)

  const { setTrack, setPlaylist, playlist } = usePlayerStore()
  const { aiProvider, aiApiKeys } = useSettingsStore()

  // 현재 폴더 (경로의 마지막)
  const currentFolder = path.length > 0 ? path[path.length - 1] : { id: 'root', name: 'Google Drive' }

  // 1. 초기 로딩 (설정 확인 및 초기 경로 설정)
  useEffect(() => {
    const init = async () => {
        try {
            const settings = await getScanSettings()
            const rootId = settings?.base_folder_id || 'root'
            const rootName = settings?.base_folder_name || 'Google Drive'
            const exts = settings?.allowed_extensions || []

            setAllowedExts(exts)
            
            // [FIX] 설정된 Root와 현재 경로의 Root가 다르면 리셋 (설정 변경 반영)
            if (path.length > 0 && path[0].id !== rootId) {
                const rootInfo = { id: rootId, name: rootName }
                setBaseFolder(rootInfo)
                setPath([rootInfo])
            } 
            // 경로가 아예 없으면 초기화
            else if (path.length === 0) {
                const rootInfo = { id: rootId, name: rootName }
                setBaseFolder(settings?.base_folder_id ? rootInfo : null)
                setPath([rootInfo])
            }
        } finally {
            setIsInitializing(false) // 설정 로드 완료
        }
    }
    init()
  }, [])

  // 2. 폴더 내용 로드 (경로가 바뀔 때마다)
  useEffect(() => {
    if (isInitializing) return // 초기화 중엔 로드하지 않음

    if (path.length > 0) {
        // [최적화] 이미 현재 폴더의 데이터가 로드되어 있다면 API 호출 스킵
        if (currentFolder.id === currentFolderId && items.length > 0) {
             // 단, 확장자 설정이 바뀌었을 수도 있으므로 여기서 리턴하면 안될 수도 있음.
             // 하지만 성능을 위해 유지하고, 설정을 바꾸면 path[0]이 달라져서 리셋되므로 괜찮음.
             return
        }
        
        loadFolder(currentFolder.id) 
    }
  }, [path, allowedExts, isInitializing]) // isInitializing 추가

  const loadFolder = async (folderId: string) => {
    setLoading(true)
    setIsAiFiltered(false)
    
    const { folders, files } = await getDriveContents(folderId, allowedExts)
    
    // UI 통일성을 위해 합침 (폴더 먼저)
    const combined = [...folders, ...files]
    setItems(combined)
    setOriginalItems(combined)
    setCurrentFolderId(folderId) // [NEW] 현재 로드된 폴더 ID 저장
    setLoading(false)
  }

  // --- 네비게이션 핸들러 ---
  const handleNavigate = (folder: {id: string, name: string}) => {
    setPath([...path, folder])
    setSearchMode(false)
  }

  // 빵부스러기 클릭 (점프)
  const handleJumpTo = (index: number) => {
      setPath(path.slice(0, index + 1))
  }

  // --- 재생 핸들러 ---
  const handlePlayFile = (file: any) => {
    const musicFiles = items
        .filter(i => i.mimeType.includes('audio'))
        .map(f => ({
            id: f.id,
            name: f.name,
            artist: 'Google Drive',
            thumbnailLink: f.thumbnailLink,
            src: f.id,
            mimeType: f.mimeType
        }))

    const targetTrack = musicFiles.find(t => t.id === file.id)
    if (targetTrack) {
        setPlaylist(musicFiles)
        setTrack(targetTrack)
    }
  }

  // --- AI 검색 핸들러 ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    // [FIX] 폴더가 아닌 항목은 모두 오디오 파일로 간주 (이미 API에서 필터링해서 가져오므로 안전함)
    const audioFiles = originalItems.filter(item => item.mimeType !== 'application/vnd.google-apps.folder')
    if (audioFiles.length === 0) return alert("이 폴더에는 음악 파일이 없어요!")

    setIsAiProcessing(true)
    try {
        const result = await recommendMusic(searchQuery, audioFiles, aiApiKeys[aiProvider], aiProvider)
        if (result.songs && result.songs.length > 0) {
            setItems(result.songs)
            setIsAiFiltered(true)
            setSearchMode(false)
            setSearchQuery('')
        } else {
            alert("AI가 적절한 곡을 찾지 못했어요.")
        }
    } catch {
        alert("AI 오류 발생")
    } finally {
        setIsAiProcessing(false)
    }
  }

  const resetFilter = () => {
    loadFolder(currentFolder.id) // 원본 데이터 다시 로드
  }

  // [NEW] Play All 핸들러
  const handlePlayAllAudio = () => {
    const audioFiles = items.filter(i => i.mimeType.includes('audio'))
    if (audioFiles.length === 0) return
    const musicFiles = audioFiles.map(f => ({
        id: f.id, name: f.name, artist: 'Google Drive',
        thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
    }))
    setPlaylist(musicFiles)
    setTrack(musicFiles[0])
  }

  // [NEW] Shuffle Play 핸들러
  const handleShuffleAllAudio = () => {
    const audioFiles = items.filter(i => i.mimeType.includes('audio'))
    if (audioFiles.length === 0) return
    const musicFiles = audioFiles.map(f => ({
        id: f.id, name: f.name, artist: 'Google Drive',
        thumbnailLink: f.thumbnailLink, src: f.id, mimeType: f.mimeType
    }))
    const shuffled = [...musicFiles].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled)
    setTrack(shuffled[0])
  }

  // [NEW] 대기열에 추가 핸들러
  const handleAddToQueue = (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    const track = {
        id: item.id,
        name: item.name,
        artist: 'Google Drive',
        thumbnailLink: item.thumbnailLink,
        src: item.id,
        mimeType: item.mimeType
    }
    // 기존 플레이리스트 뒤에 추가
    setPlaylist([...playlist, track])
    alert("재생 목록에 추가되었습니다.")
  }

  // [NEW] 다운로드 핸들러 (오프라인 저장)
  const handleDownload = async (e: React.MouseEvent, item: any) => {
    e.preventDefault() // [FIX] 기본 동작 방지
    e.stopPropagation()
    if (downloadingId) return
    if (!confirm(`'${item.name}'을(를) 오프라인 보관함에 저장하시겠습니까?`)) return

    setDownloadingId(item.id)
    setDownloadProgress(0)

    try {
        // 1. 메타데이터(가사, 앨범아트) 먼저 가져오기
        // [FIX] 타입 명시 (null 추론 방지)
        let metadata: { lyrics: string | null, cover_art: string | null } = { lyrics: null, cover_art: null }
        try {
            const metaRes = await analyzeMusicMetadata(item.id)
            if (metaRes.success && metaRes.heavyMetadata) {
                metadata = { 
                    lyrics: metaRes.heavyMetadata.lyrics, 
                    cover_art: metaRes.heavyMetadata.cover_art 
                }
            }
        } catch (e) {
            console.log('Metadata fetch failed, saving without metadata')
        }

        // 스트리밍 API를 통해 파일 Blob 가져오기
        const res = await fetch(`/api/stream?id=${item.id}`)
        if (!res.ok) throw new Error('Download failed')
        
        // [NEW] 진행률 계산을 위한 Reader 설정
        const contentLength = +(res.headers.get('Content-Length') || 0)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('ReadableStream not supported')

        const chunks = []
        let receivedLength = 0

        while(true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            receivedLength += value.length
            if (contentLength) setDownloadProgress((receivedLength / contentLength) * 100)
        }

        const blob = new Blob(chunks)
        await saveToOffline(item, blob, metadata)
        alert('저장 완료! Files 메뉴에서 확인하세요.')
    } catch (error) {
        alert('다운로드 실패')
    } finally {
        setDownloadingId(null)
        setDownloadProgress(0)
    }
  }

  // [NEW] 초기화 중일 때는 로딩 화면만 표시 (깜빡임 방지)
  if (isInitializing) {
      return (
          <div className="pb-32 analog-surface min-h-screen text-[var(--text-main)] flex items-center justify-center">
              <Icon.Loader2 className="animate-spin text-[color:var(--text-muted)]/80" size={32} />
          </div>
      )
  }

  return (
    <div className="pb-32 analog-surface min-h-screen text-[var(--text-main)] relative">
      {/* AI 로딩 오버레이 */}
      {isAiProcessing && (
        // [FIX] fixed로 변경하여 화면 중앙 고정, z-40으로 탭바(z-50)보다 뒤에 배치하여 네비게이션 가능하게 함
        <div className="fixed inset-0 z-40 bg-[color:var(--bg-surface)]/80 flex flex-col items-center justify-center backdrop-blur-sm">
            <Icon.Sparkles size={48} className="text-[var(--tertiary)] animate-spin mb-4" />
            <p className="text-lg font-bold text-[var(--tertiary)] animate-pulse">
                AI가 노래를 고르고 있어요...
            </p>
        </div>
      )}

      {/* 헤더 영역 */}
      <div className="sticky top-0 bg-[color:var(--bg-surface)]/90 backdrop-blur-md z-20 border-b border-[var(--border-strong)] h-[60px] flex items-center px-4">
        {searchMode ? (
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-3 animate-in fade-in">
            <Icon.Sparkles size={20} className="text-[var(--tertiary)] animate-pulse" />
            <input 
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="어떤 노래를 찾으시나요?" autoFocus
              className="flex-1 bg-transparent border-none outline-none text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
            <button type="button" onClick={() => { setSearchMode(false); setSearchQuery(''); }}><Icon.X size={20} className="text-[var(--text-muted)]"/></button>
          </form>
        ) : (
          <div className="flex items-center justify-between w-full overflow-hidden">
            {/* 📍 [복구됨] 빵부스러기 경로 네비게이션 */}
            <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide mr-2 mask-linear-fade">
               {path.map((folder, index) => (
                   <div key={folder.id} className="flex items-center shrink-0">
                       {index > 0 && <Icon.ChevronRight size={14} className="text-[color:var(--text-muted)]/60 mx-1" />}
                       
                       <button 
                         onClick={() => handleJumpTo(index)}
                         className={`
                            flex items-center gap-1.5 py-1 px-2 rounded-lg transition text-sm whitespace-nowrap
                            ${index === path.length - 1 
                                ? 'text-[var(--text-main)] font-bold bg-[var(--bg-container-highest)] pointer-events-none' // 현재 폴더
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container-high)]' // 상위 폴더
                            }
                         `}
                       >
                           {index === 0 && <Icon.Home size={14} />}
                           <span className="truncate max-w-[120px]">{folder.name}</span>
                       </button>
                   </div>
               ))}
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
                {isAiFiltered && (
                    <button onClick={resetFilter} className="p-2 bg-[var(--bg-container-high)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)]"><Icon.RefreshCcw size={18}/></button>
                )}
                {/* [복구됨] 뷰 모드 토글 */}
                <button onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                    {viewMode === 'list' ? <Icon.Grid size={20}/> : <Icon.List size={20}/>}
                </button>
                <button onClick={() => setSearchMode(true)} className="p-2 text-[var(--tertiary)] hover:bg-[var(--bg-container-high)] rounded-full"><Icon.Search size={20}/></button>
            </div>
          </div>
        )}
      </div>

      {/* 컨텐츠 리스트 */}
      <div className={`p-2 ${viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-1'}`}>
        {/* Play All / Shuffle 액션 바 (오디오 파일이 있을 때만) */}
        {!loading && items.filter(i => i.mimeType.includes('audio')).length > 0 && (
            <div className="flex gap-2 mb-3 col-span-full">
                <button onClick={handlePlayAllAudio} 
                        className="flex-1 py-3 bg-[var(--tertiary)]/10 text-[var(--tertiary)] rounded-xl font-bold hover:bg-[var(--tertiary)]/20 flex items-center justify-center gap-2 transition border border-[var(--tertiary)]/20">
                    <Icon.Play size={18} fill="currentColor"/> Play All ({items.filter(i => i.mimeType.includes('audio')).length})
                </button>
                <button onClick={handleShuffleAllAudio} 
                        className="w-14 bg-[var(--bg-container-high)] rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container-highest)] transition border border-[var(--border-strong)]">
                    <Icon.Shuffle size={22} />
                </button>
            </div>
        )}
        {loading ? (
            <div className="col-span-full text-center py-20 text-[color:var(--text-muted)]/80 flex flex-col items-center">
                <Icon.Loader2 className="animate-spin mb-2"/> <span>Loading...</span>
            </div>
        ) : items.length === 0 ? (
            <div className="col-span-full text-center py-20 text-[color:var(--text-muted)]/60">
                {isAiFiltered ? "추천된 곡이 없습니다 😅" : "빈 폴더입니다"}
            </div>
        ) : (
            items.map((item) => (
                <div 
                    key={item.id}
                    onClick={() => item.mimeType === 'application/vnd.google-apps.folder' ? handleNavigate({id: item.id, name: item.name}) : handlePlayFile(item)}
                    className={`
                        cursor-pointer active:scale-95 transition-transform 
                        ${viewMode === 'list' 
                            ? 'flex items-center gap-3 p-3 hover:bg-[var(--bg-container-high)] border-b border-[color:var(--border-light)]/50 rounded-lg' 
                            : 'flex flex-col items-center p-2 hover:bg-[var(--bg-container-high)] rounded-xl aspect-[3/4] border border-transparent hover:border-[var(--border-strong)]'
                        }
                    `}
                >
                    {/* 아이콘/썸네일 영역 */}
                    <div className={`
                        flex items-center justify-center bg-[var(--bg-container)] rounded-xl overflow-hidden shrink-0 text-[color:var(--text-muted)]/80 relative
                        ${viewMode === 'list' ? 'w-10 h-10' : 'w-full aspect-square mb-2'}
                    `}>
                        {isAiFiltered && (
                            <div className="absolute top-0 right-0 bg-[var(--tertiary)] p-0.5 rounded-bl-lg z-10"><Icon.Sparkles size={10} className="text-[var(--text-main)]" /></div>
                        )}

                        {item.mimeType === 'application/vnd.google-apps.folder' ? (
                            <Icon.Folder size={viewMode === 'list' ? 20 : 32} className="text-[var(--tertiary)]" fill="currentColor" fillOpacity={0.2} />
                        ) : (
                            <>
                                {/* [FIX] 기본 아이콘을 배경에 깔고, 이미지가 있으면 위에 덮음 (이미지 로딩 실패 시 아이콘 보임) */}
                                <Icon.Music size={viewMode === 'list' ? 20 : 32} className="absolute text-[color:var(--text-muted)]/60" />
                                {item.thumbnailLink && (
                                    <img 
                                        src={item.thumbnailLink} 
                                        alt={item.name}
                                        referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 relative z-10 bg-[var(--bg-container)]"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-container)] opacity-0 group-hover:opacity-100 z-20"><Icon.Play size={12} fill="white"/></div>
                            </>
                        )}
                    </div>

                    {/* 텍스트 영역 */}
                    <div className={`min-w-0 ${viewMode === 'list' ? 'flex-1' : 'w-full text-center'}`}>
                        <p className={`font-medium truncate text-[var(--text-main)] ${viewMode === 'list' ? 'text-sm' : 'text-xs'}`}>
                            {item.name.replace(/\.(mp3|wav|flac|m4a)$/i, '')}
                        </p>
                        {viewMode === 'list' && item.mimeType !== 'application/vnd.google-apps.folder' && (
                            <p className="text-xs text-[color:var(--text-muted)]/80">{item.size ? (parseInt(item.size)/1024/1024).toFixed(1) + ' MB' : 'Audio'}</p>
                        )}
                    </div>

                    {/* 리스트뷰 우측 아이콘 */}
                    {viewMode === 'list' && item.mimeType === 'application/vnd.google-apps.folder' && (
                        <Icon.ChevronRight size={18} className="text-[color:var(--text-muted)]/60"/>
                    )}

                    {/* [NEW] 액션 버튼들 (오디오 파일인 경우) */}
                    {item.mimeType !== 'application/vnd.google-apps.folder' && (
                        <div className="flex items-center relative z-30">
                            {/* 재생 목록 추가 버튼 */}
                            <button onClick={(e) => handleAddToQueue(e, item)} className="p-2 text-[var(--text-muted)] hover:text-[var(--success)] transition">
                                <Icon.ListPlus size={20}/>
                            </button>

                            {/* 다운로드 버튼 */}
                            <button onClick={(e) => handleDownload(e, item)} className="p-2 text-[var(--text-muted)] hover:text-[var(--tertiary)] transition">
                                {downloadingId === item.id ? (
                                    // [NEW] 원형 프로그레스 바 (숫자 없이 차오르는 원)
                                    <div className="relative w-[18px] h-[18px]">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                                            {/* 배경 원 */}
                                            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--bg-container-highest)" strokeWidth="4" />
                                            {/* 진행 원 */}
                                            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--tertiary)" strokeWidth="4" 
                                                strokeDasharray="62.83" // 2 * pi * r (approx)
                                                strokeDashoffset={62.83 - (62.83 * downloadProgress) / 100}
                                                className="transition-all duration-200 ease-linear"
                                            />
                                        </svg>
                                    </div>
                                ) : (
                                    <Icon.Download size={20}/>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            ))
        )}
      </div>
    </div>
  )
}