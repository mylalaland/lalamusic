'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Settings as SettingsIcon, LogOut, Disc3,
  User, ChevronRight, Palette, Wand2, Key, Zap,
  MapPin, FolderSearch, Folder, FileAudio, CheckSquare, Square,
  Mic2, ArrowUp, ArrowDown, Database, Trash2, RefreshCw, ListMusic, Save, Search, CheckCircle2, XCircle
} from 'lucide-react'
import { useSettingsStore, type AIProvider, AI_MODELS } from '@/lib/store/useSettingsStore'
import {
  getScanSettings, saveScanSettings, saveBaseSettings, resetScanSettings,
  saveExtensionSettings, resetMusicLibrary, resetPlaylists
} from '@/app/actions/settings'
import { getDriveFolders, getSharedFolders } from '@/app/actions/library'

const AUDIO_FORMATS = ['mp3', 'flac', 'aac', 'm4a', 'wav', 'ogg']

export default function DesktopSettings() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('general')

  const { 
    aiProvider, aiApiKeys, aiModels, setAiProvider, setAiApiKey, setAiModel,
    autoPlayNext, highQualityAudio, themeColor, showLyrics,
    setAutoPlayNext, setHighQualityAudio, setThemeColor, setShowLyrics
  } = useSettingsStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [fetchedModels, setFetchedModels] = useState<{id: string, label: string}[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleSaveAndAutoTest = async () => {
    if (!apiKeyInput.trim()) {
      flashSave('API Key를 입력해주세요.')
      return
    }

    // 1. API 키 저장
    setAiApiKey(aiProvider, apiKeyInput.trim())
    setAiError(null)
    flashSave('🔑 키 저장 완료! 모델 조회 중...')
    setIsFetchingModels(true)

    try {
      // 2. FETCH MODELS 실행
      const { fetchAvailableModels } = await import('@/app/actions/ai')
      const models = await fetchAvailableModels(apiKeyInput.trim(), aiProvider)
      
      if (models && models.length > 0) {
        setFetchedModels(models)
        // 첫 번째 최신 모델을 자동 선택
        const defaultModel = models[0].id
        setAiModel(aiProvider, defaultModel)
        
        flashSave(`✨ ${models.length}개 모델 발견! 연결 테스트 중...`)
        
        // 3. TEST CONNECTION 실행
        const { testAIConnection } = await import('@/app/actions/ai')
        const result = await testAIConnection(apiKeyInput.trim(), aiProvider, defaultModel)
        
        if (result.success) {
          flashSave(`✅ 연결 성공: ${result.message}`)
        } else {
          setAiError(`연결 테스트 실패: ${result.message}\nAPI 키가 정확한지, 혹은 무료 할당량이 남아있는지 확인해주세요.`)
        }
      } else {
        setAiError('모델 조회 실패: 해당 API 키로 사용 가능한 AI 모델을 가져오지 못했습니다.')
      }
    } catch (e: any) {
      setAiError(`오류 발생: ${e?.message || e}`)
    } finally {
      setIsFetchingModels(false)
    }
  }

  // [NEW] Drive config state (from mobile)
  const [baseFolder, setBaseFolder] = useState<{id: string, name: string} | null>(null)
  const [scanFolder, setScanFolder] = useState<{id: string, name: string} | null>(null)
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>(['mp3', 'flac', 'aac', 'm4a'])
  
  // Folder picker
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'BASE' | 'TARGET'>('TARGET')
  const [currentPickerFolder, setCurrentPickerFolder] = useState({ id: 'root', name: 'Google Drive' })
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([])
  const [pickerFolders, setPickerFolders] = useState<any[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  // Lyrics settings
  const [lyricsSettings, setLyricsSettings] = useState({
    autoSearch: true,
    order: ['synced', 'alsong', 'lrclib', 'unsynced']
  })

  useEffect(() => { 
    setApiKeyInput(aiApiKeys[aiProvider] || '') 
    setFetchedModels([])
  }, [aiProvider, aiApiKeys])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadSettings()
    
    const savedLyrics = localStorage.getItem('lala_lyrics_settings')
    if (savedLyrics) {
      try {
        const parsed = JSON.parse(savedLyrics)
        setLyricsSettings(prev => ({ ...prev, ...parsed, order: Array.isArray(parsed.order) ? parsed.order : prev.order }))
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (showFolderPicker) loadPickerFolders(currentPickerFolder.id)
  }, [showFolderPicker, currentPickerFolder])

  const loadSettings = async () => {
    try {
      const settings = await getScanSettings()
      if (settings) {
        if (settings.base_folder_id) setBaseFolder({ id: settings.base_folder_id, name: settings.base_folder_name })
        if (settings.scan_folder_id) setScanFolder({ id: settings.scan_folder_id, name: settings.scan_folder_name })
        if (settings.allowed_extensions?.length) setAllowedExtensions(settings.allowed_extensions)
      }
    } catch (e) { console.error(e) }
  }

  const loadPickerFolders = async (folderId: string) => {
    setPickerLoading(true)
    try {
      const folders = folderId === 'shared-root' ? await getSharedFolders() : await getDriveFolders(folderId)
      setPickerFolders(folders || [])
    } catch (e) { setPickerFolders([]) }
    finally { setPickerLoading(false) }
  }

  const openPicker = (mode: 'BASE' | 'TARGET') => {
    setPickerMode(mode); setFolderHistory([])
    setCurrentPickerFolder(mode === 'BASE' ? { id: 'root', name: '내 드라이브' } : (baseFolder || { id: 'root', name: 'Google Drive' }))
    setShowFolderPicker(true)
  }

  const handleConfirmSelect = async (targetFolder?: {id: string, name: string}) => {
    const folder = targetFolder || currentPickerFolder
    if (pickerMode === 'BASE') {
      const res = await saveBaseSettings(folder.id, folder.name)
      if (res.success) { setBaseFolder(folder); setScanFolder(null); flashSave(`Music Root → "${folder.name}"`) }
    } else {
      const res = await saveScanSettings(folder.id, folder.name)
      if (res.success) { setScanFolder(folder); flashSave(`Scan Target → "${folder.name}"`) }
    }
    setShowFolderPicker(false)
  }

  const handleNavigate = (f: {id: string, name: string}) => { setFolderHistory(h => [...h, currentPickerFolder]); setCurrentPickerFolder(f) }
  const handleGoBack = () => { if (!folderHistory.length) return; setCurrentPickerFolder(folderHistory.at(-1)!); setFolderHistory(h => h.slice(0,-1)) }
  const canGoUp = () => { if (!folderHistory.length) return false; if (pickerMode==='BASE') return currentPickerFolder.id!=='root'&&currentPickerFolder.id!=='shared-root'; if (baseFolder&&currentPickerFolder.id===baseFolder.id) return false; return true }

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/'); router.refresh()
    }
  }

  const toggleExtension = (ext: string) => setAllowedExtensions(p => p.includes(ext) ? p.filter(e=>e!==ext) : [...p,ext])
  const handleSaveExtensions = async () => { const r = await saveExtensionSettings(allowedExtensions); if (r.success) flashSave('FORMATS_SAVED') }
  const handleResetLibrary = async () => { if (confirm('라이브러리를 초기화하시겠습니까?')) { const r = await resetMusicLibrary(); if (r.success) { flashSave('RESET_DONE'); window.location.reload() } } }
  const handleResetPlaylists = async () => { if (confirm('플레이리스트를 삭제하시겠습니까?')) { const r = await resetPlaylists(); if (r.success) { flashSave('RESET_DONE'); window.location.reload() } } }
  const handleResetFolder = async () => { if (confirm('스캔 설정을 초기화하시겠습니까?')) { await resetScanSettings(); setBaseFolder(null); setScanFolder(null); flashSave('RESET_DONE') } }

  const flashSave = (msg: string) => { setSaveStatus(msg); setTimeout(() => setSaveStatus(null), 2000) }

  const handleSaveLyricsSettings = (ns: typeof lyricsSettings) => { setLyricsSettings(ns); localStorage.setItem('lala_lyrics_settings', JSON.stringify(ns)); flashSave('LYRICS_SAVED') }
  const moveOrder = (i: number, dir: 'up'|'down') => { const o = [...lyricsSettings.order]; if (dir==='up'&&i>0) [o[i],o[i-1]]=[o[i-1],o[i]]; else if (dir==='down'&&i<o.length-1) [o[i],o[i+1]]=[o[i+1],o[i]]; handleSaveLyricsSettings({...lyricsSettings,order:o}) }
  const getLabel = (id: string) => ({ synced: '⏱️ 내장 (싱크)', unsynced: '📄 내장 (텍스트)', alsong: '🇰🇷 알송', lrclib: '🌍 LRCLIB' }[id] || id)

  const tabs = [
    { id: 'general', label: 'APP_PREFERENCES', icon: SettingsIcon },
    { id: 'drive', label: 'DRIVE_CONFIG', icon: MapPin },
    { id: 'ai', label: 'AI_CONFIG', icon: Wand2 },
    { id: 'appearance', label: 'PERSONALIZATION', icon: Palette },
    { id: 'account', label: 'ACCOUNT', icon: User },
    { id: 'about', label: 'SYSTEM_INFO', icon: Disc3 },
  ]

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-surface)' }}>
      {/* Left Nav */}
      <div className="w-56 flex flex-col p-6" style={{ borderRight: '1px solid var(--bg-container-high)' }}>
        <h1 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] tracking-tight mb-1">SETTINGS</h1>
        <p className="font-['Work_Sans'] text-[8px] text-[var(--text-muted)] tracking-[0.3em] mb-8">SYSTEM_CONFIG</p>
        <div className="flex flex-col gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-all font-['Work_Sans'] text-xs tracking-tight border-l-2
                  ${isActive ? 'text-[var(--tertiary)] border-[var(--tertiary)] bg-[color:var(--tertiary)]/5 font-bold' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-container-high)]'}`}>
                <Icon size={14} className={isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)]'} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-container-high) transparent' }}>
        <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none opacity-10" style={{ background: 'linear-gradient(180deg, var(--bg-container-high) 0%, transparent 100%)' }} />
        <div className="p-10 max-w-2xl relative z-10">

          {/* Save status toast */}
          {saveStatus && (
            <div className="fixed top-6 right-6 z-50 px-4 py-2 font-['Work_Sans'] text-xs tracking-widest font-bold text-[var(--on-primary)] animate-in fade-in slide-in-from-top-2"
              style={{ background: 'var(--primary)' }}>
              {saveStatus}
            </div>
          )}

          {activeTab === 'general' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">APP_PREFERENCES</h2>
              <div className="space-y-4">
                {/* Audio Player */}
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                    <Disc3 size={14} /> AUDIO_PLAYER
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">Auto-Play Next Track</div>
                        <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Automatically play the next track in the list when the current one finishes</div>
                      </div>
                      <input type="checkbox" checked={autoPlayNext} onChange={(e) => setAutoPlayNext(e.target.checked)}
                        className="w-4 h-4 accent-[var(--tertiary)] bg-[var(--bg-container)] border border-[var(--border-strong)]" />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">High Quality Audio (HQ)</div>
                        <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Prefer highest quality stream available (may consume more data)</div>
                      </div>
                      <input type="checkbox" checked={highQualityAudio} onChange={(e) => setHighQualityAudio(e.target.checked)}
                        className="w-4 h-4 accent-[var(--tertiary)] bg-[var(--bg-container)] border border-[var(--border-strong)]" />
                    </label>
                  </div>
                </div>

                {/* Lyrics Config */}
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                    <Mic2 size={14} /> LYRICS_CONFIG
                  </h3>
                  <div className="space-y-2 mb-4">
                    {lyricsSettings.order.map((id, i) => (
                      <div key={id} className="flex items-center justify-between p-2.5 border border-[color:var(--border-strong)]/30">
                        <span className="font-['Work_Sans'] text-xs text-[var(--text-main)]">{getLabel(id)}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveOrder(i,'up')} disabled={i===0} className="p-1 text-[var(--text-muted)] disabled:opacity-30 hover:text-[var(--tertiary)]"><ArrowUp size={12}/></button>
                          <button onClick={() => moveOrder(i,'down')} disabled={i===lyricsSettings.order.length-1} className="p-1 text-[var(--text-muted)] disabled:opacity-30 hover:text-[var(--tertiary)]"><ArrowDown size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">Auto-search lyrics online</div>
                    <input type="checkbox" checked={lyricsSettings.autoSearch}
                      onChange={(e) => handleSaveLyricsSettings({...lyricsSettings, autoSearch: e.target.checked})}
                      className="w-4 h-4 accent-[var(--tertiary)]" />
                  </label>
                </div>

                {/* Library Sync / Reset */}
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                    <Zap size={14} /> DATA_MANAGEMENT
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div><div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Reset Library</div><div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">모든 곡/폴더 메타데이터 삭제</div></div>
                      <button onClick={handleResetLibrary} className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-red-500/30 text-red-500 hover:bg-red-500/10 transition tracking-wider">RESET</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Reset Playlists</div><div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">모든 플레이리스트 삭제</div></div>
                      <button onClick={handleResetPlaylists} className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-red-500/30 text-red-500 hover:bg-red-500/10 transition tracking-wider">RESET</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Reset Scan Settings</div><div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">전체 드라이브 모드 복귀</div></div>
                      <button onClick={handleResetFolder} className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition tracking-wider">RESET</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* [NEW] DRIVE_CONFIG tab */}
          {activeTab === 'drive' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">DRIVE_CONFIGURATION</h2>
              <div className="space-y-4">
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2"><MapPin size={14} /> MUSIC_ROOT</h3>
                  <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mb-3">플레이어의 최상위 폴더를 지정합니다</div>
                  <div className="flex items-center justify-between p-3 border border-[var(--border-strong)] mb-3">
                    <div className="flex items-center gap-2"><Folder size={14} className="text-yellow-500" /><span className="font-['Work_Sans'] text-sm">{baseFolder?.name || 'Google Drive (전체)'}</span></div>
                    <button onClick={() => openPicker('BASE')} className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition tracking-wider">CHANGE</button>
                  </div>
                </div>

                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2"><FolderSearch size={14} /> SCAN_TARGET</h3>
                  <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mb-3">실제 라이브러리에 담을 폴더입니다</div>
                  <div className="flex items-center justify-between p-3 border border-[var(--border-strong)] mb-3">
                    <div className="flex items-center gap-2"><FolderSearch size={14} className="text-[var(--tertiary)]" /><span className="font-['Work_Sans'] text-sm">{scanFolder?.name || (baseFolder ? `${baseFolder.name} (전체)` : '전체')}</span></div>
                    {scanFolder && <button onClick={() => setScanFolder(null)} className="font-['Work_Sans'] text-xs text-red-500 tracking-wider mr-2">CLEAR</button>}
                    <button onClick={() => openPicker('TARGET')} className="px-4 py-1.5 font-['Work_Sans'] text-xs text-[var(--on-primary)] font-bold tracking-wider" style={{background:'var(--primary)'}}>SELECT</button>
                  </div>
                </div>

                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2"><FileAudio size={14} /> FILE_TYPES</h3>
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    {AUDIO_FORMATS.map(ext => (
                      <button key={ext} onClick={() => toggleExtension(ext)}
                        className={`flex items-center justify-center gap-1.5 py-2 font-['Work_Sans'] text-xs tracking-wider transition border ${allowedExtensions.includes(ext) ? 'text-[var(--tertiary)] border-[var(--tertiary)] font-bold' : 'text-[var(--text-muted)] border-[var(--border-strong)]'}`}>
                        {allowedExtensions.includes(ext) ? <CheckSquare size={10}/> : <Square size={10}/>} {ext.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleSaveExtensions} className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition tracking-wider">SAVE_FORMATS</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">ACCOUNT</h2>
              <div className="p-6" style={{ border: '1px solid var(--bg-container-high)' }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 flex items-center justify-center font-['Work_Sans'] font-bold text-xl text-[var(--on-primary)] uppercase" style={{ background: 'var(--primary)' }}>{user?.email?.charAt(0) || 'U'}</div>
                  <div><h3 className="font-['Work_Sans'] text-sm font-bold text-[var(--text-main)]">{user?.email || 'Not logged in'}</h3><p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.2em]">GOOGLE_DRIVE_LINKED</p></div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 font-['Work_Sans'] text-xs tracking-widest font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 transition"><LogOut size={14} /> SIGN_OUT</button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">AI_CONFIGURATION</h2>
              <div className="p-6 space-y-6" style={{ border: '1px solid var(--bg-container-high)' }}>
                {/* 1. Provider Selection */}
                <div>
                  <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">SELECT_PROVIDER</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['gemini', 'openai', 'claude'] as AIProvider[]).map((provider) => (
                      <button key={provider} onClick={() => setAiProvider(provider)}
                        className={`py-2.5 px-4 font-['Work_Sans'] text-xs tracking-wider font-bold transition capitalize ${aiProvider === provider ? 'text-[var(--on-primary)] border-[var(--tertiary)]' : 'text-[var(--text-muted)] border-[color:var(--border-strong)]/30 hover:text-[var(--text-main)] hover:border-[color:var(--tertiary)]/30'}`}
                        style={aiProvider === provider ? { background: 'var(--primary)', border: '1px solid var(--tertiary)' } : { background: 'transparent', border: '1px solid var(--border-strong)' }}>
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. API Key + Fetch Button */}
                <div>
                  <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">API_KEY</label>
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder={`Enter your ${aiProvider} API key...`}
                        className="w-full py-2.5 pl-9 pr-4 font-['Work_Sans'] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none"
                        style={{ background: 'var(--bg-container-high)', border: '1px solid var(--bg-container-high)' }} />
                    </div>
                    <button 
                      onClick={async () => {
                        const key = apiKeyInput.trim()
                        if (!key) { flashSave('API Key를 입력해주세요.'); return }
                        setAiApiKey(aiProvider, key)
                        setAiError(null)
                        setIsFetchingModels(true)
                        flashSave('🔑 키 저장 완료! 모델 조회 중...')
                        try {
                          const { fetchAvailableModels } = await import('@/app/actions/ai')
                          const models = await fetchAvailableModels(key, aiProvider)
                          if (models && models.length > 0) {
                            setFetchedModels(models)
                            const defaultModel = models[0].id
                            setAiModel(aiProvider, defaultModel)
                            flashSave(`✨ ${models.length}개 모델 발견!`)
                          } else {
                            setFetchedModels([])
                            flashSave('❌ 사용 가능한 모델이 없습니다')
                          }
                        } catch (e: any) {
                          setAiError(`오류 발생: ${e?.message || '모델 조회 실패'}`)
                        } finally {
                          setIsFetchingModels(false)
                        }
                      }}
                      disabled={isFetchingModels}
                      className="px-5 py-2.5 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--on-primary)] transition-all min-w-[100px] flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: 'var(--primary)' }}>
                      <Search size={14} />
                      {isFetchingModels ? 'FETCHING...' : 'FETCH'}
                    </button>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] mt-0.5">🔒</span>
                    <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] leading-relaxed">API 키는 브라우저 로컬 저장소에만 보관되며, 서버에 저장되지 않습니다.</p>
                  </div>
                </div>

                {/* 3. Model List (appears after fetch) */}
                <div>
                  <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">AVAILABLE_MODELS</label>
                  {fetchedModels.length > 0 ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto mb-3" style={{ scrollbarWidth: 'thin' }}>
                      {fetchedModels.map(m => {
                        const isSelected = aiModels[aiProvider] === m.id
                        const lowerId = m.id.toLowerCase()
                        const isRecommended = lowerId.includes('gemini') && (
                          lowerId.includes('flash') ||
                          lowerId.includes('latest') ||
                          lowerId.includes('3.5')
                        )
                        return (
                          <button
                            key={m.id}
                            onClick={() => setAiModel(aiProvider, m.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border ${
                              isSelected 
                                ? 'border-[var(--tertiary)] bg-[var(--tertiary)]/10 text-[var(--text-main)]' 
                                : 'border-[var(--border-strong)] hover:border-[var(--tertiary)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center shrink-0 transition ${
                              isSelected ? 'border-[var(--tertiary)]' : 'border-[var(--border-strong)]'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[var(--tertiary)]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-['Work_Sans'] text-sm font-medium truncate">{m.label || m.id}</span>
                                {isRecommended && (
                                  <span className="shrink-0 text-[8px] font-['Work_Sans'] font-bold tracking-wider text-[var(--on-primary)] px-2 py-0.5 bg-[var(--tertiary)]">
                                    ⭐ RECOMMENDED
                                  </span>
                                )}
                              </div>
                              <span className="font-['Work_Sans'] text-[10px] text-[var(--text-muted)] truncate block">{m.id}</span>
                            </div>
                            {isSelected && <CheckCircle2 size={16} className="text-[var(--tertiary)] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mb-3">
                      <select 
                        value={aiModels[aiProvider]} 
                        onChange={(e) => setAiModel(aiProvider, e.target.value)}
                        className="w-full py-2.5 px-3 font-['Work_Sans'] text-sm text-[var(--text-main)] outline-none border border-[var(--border-strong)] focus:border-[var(--tertiary)] transition"
                        style={{ background: 'var(--bg-container-high)', border: '1px solid var(--border-strong)' }}>
                        {(AI_MODELS[aiProvider] || []).map(m => (
                          <option key={m.id} value={m.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">{m.label}</option>
                        ))}
                      </select>
                      <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">
                        💡 API Key를 입력하고 FETCH 버튼을 눌러 사용 가능한 모델을 조회하세요.
                      </p>
                    </div>
                  )}
                  {fetchedModels.length > 0 && (
                    <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] mb-2">
                      ✨ API에서 {fetchedModels.length}개 모델이 조회되었습니다.
                    </p>
                  )}
                </div>

                {/* 4. Test Connection Button */}
                <button 
                  onClick={async () => {
                    const key = apiKeyInput || aiApiKeys[aiProvider]
                    if (!key) { flashSave('API Key를 먼저 입력하세요'); return }
                    setAiError(null)
                    flashSave('테스트 중...')
                    try {
                      const { testAIConnection } = await import('@/app/actions/ai')
                      const result = await testAIConnection(key, aiProvider, aiModels[aiProvider])
                      if (result.success) {
                        flashSave(`✅ ${result.message}`)
                      } else {
                        setAiError(`연결 테스트 실패: ${result.message}\nAPI 키가 정확한지, 혹은 무료 할당량이 남아있는지 확인해주세요.`)
                      }
                    } catch (e: any) {
                      setAiError(`테스트 오류: ${e?.message || '테스트 실패'}`)
                    }
                  }}
                  className="w-full py-3 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--on-primary)] transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] mb-4"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--tertiary))' }}>
                  <Zap size={14} /> TEST_CONNECTION
                </button>

                {/* Persistent AI Error Display */}
                {aiError && (
                  <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-['Work_Sans'] text-sm text-red-400 leading-relaxed whitespace-pre-wrap">❌ {aiError}</p>
                      <button onClick={() => setAiError(null)} className="text-red-400 shrink-0 mt-0.5 hover:text-red-300 transition"><XCircle size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">PERSONALIZATION</h2>
              <div className="space-y-4">
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2"><Palette size={14} /> THEME</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {['var(--tertiary)', 'var(--primary)', '#A68966', '#8D7B68', '#444444'].map(color => (
                      <button key={color} onClick={() => setThemeColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${themeColor === color ? 'border-[var(--text-main)] scale-110 shadow-[var(--shadow-ambient)]' : 'border-transparent hover:scale-105'}`}
                        style={{ background: color }} />
                    ))}
                  </div>
                </div>
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2"><SettingsIcon size={14} /> UI_ELEMENTS</h3>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div><div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">Show Lyrics (if available)</div><div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Display synchronized lyrics on the player screen</div></div>
                    <input type="checkbox" checked={showLyrics} onChange={(e) => setShowLyrics(e.target.checked)} className="w-4 h-4 accent-[var(--tertiary)] bg-[var(--bg-container)] border border-[var(--border-strong)]" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">SYSTEM_INFO</h2>
              <div className="p-6 flex flex-col items-center text-center" style={{ border: '1px solid var(--bg-container-high)' }}>
                <div className="w-16 h-16 flex items-center justify-center mb-4" style={{ background: 'var(--primary)', boxShadow: '0 0 40px var(--bg-container-high)' }}>
                  <span className="font-['Work_Sans'] text-2xl font-bold text-[var(--on-primary)] italic">S</span>
                </div>
                <h3 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight">LALA</h3>
                <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] mt-1 mb-1">NEURAL_AUDIO v3.0</p>
                <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Desktop Edition</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Folder Picker Modal (shared with mobile) */}
      {showFolderPicker && (
        <div className="fixed inset-0 bg-[color:var(--bg-surface)]/90 z-50 flex items-center justify-center">
          <div className="w-[500px] max-h-[70vh] flex flex-col border border-[var(--border-strong)]" style={{ background: 'var(--bg-surface)' }}>
            <div className="p-4 border-b border-[var(--border-strong)] flex items-center justify-between" style={{ background: 'var(--bg-container)' }}>
              <div><h3 className="font-['Work_Sans'] text-sm font-bold tracking-tight">{pickerMode==='BASE' ? 'MUSIC_ROOT' : 'SCAN_TARGET'}</h3>
              <p className="font-['Work_Sans'] text-[9px] text-[var(--text-muted)] tracking-wider">{pickerMode==='BASE' ? '최상위 폴더 지정' : `"${baseFolder?.name||'Root'}" 내부 선택`}</p></div>
              <button onClick={() => setShowFolderPicker(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-2">✕</button>
            </div>
            <div className="p-3 border-b border-[var(--border-strong)] flex items-center gap-2" style={{ background: 'var(--bg-container-high)' }}>
              <Folder size={14} className={pickerMode==='BASE'?'text-yellow-500':'text-[var(--tertiary)]'} />
              <span className="font-['Work_Sans'] text-sm font-bold truncate flex-1">{currentPickerFolder.name}</span>
              <button onClick={() => handleConfirmSelect()} className="px-3 py-1 font-['Work_Sans'] text-[10px] tracking-wider font-bold text-[var(--on-primary)]" style={{background:'var(--primary)'}}>SELECT_HERE</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
              {pickerLoading ? <div className="text-center py-10 text-[var(--text-muted)] font-['Work_Sans'] text-xs tracking-widest">LOADING...</div> : (
                <div className="space-y-0.5">
                  {canGoUp() && <button onClick={handleGoBack} className="w-full p-2.5 text-left hover:bg-[var(--bg-container-high)] flex items-center gap-3 text-[var(--text-muted)] transition"><ChevronRight className="rotate-180" size={14}/><span className="font-['Work_Sans'] text-xs tracking-wider">PARENT_DIR</span></button>}
                  {currentPickerFolder.id==='root' && <button onClick={() => handleNavigate({id:'shared-root',name:'공유 문서함'})} className="w-full p-2.5 text-left hover:bg-[var(--bg-container-high)] flex items-center gap-3 transition border border-dashed border-[var(--border-strong)] mb-1"><User size={14} className="text-[var(--tertiary)]"/><span className="font-['Work_Sans'] text-sm">Shared with me</span><ChevronRight size={12} className="ml-auto text-[var(--text-muted)]"/></button>}
                  {pickerFolders.map(f => (
                    <div key={f.id} className="flex items-center hover:bg-[var(--bg-container-high)] transition">
                      <button onClick={() => handleNavigate({id:f.id,name:f.name})} className="flex-1 flex items-center gap-3 p-2.5 overflow-hidden text-left"><Folder size={14} className={pickerMode==='BASE'?'text-yellow-500':'text-[var(--tertiary)]'}/><span className="font-['Work_Sans'] text-sm truncate">{f.name}</span></button>
                      <div className="flex items-center gap-1 pr-2">
                        <button onClick={() => handleConfirmSelect({id:f.id,name:f.name})} className="px-2.5 py-1 font-['Work_Sans'] text-[10px] tracking-wider font-bold text-[var(--tertiary)] border border-[var(--tertiary)]/30 hover:bg-[var(--tertiary)]/10 transition">SELECT</button>
                        <button onClick={() => handleNavigate({id:f.id,name:f.name})} className="p-1 text-[var(--text-muted)]"><ChevronRight size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
