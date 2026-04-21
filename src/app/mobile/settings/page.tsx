'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  LogOut, User, FolderSearch, Check, ChevronRight, Folder, MapPin, Target, FileAudio, 
  Trash2, RefreshCw, Database, ListMusic, Save, XCircle, CheckSquare, Square, Settings, Mic2, Radio, ArrowUp, ArrowDown
} from 'lucide-react'
import { 
  getScanSettings, saveScanSettings, saveBaseSettings, resetScanSettings, 
  saveExtensionSettings, resetMusicLibrary, resetPlaylists 
} from '@/app/actions/settings'
import { getDriveFolders, getSharedFolders } from '@/app/actions/library'
import { useSettingsStore, type AIProvider } from '@/lib/store/useSettingsStore'
import { Wand2, Key } from 'lucide-react'

const Icon = {
  LogOut: LogOut as any,
  User: User as any,
  FolderSearch: FolderSearch as any,
  Check: Check as any,
  ChevronRight: ChevronRight as any,
  Folder: Folder as any,
  MapPin: MapPin as any,
  Target: Target as any,
  FileAudio: FileAudio as any,
  Trash2: Trash2 as any,
  RefreshCw: RefreshCw as any,
  Database: Database as any,
  ListMusic: ListMusic as any,
  Save: Save as any,
  XCircle: XCircle as any,
  CheckSquare: CheckSquare as any,
  Square: Square as any,
  Settings: Settings as any,
  Mic2: Mic2 as any,
  Radio: Radio as any,
  ArrowUp: ArrowUp as any,
  ArrowDown: ArrowDown as any
}

const AUDIO_FORMATS = ['mp3', 'flac', 'aac', 'm4a', 'wav', 'ogg']

