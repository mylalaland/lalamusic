'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  LogOut, User, FolderSearch, Check, ChevronRight, Folder, MapPin, Target, FileAudio, 
  Trash2, RefreshCw, Database, ListMusic, Save, XCircle, CheckSquare, Square, 
  Settings, Mic2, Radio, ArrowUp, ArrowDown, Disc3, Zap
} from 'lucide-react'
import { 
  getScanSettings, saveScanSettings, saveBaseSettings, resetScanSettings, 
  saveExtensionSettings, resetMusicLibrary, resetPlaylists 
} from '@/app/actions/settings'
import { getDriveFolders, getSharedFolders } from '@/app/actions/library'
import { useSettingsStore, type AIProvider, AI_MODELS } from '@/lib/store/useSettingsStore'
import { Wand2, Key, Palette } from 'lucide-react'

const AUDIO_FORMATS = ['mp3', 'flac', 'aac', 'm4a', 'wav', 'ogg']

export default function SettingsPage() {
  const router = useRouter()
  
  // Tab state (desktop-style tabs)
  const [activeTab, setActiveTab] = useState('general')
  
  // 설정 상태
  const [baseFolder, setBaseFolder] = useState<{id: string, name: string} | null>(null)
  const [scanFolder, setScanFolder] = useState<{id: string, name: string} | null>(null)
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>(['mp3', 'flac', 'aac', 'm4a'])

  // 모달 상태
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'BASE' | 'TARGET'>('TARGET')
  
  const [currentPickerFolder, setCurrentPickerFolder] = useState({ id: 'root', name: 'Google Drive' })
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([])
  const [pickerFolders, setPickerFolders] = useState<any[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  // 가사 설정 상태
  const [lyricsSettings, setLyricsSettings] = useState({
    autoSearch: true,
    order: ['synced', 'alsong', 'lrclib', 'unsynced'] 
  })
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // AI 상태
  const { 
    aiProvider, aiApiKeys, aiModels, setAiProvider, setAiApiKey, setAiModel,
    autoPlayNext, highQualityAudio, themeColor, showLyrics,
    setAutoPlayNext, setHighQualityAudio, setThemeColor, setShowLyrics
  } = useSettingsStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [fetchedModels, setFetchedModels] = useState<{id: string, label: string}[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    setApiKeyInput(aiApiKeys[aiProvider] || '')
  }, [aiProvider, aiApiKeys])

  useEffect(() => {
    loadSettings()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    
    // UI 상태 복원
    const savedPicker = sessionStorage.getItem('settings_picker_mode')
    if (savedPicker) {
        const { show, mode, folder, history } = JSON.parse(savedPicker)
        if (show) { setShowFolderPicker(true); setPickerMode(mode); setCurrentPickerFolder(folder); setFolderHistory(history); }
    }

    // 가사 설정 로드
    const savedLyrics = localStorage.getItem('lala_lyrics_settings')
    if (savedLyrics) {
        try {
            const parsed = JSON.parse(savedLyrics)
            setLyricsSettings(prev => ({
                ...prev,
                ...parsed,
                order: Array.isArray(parsed.order) ? parsed.order : ['synced', 'alsong', 'lrclib', 'unsynced']
            }))
        } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (showFolderPicker) {
      loadPickerFolders(currentPickerFolder.id)
    }
    sessionStorage.setItem('settings_picker_mode', JSON.stringify({
        show: showFolderPicker, mode: pickerMode,
        folder: currentPickerFolder, history: folderHistory
    }))
  }, [showFolderPicker, currentPickerFolder])

  const loadSettings = async () => {
    try {
      const settings = await getScanSettings()
      if (settings) {
        if (settings.base_folder_id) setBaseFolder({ id: settings.base_folder_id, name: settings.base_folder_name })
        if (settings.scan_folder_id) setScanFolder({ id: settings.scan_folder_id, name: settings.scan_folder_name })
        if (settings.allowed_extensions && Array.isArray(settings.allowed_extensions)) setAllowedExtensions(settings.allowed_extensions)
      }
    } catch (e) { console.error("Failed to load settings", e) }
  }

  const loadPickerFolders = async (folderId: string) => {
    setPickerLoading(true)
    try {
      if (folderId === 'shared-root') {
          const folders = await getSharedFolders()
          setPickerFolders(folders || [])
      } else {
          const folders = await getDriveFolders(folderId)
          setPickerFolders(folders || [])
      }
    } catch (e) { console.error(e); setPickerFolders([]) }
    finally { setPickerLoading(false) }
  }

  const openPicker = (mode: 'BASE' | 'TARGET') => {
    setPickerMode(mode)
    setFolderHistory([])
    if (mode === 'BASE') {
        setCurrentPickerFolder({ id: 'root', name: '내 드라이브' })
    } else {
        setCurrentPickerFolder(baseFolder || { id: 'root', name: 'Google Drive' })
    }
    setShowFolderPicker(true)
  }

  const handleConfirmSelect = async (targetFolder?: {id: string, name: string}) => {
    const folder = targetFolder || currentPickerFolder
    if (pickerMode === 'BASE') {
        const res = await saveBaseSettings(folder.id, folder.name)
        if (res.success) { setBaseFolder(folder); setScanFolder(null); showToast(`Music Root → "${folder.name}"`) }
        else { alert("저장 실패: " + (res.error || "알 수 없는 오류")) }
    } else {
        const res = await saveScanSettings(folder.id, folder.name)
        if (res.success) { setScanFolder(folder); showToast(`Scan Target → "${folder.name}"`) }
        else { alert("저장 실패: " + (res.error || "알 수 없는 오류")) }
    }
    setShowFolderPicker(false)
  }

  const handleNavigate = (folder: {id: string, name: string}) => {
    setFolderHistory(prev => [...prev, currentPickerFolder])
    setCurrentPickerFolder(folder)
  }

  const handleGoBack = () => {
    if (folderHistory.length === 0) return
    const prev = folderHistory[folderHistory.length - 1]
    setFolderHistory(prev => prev.slice(0, -1))
    setCurrentPickerFolder(prev)
  }

  const canGoUp = () => {
      if (folderHistory.length === 0) return false
      if (pickerMode === 'BASE') return currentPickerFolder.id !== 'root' && currentPickerFolder.id !== 'shared-root'
      if (baseFolder && currentPickerFolder.id === baseFolder.id) return false
      return true
  }

  const handleResetFolder = async () => {
    if (!confirm("스캔 설정을 초기화하시겠습니까?")) return
    await resetScanSettings()
    setBaseFolder(null); setScanFolder(null)
    showToast("초기화 완료")
  }

  const handleResetLibrary = async () => {
    if (confirm('정말 모든 곡과 폴더 정보를 초기화하시겠습니까?\n(Google Drive 파일은 삭제되지 않습니다.)')) {
      const res = await resetMusicLibrary()
      if (res.success) { showToast('라이브러리 초기화 완료'); window.location.reload() }
      else { alert('초기화 실패') }
    }
  }

  const handleResetPlaylists = async () => {
    if (confirm('정말 모든 플레이리스트를 삭제하시겠습니까?')) {
      const res = await resetPlaylists()
      if (res.success) { showToast('플레이리스트 삭제 완료'); window.location.reload() }
      else { alert('삭제 실패') }
    }
  }

  const toggleExtension = (ext: string) => {
    setAllowedExtensions(prev => prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext])
  }

  const handleSaveExtensions = async () => {
    const res = await saveExtensionSettings(allowedExtensions)
    if (res.success) showToast('파일 형식 저장 완료')
    else alert('저장 실패')
  }

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/'); router.refresh()
  }

  const handleSaveLyricsSettings = (newSettings: typeof lyricsSettings) => {
    setLyricsSettings(newSettings)
    localStorage.setItem('lala_lyrics_settings', JSON.stringify(newSettings))
    showToast("가사 설정 저장 완료")
  }

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...lyricsSettings.order]
    if (direction === 'up' && index > 0) [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]
    else if (direction === 'down' && index < newOrder.length - 1) [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    handleSaveLyricsSettings({ ...lyricsSettings, order: newOrder })
  }

  const getLabel = (id: string) => {
    if (id === 'synced') return { text: '내장 가사 (시간 정보 포함)', icon: '⏱️' }
    if (id === 'unsynced') return { text: '내장 가사 (텍스트만)', icon: '📄' }
    if (id === 'alsong') return { text: '외부 가사 (알송 - 가요)', icon: '🇰🇷' }
    if (id === 'lrclib') return { text: '외부 가사 (LRCLIB - 팝송)', icon: '🌍' }
    return { text: id, icon: '?' }
  }

  const showToast = (msg: string) => { setSaveMessage(msg); setTimeout(() => setSaveMessage(null), 2000) }

  // --- Tab definitions (desktop-style) ---
  const tabs = [
    { id: 'general', label: 'GENERAL', icon: Settings },
    { id: 'library', label: 'LIBRARY', icon: Database },
    { id: 'ai', label: 'AI', icon: Wand2 },
    { id: 'appearance', label: 'THEME', icon: Palette },
    { id: 'account', label: 'ACCOUNT', icon: User },
  ]

  return (
    <div className="min-h-screen analog-surface text-[var(--text-main)]">
      {/* Header — desktop-style SETTINGS title */}
      <div className="sticky top-0 bg-[color:var(--bg-surface)]/90 backdrop-blur-md z-20 border-b border-[var(--border-strong)]">
        <div className="px-4 pt-4 pb-1">
          <h1 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight">SETTINGS</h1>
          <p className="font-['Work_Sans'] text-[8px] text-[var(--text-muted)] tracking-[0.3em] mb-3">SYSTEM_CONFIG</p>
        </div>
        
        {/* Tab bar — horizontal scrollable (desktop-style tabs adapted for mobile) */}
        <div className="flex overflow-x-auto scrollbar-hide px-2 pb-0 gap-0">
          {tabs.map(tab => {
            const TabIcon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-['Work_Sans'] text-[10px] tracking-wider whitespace-nowrap transition-all border-b-2 ${
                  isActive 
                    ? 'text-[var(--tertiary)] border-[var(--tertiary)] font-bold' 
                    : 'text-[var(--text-muted)] border-transparent'
                }`}>
                <TabIcon size={12} className={isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)]'} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 max-w-lg mx-auto space-y-4 pb-40">

        {/* === GENERAL TAB === */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Audio Player Preferences */}
            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <Disc3 size={14} /> AUDIO_PLAYER
              </h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">Auto-Play Next</div>
                    <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">자동으로 다음 곡을 재생합니다</div>
                  </div>
                  <input type="checkbox" checked={autoPlayNext} onChange={(e) => setAutoPlayNext(e.target.checked)}
                    className="w-4 h-4 accent-[var(--tertiary)]" />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">High Quality Audio</div>
                    <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">최고 품질 스트림 우선</div>
                  </div>
                  <input type="checkbox" checked={highQualityAudio} onChange={(e) => setHighQualityAudio(e.target.checked)}
                    className="w-4 h-4 accent-[var(--tertiary)]" />
                </label>
              </div>
            </div>

            {/* Music Root / Scan Target */}
            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <MapPin size={14} /> DRIVE_CONFIG
              </h3>
              
              {/* Music Root */}
              <div className="mb-4">
                <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] mb-1">Music Root</div>
                <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mb-2">플레이어의 최상위 폴더</div>
                <div className="flex items-center justify-between p-3 border border-[var(--border-strong)] rounded-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Folder size={14} className="text-yellow-500 shrink-0" />
                    <span className="truncate text-sm text-[var(--text-main)]">{baseFolder ? baseFolder.name : 'Google Drive (전체)'}</span>
                  </div>
                  <button onClick={() => openPicker('BASE')} className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold tracking-wider hover:underline shrink-0">CHANGE</button>
                </div>
              </div>
              
              {/* Scan Target */}
              <div className="mb-4">
                <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] mb-1">Scan Target</div>
                <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mb-2">실제 라이브러리에 담을 폴더</div>
                <div className="flex items-center justify-between p-3 border border-[var(--border-strong)] rounded-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FolderSearch size={14} className="text-[var(--tertiary)] shrink-0" />
                    <span className="truncate text-sm text-[var(--text-main)]">{scanFolder ? scanFolder.name : (baseFolder ? `${baseFolder.name} (전체)` : '전체')}</span>
                  </div>
                  {scanFolder && <button onClick={() => setScanFolder(null)} className="font-['Work_Sans'] text-[10px] text-red-500 font-bold tracking-wider shrink-0">CLEAR</button>}
                </div>
                <button onClick={() => openPicker('TARGET')} 
                  className="mt-2 w-full py-2.5 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--on-primary)] transition"
                  style={{ background: 'var(--primary)' }}>
                  SELECT_TARGET
                </button>
              </div>

              {/* File Types */}
              <div>
                <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] mb-1">File Types</div>
                <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mb-2">스캔 대상 파일 형식</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {AUDIO_FORMATS.map(ext => (
                    <button key={ext} onClick={() => toggleExtension(ext)}
                      className={`flex items-center justify-center gap-1.5 py-2 font-['Work_Sans'] text-xs tracking-wider transition border ${
                        allowedExtensions.includes(ext) 
                          ? 'text-[var(--tertiary)] border-[var(--tertiary)] font-bold bg-[color:var(--tertiary)]/5' 
                          : 'text-[var(--text-muted)] border-[var(--border-strong)]'
                      }`}>
                      {allowedExtensions.includes(ext) ? <CheckSquare size={12} /> : <Square size={12} />}
                      {ext.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button onClick={handleSaveExtensions}
                  className="w-full py-2 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--text-muted)] border border-[var(--border-strong)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition">
                  SAVE_FORMATS
                </button>
              </div>
            </div>

            {/* Lyrics Settings */}
            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <Mic2 size={14} /> LYRICS_CONFIG
              </h3>
              
              <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] mb-2">Priority Order</div>
              <div className="space-y-1.5 mb-4">
                {(lyricsSettings.order || []).map((id, index) => {
                  const info = getLabel(id)
                  return (
                    <div key={id} className="flex items-center justify-between p-2.5 border border-[color:var(--border-strong)]/50">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">{info.icon}</span>
                        <span className="font-['Work_Sans'] text-xs text-[var(--text-main)]">{info.text}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => moveOrder(index, 'up')} disabled={index === 0} className="p-1 text-[var(--text-muted)] disabled:opacity-30"><ArrowUp size={12}/></button>
                        <button onClick={() => moveOrder(index, 'down')} disabled={index === lyricsSettings.order.length - 1} className="p-1 text-[var(--text-muted)] disabled:opacity-30"><ArrowDown size={12}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Auto-search lyrics</span>
                <input type="checkbox" checked={lyricsSettings.autoSearch} 
                  onChange={(e) => handleSaveLyricsSettings({...lyricsSettings, autoSearch: e.target.checked})}
                  className="w-4 h-4 accent-[var(--tertiary)]" />
              </label>
            </div>
          </div>
        )}

        {/* === LIBRARY TAB === */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <Zap size={14} /> DATA_MANAGEMENT
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Reset Library</div>
                    <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">모든 곡/폴더 메타데이터 삭제</div>
                  </div>
                  <button onClick={handleResetLibrary}
                    className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-red-500/30 text-red-500 hover:bg-red-500/10 transition tracking-wider">
                    RESET
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Reset Playlists</div>
                    <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">모든 플레이리스트 삭제</div>
                  </div>
                  <button onClick={handleResetPlaylists}
                    className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-red-500/30 text-red-500 hover:bg-red-500/10 transition tracking-wider">
                    RESET
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Reset Scan Settings</div>
                    <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">전체 드라이브 모드 복귀</div>
                  </div>
                  <button onClick={handleResetFolder}
                    className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition tracking-wider">
                    RESET
                  </button>
                </div>
              </div>
              <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mt-4 leading-relaxed">
                ※ 실제 Google Drive 파일은 삭제되지 않습니다. DB 메타데이터만 초기화됩니다.
              </p>
            </div>
          </div>
        )}

        {/* === AI TAB === */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <Wand2 size={14} /> AI_CONFIGURATION
              </h3>
              
              {/* Provider Selection */}
              <div className="mb-4">
                <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">SELECT_PROVIDER</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['gemini', 'openai', 'claude'] as AIProvider[]).map(provider => (
                    <button key={provider} onClick={() => setAiProvider(provider)}
                      className={`py-2.5 px-3 font-['Work_Sans'] text-xs tracking-wider font-bold transition capitalize border ${
                        aiProvider === provider
                          ? 'text-[var(--on-primary)] border-[var(--tertiary)]'
                          : 'text-[var(--text-muted)] border-[var(--border-strong)] hover:text-[var(--text-main)]'
                      }`}
                      style={aiProvider === provider ? { background: 'var(--primary)', borderColor: 'var(--tertiary)' } : {}}>
                      {provider}
                    </button>
                  ))}
                </div>
              </div>

              {/* [NEW] Model Selection — 동적 조회 */}
              <div className="mb-4">
                <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">SELECT_MODEL</label>
                
                {/* 현재 선택된 모델 표시 */}
                <div className="flex gap-2 mb-2">
                  <select 
                    value={aiModels[aiProvider]} 
                    onChange={(e) => setAiModel(aiProvider, e.target.value)}
                    className="flex-1 py-2.5 px-3 font-['Work_Sans'] text-sm text-[var(--text-main)] outline-none border border-[var(--border-strong)] focus:border-[var(--tertiary)] transition"
                    style={{ background: 'var(--bg-container-highest)' }}>
                    {/* 동적 조회된 모델이 있으면 그걸 사용, 없으면 기본 목록 */}
                    {(fetchedModels.length > 0 ? fetchedModels : AI_MODELS[aiProvider] || []).map(m => (
                      <option key={m.id} value={m.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">{m.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={async () => {
                      const key = apiKeyInput || aiApiKeys[aiProvider]
                      if (!key) { showToast('API Key를 먼저 입력하세요'); return }
                      setIsFetchingModels(true)
                      try {
                        const { fetchAvailableModels } = await import('@/app/actions/ai')
                        const models = await fetchAvailableModels(key, aiProvider)
                        if (models.length > 0) {
                          setFetchedModels(models)
                          showToast(`${models.length}개 모델 발견!`)
                        } else {
                          showToast('사용 가능한 모델이 없습니다')
                        }
                      } catch (e: any) {
                        showToast(`모델 조회 실패: ${e?.message || '오류'}`)
                      } finally {
                        setIsFetchingModels(false)
                      }
                    }}
                    disabled={isFetchingModels}
                    className="px-3 py-2.5 font-['Work_Sans'] text-[10px] tracking-wider font-bold text-[var(--tertiary)] border border-[var(--tertiary)]/30 hover:bg-[var(--tertiary)]/10 transition whitespace-nowrap disabled:opacity-50">
                    {isFetchingModels ? '조회중...' : '🔍 FETCH'}
                  </button>
                </div>
                {fetchedModels.length > 0 && (
                  <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">
                    ✨ API에서 {fetchedModels.length}개 모델 조회됨. 최신 모델이 상단에 표시됩니다.
                  </p>
                )}
              </div>

              {/* API Key Input */}
              <div>
                <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">API_KEY</label>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={`Enter ${aiProvider} API key...`}
                      className="w-full py-2.5 pl-9 pr-4 font-['Work_Sans'] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none border border-[var(--border-strong)] focus:border-[var(--tertiary)] transition"
                      style={{ background: 'var(--bg-container-highest)' }} />
                  </div>
                  <button onClick={() => { setAiApiKey(aiProvider, apiKeyInput); showToast('SAVED ✓') }}
                    className="px-4 py-2.5 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--on-primary)]"
                    style={{ background: 'var(--primary)' }}>
                    SAVE
                  </button>
                </div>

                {/* [NEW] TEST 버튼 */}
                <button 
                  onClick={async () => {
                    const key = apiKeyInput || aiApiKeys[aiProvider]
                    if (!key) { showToast('API Key를 먼저 입력하세요'); return }
                    showToast('테스트 중...')
                    try {
                      const { testAIConnection } = await import('@/app/actions/ai')
                      const result = await testAIConnection(key, aiProvider, aiModels[aiProvider])
                      showToast(result.success ? `✅ ${result.message}` : `❌ ${result.message}`)
                    } catch (e: any) {
                      showToast(`❌ ${e?.message || '테스트 실패'}`)
                    }
                  }}
                  className="w-full py-2.5 mb-3 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--tertiary)] border border-[var(--tertiary)]/30 hover:bg-[var(--tertiary)]/10 transition flex items-center justify-center gap-2">
                  <Zap size={14} /> TEST_CONNECTION
                </button>

                {/* Provider Guide */}
                <div className="p-3 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-highest)' }}>
                  <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
                    💡 HOW_TO_GET_API_KEY
                  </p>
                  {aiProvider === 'gemini' && (
                    <div className="space-y-1.5">
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]">
                        <span className="text-[var(--tertiary)] font-bold mr-1">01</span> 
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--tertiary)] underline">Google AI Studio</a> 접속
                      </p>
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">02</span> "Create API Key" 클릭</p>
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">03</span> 키 복사 → 위에 붙여넣기</p>
                      <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mt-2">✨ Gemini는 무료 사용량이 넉넉합니다</p>
                    </div>
                  )}
                  {aiProvider === 'openai' && (
                    <div className="space-y-1.5">
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">01</span> <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[var(--tertiary)] underline">OpenAI Platform</a> 접속</p>
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">02</span> "+ Create new secret key" 클릭</p>
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">03</span> sk- 키 복사 → 위에 붙여넣기</p>
                      <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mt-2">⚡ 월 $5 이내로 충분합니다</p>
                    </div>
                  )}
                  {aiProvider === 'claude' && (
                    <div className="space-y-1.5">
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">01</span> <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--tertiary)] underline">Anthropic Console</a> 접속</p>
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">02</span> "Create Key" 클릭</p>
                      <p className="font-['Noto_Serif'] text-[11px] text-[var(--text-muted)]"><span className="text-[var(--tertiary)] font-bold mr-1">03</span> sk-ant- 키 복사 → 위에 붙여넣기</p>
                      <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mt-2">⚡ 월 $5 이내로 충분합니다</p>
                    </div>
                  )}
                </div>
                <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mt-2 flex items-start gap-1.5">
                  🔒 API 키는 브라우저 로컬 저장소에만 보관됩니다. 서버에 저장되지 않습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === APPEARANCE TAB === */}
        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <Palette size={14} /> THEME
              </h3>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {['var(--tertiary)', 'var(--primary)', '#A68966', '#8D7B68', '#444444'].map(color => (
                  <button key={color} onClick={() => setThemeColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${themeColor === color ? 'border-[var(--text-main)] scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <h3 className="font-['Work_Sans'] text-xs text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <Settings size={14} /> UI_ELEMENTS
              </h3>
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">Show Lyrics</div>
                  <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">재생 화면에 가사를 표시합니다</div>
                </div>
                <input type="checkbox" checked={showLyrics} onChange={(e) => setShowLyrics(e.target.checked)}
                  className="w-4 h-4 accent-[var(--tertiary)]" />
              </label>
            </div>
          </div>
        )}

        {/* === ACCOUNT TAB === */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            <div className="p-6 border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center font-['Work_Sans'] font-bold text-xl text-[var(--on-primary)] uppercase"
                  style={{ background: 'var(--primary)' }}>
                  {user?.email?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-['Work_Sans'] text-sm font-bold text-[var(--text-main)]">{user?.email || 'Not logged in'}</h3>
                  <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.2em]">GOOGLE_DRIVE_LINKED</p>
                </div>
              </div>
              <button onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 font-['Work_Sans'] text-xs tracking-widest font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 transition">
                <LogOut size={14} /> SIGN_OUT
              </button>
            </div>

            {/* System Info */}
            <div className="p-6 flex flex-col items-center text-center border border-[var(--border-strong)]" style={{ background: 'var(--bg-container-high)' }}>
              <div className="w-16 h-16 flex items-center justify-center mb-4"
                style={{ background: 'var(--primary)', boxShadow: '0 0 40px var(--bg-container-high)' }}>
                <span className="font-['Work_Sans'] text-2xl font-bold text-[var(--on-primary)] italic">S</span>
              </div>
              <h3 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight">LALA</h3>
              <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] mt-1 mb-1">NEURAL_AUDIO v3.0</p>
              <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Mobile Edition</p>
            </div>
          </div>
        )}
      </div>

      {/* --- Folder Picker Modal --- */}
      {showFolderPicker && (
        <div className="fixed inset-0 bg-[color:var(--bg-surface)]/95 z-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="p-4 border-b border-[var(--border-strong)] flex items-center justify-between" style={{ background: 'var(--bg-container)' }}>
                <div>
                    <h3 className="font-['Work_Sans'] text-sm font-bold tracking-tight">{pickerMode === 'BASE' ? 'MUSIC_ROOT' : 'SCAN_TARGET'}</h3>
                    <p className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-wider">{pickerMode === 'BASE' ? '최상위 폴더 지정' : `"${baseFolder ? baseFolder.name : 'Root'}" 내부 선택`}</p>
                </div>
                <button onClick={() => setShowFolderPicker(false)} className="text-[var(--text-muted)] p-2 font-bold">✕</button>
            </div>
            
            <div className="p-3 border-b border-[var(--border-strong)] flex items-center gap-2" style={{ background: 'var(--bg-container-high)' }}>
                <Folder size={16} className={pickerMode === 'BASE' ? 'text-yellow-500' : 'text-[var(--tertiary)]'} />
                <span className="font-['Work_Sans'] text-sm font-bold truncate flex-1">{currentPickerFolder.name}</span>
                <button onClick={() => handleConfirmSelect()} 
                    className="px-3 py-1.5 font-['Work_Sans'] text-[10px] tracking-wider font-bold text-[var(--on-primary)] shrink-0"
                    style={{ background: 'var(--primary)' }}>
                    SELECT_HERE
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {pickerLoading ? (
                  <div className="text-center py-20 text-[var(--text-muted)]">
                    <RefreshCw className="animate-spin mx-auto mb-2" size={16} />
                    <span className="font-['Work_Sans'] text-xs tracking-widest">LOADING...</span>
                  </div>
                ) : (
                    <div className="space-y-0.5">
                        {canGoUp() && (
                            <button onClick={handleGoBack} className="w-full p-3 text-left hover:bg-[var(--bg-container-high)] flex items-center gap-3 text-[var(--text-muted)] transition">
                                <ChevronRight className="rotate-180" size={16} />
                                <span className="font-['Work_Sans'] text-xs tracking-wider">PARENT_DIR</span>
                            </button>
                        )}

                        {currentPickerFolder.id === 'root' && (
                            <button onClick={() => handleNavigate({ id: 'shared-root', name: '공유 문서함' })} 
                              className="w-full p-3 text-left hover:bg-[var(--bg-container-high)] flex items-center gap-3 transition border border-dashed border-[var(--border-strong)] mb-1">
                                <User size={16} className="text-[var(--tertiary)]" />
                                <span className="font-['Work_Sans'] text-sm">Shared with me</span>
                                <ChevronRight size={14} className="ml-auto text-[var(--text-muted)]" />
                            </button>
                        )}

                        {pickerFolders.map(folder => (
                            <div key={folder.id} className="flex items-center hover:bg-[var(--bg-container-high)] transition">
                                <button onClick={() => handleNavigate({ id: folder.id, name: folder.name })} className="flex-1 flex items-center gap-3 p-3 overflow-hidden text-left">
                                    <Folder size={16} className={pickerMode === 'BASE' ? 'text-yellow-500' : 'text-[var(--tertiary)]'} />
                                    <span className="font-['Work_Sans'] text-sm truncate">{folder.name}</span>
                                </button>
                                <div className="flex items-center gap-1 pr-2">
                                    <button onClick={() => handleConfirmSelect({ id: folder.id, name: folder.name })}
                                      className="px-2.5 py-1 font-['Work_Sans'] text-[10px] tracking-wider font-bold text-[var(--tertiary)] border border-[var(--tertiary)]/30 hover:bg-[var(--tertiary)]/10 transition">
                                      SELECT
                                    </button>
                                    <button onClick={() => handleNavigate({ id: folder.id, name: folder.name })} className="p-1.5 text-[var(--text-muted)]">
                                      <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Toast Notification */}
      {saveMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 border border-[var(--border-strong)] text-[var(--text-main)] px-5 py-2.5 text-sm font-['Work_Sans'] font-bold tracking-wider shadow-xl z-50 animate-in fade-in slide-in-from-bottom-4"
            style={{ background: 'var(--bg-container-highest)' }}>
              {saveMessage}
          </div>
      )}
    </div>
  )
}