'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Settings as SettingsIcon, LogOut, Disc3,
  User, ChevronRight, Palette, Wand2, Key, Zap
} from 'lucide-react'
import { useSettingsStore, type AIProvider } from '@/lib/store/useSettingsStore'

export default function DesktopSettings() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('general')

  const { 
    aiProvider, aiApiKeys, setAiProvider, setAiApiKey,
    autoPlayNext, highQualityAudio, themeColor, showLyrics,
    setAutoPlayNext, setHighQualityAudio, setThemeColor, setShowLyrics
  } = useSettingsStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  useEffect(() => { setApiKeyInput(aiApiKeys[aiProvider] || '') }, [aiProvider, aiApiKeys])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/'); router.refresh()
    }
  }

  const tabs = [
    { id: 'general', label: 'APP_PREFERENCES', icon: SettingsIcon },
    { id: 'account', label: 'ACCOUNT', icon: User },
    { id: 'ai', label: 'AI_CONFIG', icon: Wand2 },
    { id: 'appearance', label: 'PERSONALIZATION', icon: Palette },
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

          {activeTab === 'general' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">APP_PREFERENCES</h2>
              <div className="space-y-4">
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

                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                    <Zap size={14} /> LIBRARY_SYNC
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-['Work_Sans'] text-sm text-[var(--text-main)]">Rescan Library</div>
                        <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Manually trigger a full rescan of your Google Drive</div>
                      </div>
                      <button className="px-4 py-1.5 font-['Work_Sans'] text-xs border border-[var(--border-strong)] text-[var(--text-main)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition uppercase tracking-widest">
                        SCAN_NOW
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">ACCOUNT</h2>
              <div className="p-6" style={{ border: '1px solid var(--bg-container-high)' }}>
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
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">AI_CONFIGURATION</h2>
              <div className="p-6 space-y-6" style={{ border: '1px solid var(--bg-container-high)' }}>
                <div>
                  <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">SELECT_PROVIDER</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['gemini', 'openai', 'claude'] as AIProvider[]).map((provider) => (
                      <button key={provider} onClick={() => setAiProvider(provider)}
                        className={`py-2.5 px-4 font-['Work_Sans'] text-xs tracking-wider font-bold transition capitalize ${
                          aiProvider === provider
                            ? 'text-[var(--on-primary)] border-[var(--tertiary)]'
                            : 'text-[var(--text-muted)] border-[color:var(--border-strong)]/30 hover:text-[var(--text-main)] hover:border-[color:var(--tertiary)]/30'
                        }`}
                        style={aiProvider === provider ? { background: 'var(--primary)', border: '1px solid var(--tertiary)' } : { background: 'transparent', border: '1px solid var(--border-strong)' }}>
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] uppercase block mb-3">API_KEY</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={`Enter your ${aiProvider} API key...`}
                        className="w-full py-2.5 pl-9 pr-4 font-['Work_Sans'] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none"
                        style={{ background: 'var(--bg-container-high)', border: '1px solid var(--bg-container-high)' }} />
                    </div>
                    <button onClick={() => { 
                        setAiApiKey(aiProvider, apiKeyInput); 
                        setSaveStatus('SAVED ✓');
                        setTimeout(() => setSaveStatus(null), 2000);
                      }}
                      className="px-5 py-2.5 font-['Work_Sans'] text-xs tracking-wider font-bold text-[var(--on-primary)] transition-all min-w-[80px]"
                      style={{ background: saveStatus ? 'var(--primary)' : 'var(--primary)' }}>
                      {saveStatus || 'SAVE'}
                    </button>
                  </div>

                  {/* 🟢 Provider-specific API Key Guide */}
                  <div className="mt-4 p-4" style={{ background: 'var(--bg-container-high)', border: '1px solid var(--bg-container-high)' }}>
                    <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                      <span>💡</span> HOW_TO_GET_API_KEY
                    </p>

                    {aiProvider === 'gemini' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">01</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                              className="text-[var(--tertiary)] underline underline-offset-2 decoration-[color:var(--tertiary)]/30 hover:decoration-[var(--tertiary)] transition">
                              Google AI Studio
                            </a>에 접속합니다 (Google 계정 가입 및 '프로젝트 만들기' 필요)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">02</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[var(--text-main)]">"Create API Key"</strong> 버튼을 클릭합니다
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">03</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            생성된 키를 복사해서 위 입력란에 붙여넣기 하세요
                          </p>
                        </div>
                        <div className="mt-2 py-2 px-3" style={{ background: 'var(--bg-container-high)', border: '1px solid var(--bg-container-high)' }}>
                          <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] leading-relaxed">
                            ✨ <strong className="text-[#b0b3bc]">추천!</strong> Gemini는 무료 사용량이 넉넉해서 개인용으로 좋습니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'openai' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">01</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                              className="text-[var(--tertiary)] underline underline-offset-2 decoration-[color:var(--tertiary)]/30 hover:decoration-[var(--tertiary)] transition">
                              OpenAI Platform
                            </a>에 접속합니다 (가입 후 프로젝트 생성 & 결제수단 등록 필요)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">02</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[var(--text-main)]">"+ Create new secret key"</strong>를 클릭합니다
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">03</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[var(--text-main)]">sk-</strong>로 시작하는 키를 복사해서 위에 붙여넣기 하세요
                          </p>
                        </div>
                        <div className="mt-2 py-2 px-3" style={{ background: 'var(--bg-container-high)', border: '1px solid var(--border-light)' }}>
                          <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] leading-relaxed">
                            ⚡ OpenAI는 사용량에 따라 과금됩니다. <strong className="text-[#b0b3bc]">월 $5 이내</strong>로 충분합니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'claude' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">01</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                              className="text-[var(--tertiary)] underline underline-offset-2 decoration-[color:var(--tertiary)]/30 hover:decoration-[var(--tertiary)] transition">
                              Anthropic Console
                            </a>에 접속합니다 (가입 후 프로젝트 생성 & 결제수단 등록 필요)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">02</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[var(--text-main)]">"Create Key"</strong>를 클릭합니다
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Work_Sans'] text-[10px] text-[var(--tertiary)] font-bold shrink-0">03</span>
                          <p className="font-['Noto_Serif'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[var(--text-main)]">sk-ant-</strong>로 시작하는 키를 복사해서 위에 붙여넣기 하세요
                          </p>
                        </div>
                        <div className="mt-2 py-2 px-3" style={{ background: 'var(--bg-container-high)', border: '1px solid var(--border-light)' }}>
                          <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] leading-relaxed">
                            ⚡ Claude도 사용량에 따라 과금됩니다. <strong className="text-[#b0b3bc]">월 $5 이내</strong>로 충분합니다.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Privacy Notice */}
                  <div className="mt-3 flex items-start gap-2">
                    <span className="text-[10px] mt-0.5">🔒</span>
                    <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)] leading-relaxed">
                      API 키는 이 브라우저의 <strong className="text-[var(--text-muted)]">로컬 저장소</strong>에만 보관되며, 
                      선택한 AI 서비스에만 직접 전송됩니다. 서버에 저장되지 않습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">PERSONALIZATION</h2>
              <div className="space-y-4">
                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                    <Palette size={14} /> THEME
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    {['var(--tertiary)', 'var(--primary)', '#A68966', '#8D7B68', '#444444'].map(color => (
                      <button key={color} onClick={() => setThemeColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${themeColor === color ? 'border-[var(--text-main)] scale-110 shadow-[var(--shadow-ambient)]' : 'border-transparent hover:scale-105'}`}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-4" style={{ border: '1px solid var(--bg-container-high)', background: 'var(--bg-container-high)' }}>
                  <h3 className="font-['Work_Sans'] text-sm text-[var(--tertiary)] tracking-widest uppercase mb-4 flex items-center gap-2">
                    <SettingsIcon size={14} /> UI_ELEMENTS
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <div className="font-['Work_Sans'] text-sm text-[var(--text-main)] group-hover:text-[var(--tertiary)] transition">Show Lyrics (if available)</div>
                        <div className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Display synchronized lyrics on the player screen</div>
                      </div>
                      <input type="checkbox" checked={showLyrics} onChange={(e) => setShowLyrics(e.target.checked)}
                        className="w-4 h-4 accent-[var(--tertiary)] bg-[var(--bg-container)] border border-[var(--border-strong)]" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div>
              <h2 className="font-['Work_Sans'] text-lg font-bold text-[var(--text-main)] mb-6 tracking-tight">SYSTEM_INFO</h2>
              <div className="p-6 flex flex-col items-center text-center" style={{ border: '1px solid var(--bg-container-high)' }}>
                <div className="w-16 h-16 flex items-center justify-center mb-4"
                  style={{ background: 'var(--primary)', boxShadow: '0 0 40px var(--bg-container-high)' }}>
                  <span className="font-['Work_Sans'] text-2xl font-bold text-[var(--on-primary)] italic">S</span>
                </div>
                <h3 className="font-['Work_Sans'] text-xl font-bold text-[var(--text-main)] tracking-tight">LALA</h3>
                <p className="font-['Work_Sans'] text-[9px] text-[var(--tertiary)] tracking-[0.3em] mt-1 mb-1">NEURAL_AUDIO v3.0</p>
                <p className="font-['Noto_Serif'] text-[10px] text-[var(--text-muted)]">Desktop Edition</p>
                <button className="mt-6 px-6 py-2 font-['Work_Sans'] text-xs tracking-widest text-[var(--text-muted)] border border-[color:var(--border-strong)]/50 hover:border-[color:var(--tertiary)]/30 hover:text-[var(--tertiary)] transition uppercase">
                  CHECK_UPDATES
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