export default function SettingsPage() {
  const router = useRouter()
  
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

  // [NEW] 가사 설정 상태
  const [lyricsSettings, setLyricsSettings] = useState({
    autoSearch: true,
    // [NEW] 4단계 우선순위 (기본값)
    order: ['synced', 'alsong', 'lrclib', 'unsynced'] 
  })
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // AI 상태
  const { aiProvider, aiApiKeys, setAiProvider, setAiApiKey } = useSettingsStore()
  const [apiKeyInput, setApiKeyInput] = useState('')

  useEffect(() => {
    setApiKeyInput(aiApiKeys[aiProvider] || '')
  }, [aiProvider, aiApiKeys])

  // 1. 초기 설정 로드
  useEffect(() => {
    loadSettings()
    
    // [FIX] UI 상태 복원 (탭 이동 시 유지)
    const savedPicker = sessionStorage.getItem('settings_picker_mode')
    if (savedPicker) {
        const { show, mode, folder, history } = JSON.parse(savedPicker)
        if (show) { setShowFolderPicker(true); setPickerMode(mode); setCurrentPickerFolder(folder); setFolderHistory(history); }
    }

    // [NEW] 가사 설정 로드
    const savedLyrics = localStorage.getItem('slowi_lyrics_settings')
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

  // 2. 폴더 목록 로드 (모달 열려있을 때)
  useEffect(() => {
    if (showFolderPicker) {
      loadPickerFolders(currentPickerFolder.id)
    }
    
    // [FIX] UI 상태 저장
    sessionStorage.setItem('settings_picker_mode', JSON.stringify({
        show: showFolderPicker,
        mode: pickerMode,
        folder: currentPickerFolder,
        history: folderHistory
    }))
  }, [showFolderPicker, currentPickerFolder])

  const loadSettings = async () => {
    try {
      const settings = await getScanSettings()
      if (settings) {
        if (settings.base_folder_id) {
            setBaseFolder({ id: settings.base_folder_id, name: settings.base_folder_name })
        }
        if (settings.scan_folder_id) {
            setScanFolder({ id: settings.scan_folder_id, name: settings.scan_folder_name })
        }
        if (settings.allowed_extensions && Array.isArray(settings.allowed_extensions)) {
            setAllowedExtensions(settings.allowed_extensions)
        }
      }
    } catch (e) {
      console.error("Failed to load settings", e)
    }
  }

  const loadPickerFolders = async (folderId: string) => {
    setPickerLoading(true)
    try {
      // [NEW] 공유 문서함 루트 처리
      if (folderId === 'shared-root') {
          const folders = await getSharedFolders()
          setPickerFolders(folders || [])
      } else {
          const folders = await getDriveFolders(folderId)
          setPickerFolders(folders || [])
      }
    } catch (e) {
      console.error(e)
      setPickerFolders([])
    } finally {
      setPickerLoading(false)
    }
  }

  // --- 폴더 선택 로직 ---
  const openPicker = (mode: 'BASE' | 'TARGET') => {
    setPickerMode(mode)
    setFolderHistory([])
    
    if (mode === 'BASE') {
        setCurrentPickerFolder({ id: 'root', name: '내 드라이브' })
    } else {
        if (baseFolder) {
            setCurrentPickerFolder(baseFolder)
        } else {
            setCurrentPickerFolder({ id: 'root', name: 'Google Drive' })
        }
    }
    setShowFolderPicker(true)
  }

  const handleConfirmSelect = async (targetFolder?: {id: string, name: string}) => {
    const folder = targetFolder || currentPickerFolder
    
    if (pickerMode === 'BASE') {
        const res = await saveBaseSettings(folder.id, folder.name)
        if (res.success) {
            setBaseFolder(folder)
            setScanFolder(null) 
            alert(`[Music Root]가 "${folder.name}"(으)로 설정되었습니다.`)
        } else {
            alert("저장 실패: " + (res.error || "알 수 없는 오류"))
        }
    } else {
        const res = await saveScanSettings(folder.id, folder.name)
        if (res.success) {
            setScanFolder(folder)
            alert(`스캔 대상이 "${folder.name}"(으)로 설정되었습니다.`)
        } else {
            alert("저장 실패: " + (res.error || "알 수 없는 오류"))
        }
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

  // --- 초기화 로직 ---
  const handleResetFolder = async () => {
    if (!confirm("스캔 설정을 초기화하시겠습니까? (전체 드라이브 모드로 복귀)")) return
    await resetScanSettings()
    setBaseFolder(null)
    setScanFolder(null)
    alert("초기화되었습니다.")
  }

  const handleResetLibrary = async () => {
    if (confirm('정말 모든 곡과 폴더 정보를 초기화하시겠습니까?\n(Google Drive 파일은 삭제되지 않으며, 메타데이터만 DB에서 제거됩니다.)')) {
      const res = await resetMusicLibrary()
      if (res.success) {
        alert('라이브러리가 초기화되었습니다.')
        window.location.reload()
      } else {
        alert('초기화 실패: 잠시 후 다시 시도해주세요.')
      }
    }
  }

  const handleResetPlaylists = async () => {
    if (confirm('정말 모든 플레이리스트를 삭제하시겠습니까?')) {
      const res = await resetPlaylists()
      if (res.success) {
        alert('플레이리스트가 초기화되었습니다.')
        window.location.reload()
      } else {
        alert('초기화 실패: 잠시 후 다시 시도해주세요.')
      }
    }
  }

  // --- 확장자 및 로그아웃 ---
  const toggleExtension = (ext: string) => {
    setAllowedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    )
  }

  const handleSaveExtensions = async () => {
    const res = await saveExtensionSettings(allowedExtensions)
    if (res.success) {
      alert('파일 형식 설정이 저장되었습니다.')
    } else {
      alert('저장 실패: ' + (res.error || '잠시 후 다시 시도해주세요.'))
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  // [NEW] 가사 설정 저장
  const handleSaveLyricsSettings = (newSettings: typeof lyricsSettings) => {
    setLyricsSettings(newSettings)
    localStorage.setItem('slowi_lyrics_settings', JSON.stringify(newSettings))
    
    // 저장 피드백 (토스트)
    setSaveMessage("설정이 저장되었습니다.")
    setTimeout(() => setSaveMessage(null), 2000)
  }

  // [NEW] 우선순위 변경 핸들러
  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...lyricsSettings.order]
    if (direction === 'up' && index > 0) {
        [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    handleSaveLyricsSettings({ ...lyricsSettings, order: newOrder })
  }

  const getLabel = (id: string) => {
    if (id === 'synced') return { text: '내장 가사 (시간 정보 포함)', icon: '⏱️' }
    if (id === 'unsynced') return { text: '내장 가사 (텍스트만)', icon: '📄' }
    if (id === 'alsong') return { text: '외부 가사 (알송 - 가요)', icon: '🇰🇷' }
    if (id === 'lrclib') return { text: '외부 가사 (LRCLIB - 팝송)', icon: '🌍' }
    return { text: id, icon: '?' }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-32">
      <h1 className="text-2xl font-bold mb-8 px-2 pt-4">Settings</h1>

      <div className="space-y-6 max-w-md mx-auto">
        {/* 계정 정보 */}
        <div className="bg-gray-900/50 rounded-xl p-4 flex items-center gap-4 border border-gray-800">
          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center"><Icon.User className="text-gray-400" /></div>
          <div><p className="font-medium">Google Account</p><p className="text-xs text-gray-500">Connected</p></div>
        </div>

        {/* 1. Music Root 설정 */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <Icon.MapPin className="text-yellow-500" />
            <h2 className="font-bold">Music Root Folder</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">플레이어의 최상위 폴더를 지정합니다.</p>
          
          <div className="bg-black/40 rounded-lg p-3 mb-4 flex items-center justify-between border border-gray-800">
            <div className="flex items-center gap-2 overflow-hidden">
                <Icon.Folder size={16} className="text-yellow-500 shrink-0" />
                <span className="truncate text-sm text-gray-300">
                    {baseFolder ? baseFolder.name : "Google Drive (전체)"}
                </span>
            </div>
            <button onClick={() => openPicker('BASE')} className="text-xs text-blue-400 hover:text-blue-300 shrink-0 font-bold">변경</button>
          </div>
        </div>

        {/* 2. Scan Target 설정 */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 relative">
          {baseFolder && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500/30"></div>}
          <div className="flex items-center gap-3 mb-2">
            <Icon.Target className="text-blue-400" />
            <h2 className="font-bold">Scan Target</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">실제로 라이브러리에 담을 폴더입니다.</p>
          
          <div className="bg-black/40 rounded-lg p-3 mb-4 flex items-center justify-between border border-gray-800">
            <div className="flex items-center gap-2 overflow-hidden">
                <Icon.FolderSearch size={16} className="text-blue-400 shrink-0" />
                <span className="truncate text-sm text-gray-300">
                    {scanFolder ? scanFolder.name : (baseFolder ? `${baseFolder.name} (전체)` : "전체")}
                </span>
            </div>
            {scanFolder && <button onClick={() => setScanFolder(null)} className="text-xs text-red-400">해제</button>}
          </div>

          <button onClick={() => openPicker('TARGET')} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition">스캔 대상 선택</button>
        </div>

        {/* 3. 파일 형식 */}
        <section className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-200">
            <Icon.FileAudio size={20} className="text-green-400" /> File Types
          </h2>
          
          <div className="space-y-4">
            <div className="bg-black/40 p-4 rounded-xl space-y-3 border border-white/5">
                <p className="text-sm text-gray-400 font-medium mb-2">스캔 대상 파일 형식</p>
                <div className="grid grid-cols-3 gap-2">
                    {AUDIO_FORMATS.map(ext => (
                        <button 
                            key={ext}
                            onClick={() => toggleExtension(ext)}
                            className={`flex items-center justify-center gap-2 p-2 rounded-lg text-sm transition ${allowedExtensions.includes(ext) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 border border-transparent'}`}
                        >
                            {allowedExtensions.includes(ext) ? <Icon.CheckSquare size={14} /> : <Icon.Square size={14} />}
                            {ext.toUpperCase()}
                        </button>
                    ))}
                </div>
                <button onClick={handleSaveExtensions} className="w-full py-2 mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition">
                    <Icon.Save size={16} />
                    설정 저장
                </button>
            </div>
          </div>
        </section>

        {/* [NEW] 가사 설정 섹션 */}
        <section className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-200">
            <Icon.Mic2 size={20} className="text-pink-400" /> Lyrics Settings
          </h2>
          
          <div className="space-y-4">
            <div className="bg-black/40 p-4 rounded-xl space-y-4 border border-white/5">
                {/* 우선순위 설정 */}
                <div>
                    <p className="text-sm text-gray-400 font-medium mb-3">가사 표시 우선순위 (높은 순)</p>
                    <div className="space-y-2">
                        {(lyricsSettings.order || []).map((id, index) => {
                            const info = getLabel(id)
                            return (
                                <div key={id} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{info.icon}</span>
                                        <span className="text-sm font-medium text-gray-200">{info.text}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => moveOrder(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-30"><Icon.ArrowUp size={14}/></button>
                                        <button onClick={() => moveOrder(index, 'down')} disabled={index === lyricsSettings.order.length - 1} className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-30"><Icon.ArrowDown size={14}/></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-3 px-1 leading-relaxed">
                        * 위에서부터 순서대로 가사를 찾습니다. 원하는 항목을 위로 올려주세요.
                    </p>
                </div>

                {/* 자동 검색 토글 */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">가사 없을 시 자동 검색</span>
                    <button onClick={() => handleSaveLyricsSettings({...lyricsSettings, autoSearch: !lyricsSettings.autoSearch})} className={`w-12 h-6 rounded-full relative transition ${lyricsSettings.autoSearch ? 'bg-green-500' : 'bg-gray-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${lyricsSettings.autoSearch ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>
            </div>
          </div>
        </section>

        {/* AI Configuration Section */}
        <section className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-200">
            <Wand2 size={20} className="text-blue-400" /> AI Settings
          </h2>
          
          <div className="space-y-4">
            <div className="bg-black/40 p-4 rounded-xl space-y-4 border border-white/5">
                <div>
                   <p className="text-sm text-gray-400 font-medium mb-3">AI Model Provider</p>
                   <div className="flex bg-gray-800/50 rounded-lg p-1">
                      {(['gemini', 'openai', 'claude'] as AIProvider[]).map(provider => (
                        <button 
                          key={provider}
                          onClick={() => setAiProvider(provider)}
                          className={`flex-1 py-2 text-xs font-bold rounded-md capitalize transition ${aiProvider === provider ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          {provider}
                        </button>
                      ))}
                   </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-400 font-medium mb-3 capitalize">{aiProvider} API Key</p>
                  <div className="relative mb-3">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key size={14} className="text-gray-500" />
                      </div>
                      <input 
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={`Enter API Key...`}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg py-3 pl-9 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition"
                      />
                  </div>
                  <button 
                    onClick={() => {
                        setAiApiKey(aiProvider, apiKeyInput)
                        setSaveMessage("AI 설정이 저장되었습니다.")
                        setTimeout(() => setSaveMessage(null), 2000)
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Icon.Save size={16} />
                    저장하기
                  </button>

                  {/* 🟢 Provider-specific API Key Guide */}
                  <div className="mt-4 bg-gray-800/30 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-blue-400 font-bold mb-3 flex items-center gap-2">
                      💡 API 키 발급 방법
                    </p>
                    
                    {aiProvider === 'gemini' && (
                      <div className="space-y-2.5">
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">1</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 underline underline-offset-2">
                              Google AI Studio
                            </a>에 접속 (가입 및 프로젝트 만들기 필요)
                          </p>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">2</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <strong className="text-white">"Create API Key"</strong> 클릭
                          </p>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">3</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            생성된 키를 복사해서 위에 붙여넣기
                          </p>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-2.5 mt-1 border border-green-500/20">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            ✨ <strong className="text-green-400">추천!</strong> Gemini는 무료 사용량이 넉넉해서 개인용으로 좋아요.
                          </p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'openai' && (
                      <div className="space-y-2.5">
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">1</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 underline underline-offset-2">
                              OpenAI Platform
                            </a>에 접속 (가입 후 프로젝트 생성 & 결제수단 등록 필요)
                          </p>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">2</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <strong className="text-white">"+ Create new secret key"</strong> 클릭
                          </p>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">3</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <strong className="text-white">sk-</strong>로 시작하는 키를 복사해서 위에 붙여넣기
                          </p>
                        </div>
                        <div className="bg-yellow-500/10 rounded-lg p-2.5 mt-1 border border-yellow-500/20">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            ⚡ 사용량에 따라 과금됩니다. <strong className="text-yellow-400">월 $5 이내</strong>로 충분해요.
                          </p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'claude' && (
                      <div className="space-y-2.5">
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">1</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 underline underline-offset-2">
                              Anthropic Console
                            </a>에 접속 (가입 후 프로젝트 생성 필요)
                          </p>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">2</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <strong className="text-white">"Create Key"</strong> 클릭
                          </p>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/20 w-5 h-5 flex items-center justify-center rounded-full shrink-0">3</span>
                          <p className="text-[12px] text-gray-300 leading-relaxed">
                            <strong className="text-white">sk-ant-</strong>로 시작하는 키를 복사해서 위에 붙여넣기
                          </p>
                        </div>
                        <div className="bg-yellow-500/10 rounded-lg p-2.5 mt-1 border border-yellow-500/20">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            ⚡ 사용량에 따라 과금됩니다. <strong className="text-yellow-400">월 $5 이내</strong>로 충분해요.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-500 mt-3 leading-relaxed flex items-start gap-1.5">
                    <span>🔒</span>
                    API 키는 브라우저 로컬 저장소에만 보관되며, 선택한 AI 서비스에만 직접 전송됩니다. 서버에 저장되지 않습니다.
                  </p>
                </div>
            </div>
          </div>
        </section>

        {/* 라이브러리 관리 섹션 */}
        <section className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-200">
            <Icon.Database size={20} className="text-blue-400" /> 라이브러리 관리
          </h2>
          
          <div className="space-y-4">
            <button 
              onClick={handleResetLibrary}
              className="w-full py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition font-medium border border-red-500/20 flex items-center justify-center gap-2"
            >
              <Icon.Trash2 size={20} />
              모든 노래 및 폴더 초기화
            </button>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              DB에 저장된 노래 정보와 폴더 구조가 삭제됩니다.<br/>
              (실제 구글 드라이브 파일은 삭제되지 않습니다)
            </p>
          </div>
        </section>

        {/* 플레이리스트 관리 섹션 */}
        <section className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-200">
            <Icon.ListMusic size={20} className="text-purple-400" /> 플레이리스트 관리
          </h2>
          
          <div className="space-y-4">
            <button 
              onClick={handleResetPlaylists}
              className="w-full py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition font-medium border border-red-500/20 flex items-center justify-center gap-2"
            >
              <Icon.RefreshCw size={20} />
              모든 플레이리스트 삭제
            </button>
            <p className="text-xs text-gray-500 text-center">
              생성한 모든 플레이리스트가 영구적으로 삭제됩니다.
            </p>
          </div>
        </section>

        {/* 초기화 및 로그아웃 */}
        <div className="flex gap-2 pt-4">
            <button onClick={handleResetFolder} className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 hover:text-white transition rounded-xl text-gray-400 text-sm font-bold">스캔 설정 초기화</button>
            <button onClick={handleLogout} className="flex-1 py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition rounded-xl flex items-center justify-center gap-2 border border-red-500/20 font-bold"><Icon.LogOut size={18} /> Logout</button>
        </div>
      </div>

      {/* --- 통합 폴더 선택 모달 --- */}
      {showFolderPicker && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col animate-in fade-in">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
                <div>
                    <h3 className="font-bold text-lg">{pickerMode === 'BASE' ? 'Music Root 설정' : '스캔 대상 선택'}</h3>
                    <p className="text-xs text-gray-400">{pickerMode === 'BASE' ? '최상위 폴더를 지정합니다.' : `"${baseFolder ? baseFolder.name : 'Root'}" 내부에서 선택`}</p>
                </div>
                <button onClick={() => setShowFolderPicker(false)} className="text-gray-400 p-2">✕</button>
            </div>
            
            <div className="p-3 bg-gray-800 text-sm text-gray-300 flex items-center gap-2 shadow-md">
                <Icon.Folder size={16} className={pickerMode === 'BASE' ? 'text-yellow-500' : 'text-blue-400'} />
                <span className="font-bold truncate">{currentPickerFolder.name}</span>
                
                {/* [NEW] 현재 폴더 선택 버튼 (Root 선택 가능) */}
                <button 
                    onClick={() => handleConfirmSelect()} 
                    className={`ml-auto px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${pickerMode === 'BASE' ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                    현재 폴더 선택
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {pickerLoading ? <div className="text-center py-20 text-gray-500">로딩 중...</div> : (
                    <div className="space-y-1">
                        {canGoUp() && (
                            <button onClick={handleGoBack} className="w-full p-3 text-left hover:bg-gray-800 rounded-lg flex items-center gap-3 text-gray-400 transition">
                                <div className="w-8 flex justify-center"><Icon.ChevronRight className="rotate-180" size={18} /></div>
                                <span className="font-medium">.. (상위 폴더)</span>
                            </button>
                        )}

                        {/* [NEW] 공유 문서함 진입 버튼 (Root일 때만 표시) */}
                        {currentPickerFolder.id === 'root' && (
                            <div className="w-full p-2 hover:bg-gray-800 rounded-lg flex items-center justify-between group transition border border-dashed border-gray-700 mb-2">
                                <button onClick={() => handleNavigate({ id: 'shared-root', name: '공유 문서함' })} className="flex-1 flex items-center gap-3 overflow-hidden text-left py-1">
                                    <Icon.User size={24} className="text-green-400" />
                                    <span className="truncate text-sm font-medium">공유 문서함 (Shared with me)</span>
                                </button>
                                <button onClick={() => handleNavigate({ id: 'shared-root', name: '공유 문서함' })} className="p-2 text-gray-500 hover:text-white"><Icon.ChevronRight size={20} /></button>
                            </div>
                        )}

                        {pickerFolders.map(folder => (
                            <div key={folder.id} className="w-full p-2 hover:bg-gray-800 rounded-lg flex items-center justify-between group transition">
                                <button onClick={() => handleNavigate({ id: folder.id, name: folder.name })} className="flex-1 flex items-center gap-3 overflow-hidden text-left py-1">
                                    <Icon.Folder size={24} className={pickerMode === 'BASE' ? 'text-yellow-500' : 'text-blue-400'} fill="currentColor" fillOpacity={0.2} />
                                    <span className="truncate text-sm font-medium">{folder.name}</span>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleConfirmSelect({ id: folder.id, name: folder.name })} className={`px-3 py-1.5 rounded text-xs font-bold transition ${pickerMode === 'BASE' ? 'bg-yellow-600' : 'bg-blue-600'}`}>선택</button>
                                    <button onClick={() => handleNavigate({ id: folder.id, name: folder.name })} className="p-2 text-gray-500 hover:text-white"><Icon.ChevronRight size={20} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* 저장 알림 토스트 */}
      {saveMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl animate-in fade-in slide-in-from-bottom-4 z-50">
              {saveMessage}
          </div>
      )}
    </div>
  )
}