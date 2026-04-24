'use client'

import { useEffect, useState, useMemo } from 'react'
import { getLibraryTracks, getLibraryCount, getScannedFolders, getTracksByFolderIds, deleteFolderAndChildren, syncFilesInFolder, syncOnlyFolders, syncLibraryChunk, getDescendantFolderIds } from '@/app/actions/library'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { createPlaylist, getPlaylists, getPlaylistTracks, addTrackToPlaylist, deletePlaylist, removeTrackFromPlaylist } from '@/app/actions/playlist'
import { getScanSettings } from '@/app/actions/settings'
import { searchLibraryWithAI } from '@/app/actions/ai'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { useLibraryStore } from '@/lib/store/useLibraryStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { 
  RefreshCw, Music, Loader2, Plus, ListMusic, Trash2, ArrowLeft, Sparkles, 
  ChevronRight, Folder, ChevronDown, Map, Shuffle, Play, FileMusic, X, Calendar, ArrowUpNarrowWide, ArrowDownWideNarrow, CheckSquare, Square, Bookmark
} from 'lucide-react'
import FolderTreeItem from '@/components/shared/FolderTreeItem'
import TrackItem from '@/components/shared/TrackItem'

const Icon = {
  RefreshCw: RefreshCw as any,
  Music: Music as any,
  Loader2: Loader2 as any,
  Plus: Plus as any,
  ListMusic: ListMusic as any,
  Trash2: Trash2 as any,
  ArrowLeft: ArrowLeft as any,
  Sparkles: Sparkles as any,
  ChevronRight: ChevronRight as any,
  Folder: Folder as any,
  ChevronDown: ChevronDown as any,
  Map: Map as any,
  Shuffle: Shuffle as any,
  Play: Play as any,
  FileMusic: FileMusic as any,
  X: X as any,
  Calendar: Calendar as any,
  ArrowUpNarrowWide: ArrowUpNarrowWide as any,
  ArrowDownWideNarrow: ArrowDownWideNarrow as any,
  CheckSquare: CheckSquare as any,
  Square: Square as any,
  Bookmark: Bookmark as any
}


export default function LibraryPage() {
  const { 
    currentView, tracks, totalCount, playlists, folders, baseFolderId,
    selectedFolder, folderTracks, bookmarks, loading, page, hasMore,
    searchQuery, isAiMode, sortBy, sortOrder, selectedPlaylist, playlistTracks, selectedFolderIds, // sortOrder, selectedFolderIds 추가
    setState, toggleFolderSelection 
  } = useLibraryStore()

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStatus, setSyncStatus] = useState('')
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false)
  const [trackToAdd, setTrackToAdd] = useState<any>(null)

  const { setTrack, setPlaylist, currentTrack, isPlaying } = usePlayerStore()
  const { aiProvider, aiApiKeys } = useSettingsStore()

  useEffect(() => {
    refreshLibraryCount()
    loadPlaylists()
    loadSettingsAndFolders()
    
    if (currentView === 'tracks' && tracks.length === 0) {
        loadTracks(0, searchQuery)
    }
  }, [])

  // 검색/정렬/순서 변경 감지 (자동 재로딩)
  useEffect(() => {
      if (currentView === 'tracks') {
          const timer = setTimeout(() => {
             // 데이터가 있고 검색어가 없을 때, 페이지 0 초기 로딩 방지 (단, 정렬조건이 바뀌면 로딩해야 함)
             if (page === 0 && tracks.length > 0 && searchQuery === '') {
                 // 정렬만 바꾸는 경우를 위해 로직 수행 (여기서는 단순화)
                 loadTracks(0, searchQuery) 
                 return
             }
             loadTracks(0, searchQuery)
          }, 500)
          return () => clearTimeout(timer)
      }
  }, [searchQuery, isAiMode, sortBy, sortOrder])

  const loadSettingsAndFolders = async () => {
      const settings = await getScanSettings()
      if (settings?.base_folder_id) {
          setState({ baseFolderId: settings.base_folder_id })
      }
      if (folders.length === 0) loadFolderMap()
  }

  const refreshLibraryCount = async () => {
    const count = await getLibraryCount()
    setState({ totalCount: count })
  }

  const loadTracks = async (offsetPage: number, query: string) => {
    setState({ loading: true })
    if (isAiMode && query) {
      const aiTracks = await searchLibraryWithAI(query, aiApiKeys[aiProvider], aiProvider)
      setState({ tracks: aiTracks, hasMore: false, loading: false })
    } else {
      const limit = 50
      const offset = offsetPage * limit
      const newTracks = await getLibraryTracks(query, limit, offset)
      
      // 🟢 [정렬 로직 강화] 날짜/제목/가수/앨범 + 오름/내림차순
      newTracks.sort((a: any, b: any) => {
          let valA = '', valB = '';
          if (sortBy === 'date') {
              // created_at 기준 (없으면 id)
              valA = a.created_at || a.id;
              valB = b.created_at || b.id;
          } else {
              valA = a[sortBy] || '';
              valB = b[sortBy] || '';
          }

          if (sortOrder === 'asc') return valA.localeCompare(valB);
          else return valB.localeCompare(valA); // 내림차순
      })

      const more = newTracks.length >= limit
      setState({ 
          hasMore: more, 
          tracks: offsetPage === 0 ? newTracks : [...tracks, ...newTracks],
          page: offsetPage,
          loading: false
      })
    }
  }

  const loadPlaylists = async () => {
    const data = await getPlaylists()
    setState({ playlists: data })
  }

  const loadFolderMap = async () => {
    setState({ loading: true })
    let data = await getScannedFolders()
    setState({ folders: data, loading: false })
  }

  const handleSelectFolder = async (folderNode: any) => {
    // 단순 클릭 시 이동 (확인 메시지 제거하여 탐색 속도 높임, 혹은 유지 가능)
    // if (!confirm(`📂 "${folderNode.name}" 폴더로 이동?`)) return; 
    
    setState({ selectedFolder: folderNode, loading: true, currentView: 'folder_detail' })

    const targetIds = [folderNode.id]
    const queue = [folderNode.id]
    
    while (queue.length > 0) {
        const curr = queue.shift()
        const children = folders.filter(f => f.parent_id === curr)
        children.forEach(child => {
            targetIds.push(child.id)
            queue.push(child.id)
        })
    }
    
    const fTracks = await getTracksByFolderIds(targetIds)
    setState({ folderTracks: fTracks, loading: false })
  }

  // 🟢 [NEW] 선택된 폴더들 일괄 삭제
  const handleBatchDeleteFolders = async () => {
      if (selectedFolderIds.length === 0) return alert('삭제할 폴더를 선택해주세요.')
      if (!confirm(`선택한 ${selectedFolderIds.length}개의 폴더(및 하위 항목)를 라이브러리 맵에서 삭제하시겠습니까?`)) return

      let successCount = 0
      for (const id of selectedFolderIds) {
          const res = await deleteFolderAndChildren(id)
          if (res.success) successCount++
      }

      alert(`${successCount}개 폴더 삭제 완료.`)
      setState({ selectedFolderIds: [] }) // 선택 초기화
      loadFolderMap()
      refreshLibraryCount()
  }

  const handleShufflePlay = (list: any[]) => {
    if (!list || list.length === 0) return alert('재생할 곡이 없습니다.')
    const shuffled = [...list].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled)
    setTrack(shuffled[0]) 
  }

  const handleSync = async () => {
    // ... (기존 동기화 로직과 동일, 생략 없이 전체 포함) ...
    const settings = await getScanSettings()
    if (settings?.base_folder_id) setState({ baseFolderId: settings.base_folder_id })
    const scanTarget = settings?.scan_folder_id ? `지정된 폴더` : "전체 구글 드라이브"
    
    if (!confirm(`${scanTarget} 스캔을 시작하시겠습니까?`)) return
    setSyncing(true)
    setSyncProgress(0)
    try {
        if (settings?.scan_folder_id) {
            setSyncStatus(`폴더 구조 파악 중...`)
            const folderIds = await getDescendantFolderIds(settings.scan_folder_id)
            let totalSynced = 0
            for (let i = 0; i < folderIds.length; i++) {
                const fid = folderIds[i]
                setSyncStatus(`스캔 중 (${i+1}/${folderIds.length}) - ${totalSynced}곡...`)
                const result: any = await syncFilesInFolder(fid, settings?.allowed_extensions)
                if (!result.error) totalSynced += (result.count || 0)
                setSyncProgress(totalSynced)
            }
            alert(`🎉 완료! ${totalSynced}곡 저장됨.`)
        } else {
            await syncOnlyFolders() 
            let nextPageToken: string | null | undefined = undefined
            let totalSynced = 0
            do {
                const result: any = await syncLibraryChunk(nextPageToken || undefined, undefined, settings?.allowed_extensions)
                if (result.error) break;
                totalSynced += (result.count || 0)
                nextPageToken = result.nextPageToken
                setSyncProgress(totalSynced)
                if (totalSynced >= 100000) break 
            } while (nextPageToken)
            alert(`🎉 완료! ${totalSynced}곡 저장됨.`)
        }
        refreshLibraryCount()
        loadFolderMap()
    } catch (e) {
        alert('스캔 중 오류 발생')
    } finally {
        setSyncing(false)
        setSyncStatus('')
    }
  }

  const handleAnalyze = async () => {
    if (tracks.length === 0) return alert("목록이 비어있습니다.")
    if (!confirm("메타데이터 분석 시작?")) return
    setAnalyzing(true)
    let processed = 0
    
    try {
        const { saveOfflineMetadata } = await import('@/lib/db/offline')
        for (const track of tracks) {
            if (track.artist) continue;
            setAnalyzeProgress(`분석 중: ${track.name}...`)
            const result = await analyzeMusicMetadata(track.id)
            if (result.success && result.heavyMetadata) {
                 await saveOfflineMetadata(track.id, result.heavyMetadata)
            }
            processed++
        }
    } catch(e) {
        console.error(e)
    }

    setAnalyzing(false)
    setAnalyzeProgress('')
    alert(`${processed}곡 분석 완료!`)
    loadTracks(0, searchQuery)
  }

  const handleRemoveTrackFromPlaylist = async (e: any, trackId: string) => {
    e.stopPropagation()
    if(!confirm("이 곡을 플레이리스트에서 뺄까요?")) return
    const res = await removeTrackFromPlaylist(selectedPlaylist.id, trackId)
    if(res.success) setState({ playlistTracks: playlistTracks.filter(t => t.id !== trackId) })
  }

  const rootFolders = useMemo(() => {
    if (folders.length === 0) return []
    if (baseFolderId) {
        const baseRoot = folders.find(f => f.id === baseFolderId)
        if (baseRoot) return [baseRoot]
    }
    const ids = new Set(folders.map(f => f.id))
    return folders.filter(f => !f.parent_id || !ids.has(f.parent_id) || f.parent_id === 'root')
  }, [folders, baseFolderId])

  return (
    <div className="pb-32 analog-surface min-h-screen text-[var(--text-main)] relative">
      {/* Header */}
      <div className="sticky top-0 bg-[color:var(--bg-surface)]/90 backdrop-blur-md z-20 border-b border-[var(--border-strong)]">
        <div className="px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentView !== 'menu' && (
                <button onClick={() => setState({ currentView: 'menu' })} className="p-2 -ml-2 hover:bg-[var(--bg-container-high)] rounded-full">
                    <Icon.ArrowLeft />
                </button>
            )}
            <div className="flex flex-col justify-center">
                <h1 className="font-bold text-xl leading-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    {currentView === 'menu' ? 'Library' : 
                     currentView === 'foldermap' ? 'Browse Folders' : 
                     currentView === 'folder_detail' ? selectedFolder?.name :
                     currentView === 'playlists' ? 'Playlists' : 
                     currentView === 'bookmarks' ? 'Bookmarks' : 'All Songs'}
                </h1>
                <span className="text-xs text-[color:var(--text-muted)]/80">
                    {syncing ? `${syncProgress}곡 처리 중...` : 
                     currentView === 'tracks' ? `Total ${totalCount.toLocaleString()} songs` : 
                     currentView === 'playlists' ? `${playlists.length} playlists` : 
                     currentView === 'bookmarks' ? `${bookmarks.length} saved positions` : 'Music Library'}
                </span>
            </div>
          </div>
          
          <div className="flex gap-2">
             {(currentView === 'tracks' || currentView === 'playlists' || currentView === 'folder_detail') && (
                 <button onClick={() => {
                     if (currentView === 'tracks') handleShufflePlay(tracks);
                     if (currentView === 'playlists') handleShufflePlay(playlistTracks);
                     if (currentView === 'folder_detail') handleShufflePlay(folderTracks);
                 }} className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container-high)]" title="Shuffle Play">
                    <Icon.Shuffle size={20} />
                 </button>
             )}
             {currentView === 'tracks' && (
                 <button onClick={handleAnalyze} disabled={analyzing} className="p-2 rounded-full text-[var(--tertiary)] hover:bg-[var(--bg-container-high)]" title="Analyze">
                    {analyzing ? <Icon.Loader2 className="animate-spin" size={20} /> : <Icon.FileMusic size={20} />}
                 </button>
             )}
             <button onClick={handleSync} disabled={syncing} className={`p-2 rounded-full ${syncing ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} title="Sync">
               {syncing ? <Icon.Loader2 className="animate-spin" /> : <Icon.RefreshCw />}
             </button>
          </div>
        </div>
        
        {/* 🟢 [정렬 UI 강화] Sort Options */}
        {currentView === 'tracks' && (
             <div className="p-4 pb-2 space-y-2">
                {/* 검색창 */}
                <div className={`bg-[var(--bg-container)] rounded-xl flex items-center px-4 py-2.5 gap-3 border transition-colors ${isAiMode ? 'border-[var(--tertiary)]/50 bg-[var(--tertiary)]/10' : 'border-[var(--border-strong)]'}`}>
                  <button onClick={() => { setState({ isAiMode: !isAiMode, searchQuery: '' }) }} className={`p-1.5 rounded-lg transition ${isAiMode ? 'bg-[var(--tertiary)] text-white' : 'text-[color:var(--text-muted)]/80 hover:bg-[var(--bg-container-high)]'}`}>
                    <Icon.Sparkles size={18} fill={isAiMode ? "currentColor" : "none"} />
                  </button>
                  <input type="text" placeholder={isAiMode ? "Ask AI..." : "Search..."} value={searchQuery} onChange={(e) => setState({ searchQuery: e.target.value })} className="bg-transparent border-none outline-none flex-1 text-[var(--text-main)] text-sm" />
                  {searchQuery && <button onClick={() => setState({ searchQuery: '' })}>✕</button>}
                </div>

                {/* 정렬 버튼들 */}
                {!isAiMode && (
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                            {/* 날짜 정렬 버튼 추가됨 */}
                            <button onClick={() => setState({ sortBy: 'date' })} 
                                className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition ${sortBy === 'date' ? 'bg-[var(--text-main)] text-[var(--bg-surface)] border-[var(--text-main)] font-bold' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}>
                                <Icon.Calendar size={12}/> Recent
                            </button>
                            {['name', 'artist', 'album'].map(opt => (
                                <button key={opt} onClick={() => setState({ sortBy: opt as any })} 
                                    className={`px-3 py-1 text-xs rounded-full border transition ${sortBy === opt ? 'bg-[var(--text-main)] text-[var(--bg-surface)] border-[var(--text-main)] font-bold' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}>
                                    {opt === 'name' ? 'Title' : opt === 'artist' ? 'Artist' : 'Album'}
                                </button>
                            ))}
                        </div>
                        
                        {/* 🟢 오름/내림차순 토글 버튼 */}
                        <button onClick={() => setState({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })} 
                                className="p-1.5 bg-[var(--bg-container-high)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] ml-2">
                            {sortOrder === 'asc' ? <Icon.ArrowUpNarrowWide size={16}/> : <Icon.ArrowDownWideNarrow size={16}/>}
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="px-2 mt-2">
        {/* A. Menu */}
        {currentView === 'menu' && (
            <div className="space-y-2 p-2">
                <div onClick={() => { setState({ currentView: 'tracks' }); loadTracks(0, ''); }} className="flex items-center gap-4 p-4 bg-[color:var(--bg-container)]/50 rounded-xl cursor-pointer hover:bg-[var(--bg-container-high)] transition"><div className="w-10 h-10 bg-[var(--tertiary)]/20 rounded-lg flex items-center justify-center text-[var(--tertiary)]"><Icon.Music size={24} /></div><div className="flex-1"><p className="font-bold text-lg">All Songs</p><p className="text-sm text-[color:var(--text-muted)]/80">{totalCount.toLocaleString()} tracks</p></div><Icon.ChevronRight className="text-[color:var(--text-muted)]/60" /></div>
                <div onClick={() => setState({ currentView: 'playlists' })} className="flex items-center gap-4 p-4 bg-[color:var(--bg-container)]/50 rounded-xl cursor-pointer hover:bg-[var(--bg-container-high)] transition"><div className="w-10 h-10 bg-[var(--tertiary)]/20 rounded-lg flex items-center justify-center text-[var(--tertiary)]"><Icon.ListMusic size={24} /></div><div className="flex-1"><p className="font-bold text-lg">Playlists</p><p className="text-sm text-[color:var(--text-muted)]/80">{playlists.length} lists</p></div><Icon.ChevronRight className="text-[color:var(--text-muted)]/60" /></div>
                <div onClick={() => { setState({ currentView: 'foldermap' }); loadFolderMap(); }} className="flex items-center gap-4 p-4 bg-[color:var(--bg-container)]/50 rounded-xl cursor-pointer hover:bg-[var(--bg-container-high)] transition"><div className="w-10 h-10 bg-[var(--tertiary)]/20 rounded-lg flex items-center justify-center text-[var(--tertiary)]"><Icon.Map size={24} /></div><div className="flex-1"><p className="font-bold text-lg">Browse Folders</p><p className="text-sm text-[color:var(--text-muted)]/80">Explore by directory</p></div><Icon.ChevronRight className="text-[color:var(--text-muted)]/60" /></div>
                <div onClick={async () => { setState({ currentView: 'bookmarks', loading: true }); const { getBookmarks } = await import('@/app/actions/bookmarks'); const bms = await getBookmarks(); setState({ bookmarks: bms, loading: false }); }} className="flex items-center gap-4 p-4 bg-[color:var(--bg-container)]/50 rounded-xl cursor-pointer hover:bg-[var(--bg-container-high)] transition"><div className="w-10 h-10 bg-[var(--tertiary)]/20 rounded-lg flex items-center justify-center text-[var(--tertiary)]"><Icon.Bookmark size={24} /></div><div className="flex-1"><p className="font-bold text-lg">Bookmarks</p><p className="text-sm text-[color:var(--text-muted)]/80">Saved audio positions</p></div><Icon.ChevronRight className="text-[color:var(--text-muted)]/60" /></div>
            </div>
        )}

        {/* B. Tracks */}
        {currentView === 'tracks' && (
            <div className="pb-10 relative min-h-[200px]">
                {/* [NEW] 로딩 인디케이터 오버레이 */}
                {loading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[color:var(--bg-surface)]/60 backdrop-blur-sm rounded-xl transition-opacity duration-300">
                        <Icon.Loader2 className="animate-spin text-[var(--tertiary)] mb-3" size={40} />
                        <span className="text-[var(--text-main)] font-medium animate-pulse">
                            {isAiMode ? "AI가 보석 같은 곡을 찾는 중..." : "Loading..."}
                        </span>
                    </div>
                )}

                {!loading && tracks.length === 0 && (
                    <div className="text-center py-20 text-[color:var(--text-muted)]/80">
                        <p>표시할 곡이 없습니다.</p>
                    </div>
                )}

                {tracks.map((track, i) => (
                    <TrackItem 
                        key={track.id}
                        track={track}
                        index={i}
                        isActive={currentTrack?.id === track.id}
                        isPlaying={isPlaying}
                        variant="mobile"
                        onPlay={(t) => { setPlaylist(tracks); setTrack(t); }}
                        onAddPlaylist={(t, e) => { e.stopPropagation(); setTrackToAdd(t); setShowAddToPlaylistModal(true); }}
                    />
                ))}
                {hasMore && !loading && <button onClick={() => loadTracks(page + 1, searchQuery)} className="w-full py-4 text-[var(--tertiary)] font-bold mt-2">Load More</button>}
            </div>
        )}

        {/* C. Playlists & D. Details (생략 없이 유지) */}
        {currentView === 'playlists' && !selectedPlaylist && (
            <div className="p-2">
                <button onClick={() => { const n = prompt('New Playlist Name:'); if(n) createPlaylist(n).then(() => loadPlaylists()); }} className="w-full py-3 mb-4 bg-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500"><Icon.Plus size={20} /> New Playlist</button>
                {playlists.map(pl => (
                    <div key={pl.id} onClick={async () => { setState({ selectedPlaylist: pl }); setState({ playlistTracks: await getPlaylistTracks(pl.id) }); }} className="flex items-center gap-4 p-4 bg-[color:var(--bg-container)]/50 mb-2 rounded-xl cursor-pointer hover:bg-[var(--bg-container-high)]">
                        <Icon.ListMusic size={24} className="text-[var(--tertiary)]" /><span className="font-bold flex-1 text-lg">{pl.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) deletePlaylist(pl.id).then(loadPlaylists); }} className="p-2"><Icon.Trash2 className="text-[color:var(--text-muted)]/60 hover:text-red-500" size={20}/></button>
                    </div>
                ))}
            </div>
        )}
        {currentView === 'playlists' && selectedPlaylist && (
            <div>
                <div className="flex items-center gap-2 p-2 mb-4"><button onClick={() => setState({ selectedPlaylist: null })} className="p-2 bg-[var(--bg-container-high)] rounded-full"><Icon.ArrowLeft/></button><h2 className="text-xl font-bold">{selectedPlaylist.name}</h2></div>
                {playlistTracks.map(track => (
                    <div key={track.id} onClick={() => { setPlaylist(playlistTracks); setTrack(track); }} className="flex items-center gap-3 p-3 hover:bg-[var(--bg-container-highest)] rounded-xl cursor-pointer group">
                         <div className="w-10 h-10 bg-[var(--bg-container-high)] rounded flex items-center justify-center">{track.cover_art ? <img src={track.cover_art} className="w-full h-full object-cover"/> : <Icon.Music size={18} className="text-[color:var(--text-muted)]/80"/>}</div>
                        <div className="flex-1 min-w-0"><p className="truncate font-medium">{track.name}</p></div>
                        <button onClick={(e) => handleRemoveTrackFromPlaylist(e, track.id)} className="p-2 text-[color:var(--text-muted)]/60 hover:text-red-500 hover:bg-[var(--bg-container-highest)] rounded-full"><Icon.X size={18} /></button>
                    </div>
                ))}
            </div>
        )}

        {currentView === 'bookmarks' && (
            <div className="pb-10 relative">
                {loading ? (
                    <div className="text-center py-20 text-[color:var(--text-muted)]/80 animate-pulse"><Icon.Loader2 className="animate-spin mb-2 mx-auto" /></div>
                ) : bookmarks.length === 0 ? (
                    <div className="text-center py-20 text-[color:var(--text-muted)]/80"><p>북마크된 구간이 없습니다.</p></div>
                ) : (
                    <div>
                    {bookmarks.map(b => {
                        const track = { ...b.track, initialPosition: b.position };
                        return (
                        <div key={b.bookmark_id} onClick={() => { setPlaylist(bookmarks.map(x=>({...x.track, initialPosition: x.position}))); setTrack(track); }} className="flex items-center gap-3 p-3 hover:bg-[var(--bg-container-highest)] rounded-xl cursor-pointer group">
                            <div className="w-12 h-12 bg-[var(--bg-container-high)] rounded-lg flex items-center justify-center relative overflow-hidden">
                               {track.cover_art || track.thumbnail_link ? <img src={track.cover_art || track.thumbnail_link} className="w-full h-full object-cover"/> : <Icon.Music size={20} className="text-[color:var(--text-muted)]/80"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                 <p className="truncate font-medium flex items-center gap-2">
                                     {track.title || track.name?.replace(/\.(mp3|wav|flac|m4a)$/i, '') || track.file_name?.replace(/\.[^.]+$/, '')}
                                     <span className="text-xs bg-[var(--tertiary)]/20 text-[var(--tertiary)] px-1.5 py-0.5 rounded-full">{Math.floor(b.position / 60)}:{String(Math.floor(b.position % 60)).padStart(2, '0')}</span>
                                 </p>
                                 <p className="text-sm text-[var(--text-muted)] truncate">{b.bookmark_title || track.artist || 'Unknown'}</p>
                            </div>
                        </div>
                    )})}
                    </div>
                )}
            </div>
        )}

        {/* 🟢 E. Folder Map (다중 선택 및 트리 시각화 적용) */}
        {currentView === 'foldermap' && (
            <div className="p-2">
                <div className="bg-[color:var(--bg-container)]/30 rounded-xl p-4 min-h-[70vh] border border-[var(--border-strong)] relative">
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--border-strong)] pb-3">
                        <div className="flex items-center gap-2 text-[color:var(--text-main)]/80"><Icon.Map size={20} className="text-[var(--success)]" /><span className="font-bold">Folder Map</span></div>
                        
                        {/* 다중 삭제 버튼 */}
                        {selectedFolderIds.length > 0 && (
                            <button onClick={handleBatchDeleteFolders} className="text-xs bg-[var(--danger)] hover:opacity-80 text-[var(--text-main)] px-3 py-1 rounded-full font-bold animate-in fade-in slide-in-from-right-5">
                                {selectedFolderIds.length}개 삭제
                            </button>
                        )}
                    </div>
                    
                    {loading ? (
                        <div className="text-center py-20 text-[color:var(--text-muted)]/80 animate-pulse"><Icon.Loader2 className="animate-spin mb-2 mx-auto" /><span>구조 파악 중...</span></div>
                    ) : folders.length === 0 ? (
                        <div className="text-center py-20 text-[color:var(--text-muted)]/80"><p>스캔된 폴더가 없습니다.</p></div>
                    ) : (
                        <div className="space-y-0.5 overflow-x-auto pb-10">
                            {rootFolders.map(node => (
                                <FolderTreeItem 
                                    key={node.id} 
                                    node={node} 
                                    level={0} 
                                    allFolders={folders} 
                                    selectedIds={selectedFolderIds}
                                    onSelect={handleSelectFolder} 
                                    onToggleSelect={toggleFolderSelection} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* F. Folder Detail (기존 유지) */}
        {currentView === 'folder_detail' && selectedFolder && (
            <div className="pb-10">
                <div className="flex items-center gap-2 p-2 mb-2">
                    <button onClick={() => setState({ currentView: 'foldermap' })} className="p-2 bg-[var(--bg-container-high)] rounded-full hover:bg-[var(--bg-container-highest)]"><Icon.ArrowLeft/></button>
                    <div className="flex-1 overflow-hidden"><h2 className="text-xl font-bold truncate">{selectedFolder.name}</h2></div>
                </div>
                {folderTracks.map((track, i) => (
                    <TrackItem 
                        key={track.id}
                        track={track}
                        index={i}
                        isActive={currentTrack?.id === track.id}
                        isPlaying={isPlaying}
                        variant="mobile"
                        onPlay={(t) => { setPlaylist(folderTracks); setTrack(t); }}
                        onAddPlaylist={(t, e) => { e.stopPropagation(); setTrackToAdd(t); setShowAddToPlaylistModal(true); }}
                    />
                ))}
            </div>
        )}
      </div>

      {showAddToPlaylistModal && (
        <div className="fixed inset-0 bg-[color:var(--bg-surface)]/80 z-50 flex items-center justify-center p-4" onClick={() => setShowAddToPlaylistModal(false)}>
           <div className="bg-[var(--bg-container)] w-full max-w-sm rounded-2xl p-4 border border-[var(--border-strong)]" onClick={e=>e.stopPropagation()}>
               <h3 className="font-bold text-center mb-4 text-lg">Add to Playlist</h3>
               <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                   {playlists.map(pl => (
                       <button key={pl.id} onClick={async () => { await addTrackToPlaylist(pl.id, trackToAdd.id); setShowAddToPlaylistModal(false); alert('Added!'); }} className="w-full p-4 text-left bg-[var(--bg-container-high)] hover:bg-blue-600 rounded-xl flex items-center gap-3 transition"><Icon.ListMusic size={20}/> <span className="font-medium">{pl.name}</span></button>
                   ))}
               </div>
               <button onClick={() => setShowAddToPlaylistModal(false)} className="w-full py-3 mt-4 text-[var(--text-muted)]">Cancel</button>
           </div>
        </div>
      )}
    </div>
  )
}