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

  const { aiProvider, aiApiKeys, setAiProvider, setAiApiKey } = useSettingsStore()
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
    <div className="flex h-full" style={{ background: '#0a0e14' }}>
      {/* Left Nav */}
      <div className="w-56 flex flex-col p-6" style={{ borderRight: '1px solid rgba(153,247,255,0.06)' }}>
        <h1 className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] tracking-tight mb-1">SETTINGS</h1>
        <p className="font-['Space_Grotesk'] text-[8px] text-[#44484f] tracking-[0.3em] mb-8">SYSTEM_CONFIG</p>
        <div className="flex flex-col gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-all font-['Space_Grotesk'] text-xs tracking-tight border-l-2
                  ${isActive ? 'text-[#99f7ff] border-[#99f7ff] bg-[#99f7ff]/5 font-bold' : 'text-[#72757d] border-transparent hover:text-[#f1f3fc] hover:bg-white/3'}`}>
                <Icon size={14} className={isActive ? 'text-[#99f7ff]' : 'text-[#44484f]'} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(153,247,255,0.15) transparent' }}>
        <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none opacity-10" style={{ background: 'linear-gradient(180deg, rgba(153,247,255,0.1) 0%, transparent 100%)' }} />
        <div className="p-10 max-w-2xl relative z-10">

          {activeTab === 'general' && (
            <div>
              <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] mb-6 tracking-tight">APP_PREFERENCES</h2>
              <div className="space-y-1" style={{ border: '1px solid rgba(153,247,255,0.06)' }}>
                <button className="w-full p-4 flex items-center justify-between hover:bg-[#99f7ff]/3 transition" style={{ borderBottom: '1px solid rgba(153,247,255,0.04)' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'rgba(153,247,255,0.06)', border: '1px solid rgba(153,247,255,0.1)' }}>
                      <Disc3 size={16} className="text-[#99f7ff]" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-['Space_Grotesk'] text-sm text-[#f1f3fc] font-medium">AUDIO_PLAYER</h3>
                      <p className="font-['Inter'] text-[10px] text-[#44484f]">Manage playback and equalizers</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#44484f]" />
                </button>
                <button className="w-full p-4 flex items-center justify-between hover:bg-[#99f7ff]/3 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'rgba(153,247,255,0.06)', border: '1px solid rgba(153,247,255,0.1)' }}>
                      <Zap size={16} className="text-[#99f7ff]" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-['Space_Grotesk'] text-sm text-[#f1f3fc] font-medium">LIBRARY_SYNC</h3>
                      <p className="font-['Inter'] text-[10px] text-[#44484f]">Library indexing and scanning</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#44484f]" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] mb-6 tracking-tight">ACCOUNT</h2>
              <div className="p-6" style={{ border: '1px solid rgba(153,247,255,0.06)' }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 flex items-center justify-center font-['Space_Grotesk'] font-bold text-xl text-[#004145] uppercase"
                    style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)' }}>
                    {user?.email?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[#f1f3fc]">{user?.email || 'Not logged in'}</h3>
                    <p className="font-['Space_Grotesk'] text-[9px] text-[#99f7ff] tracking-[0.2em]">GOOGLE_DRIVE_LINKED</p>
                  </div>
                </div>
                <button onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 font-['Space_Grotesk'] text-xs tracking-widest font-bold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition">
                  <LogOut size={14} /> SIGN_OUT
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] mb-6 tracking-tight">AI_CONFIGURATION</h2>
              <div className="p-6 space-y-6" style={{ border: '1px solid rgba(153,247,255,0.06)' }}>
                <div>
                  <label className="font-['Space_Grotesk'] text-[9px] text-[#99f7ff] tracking-[0.3em] uppercase block mb-3">SELECT_PROVIDER</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['gemini', 'openai', 'claude'] as AIProvider[]).map((provider) => (
                      <button key={provider} onClick={() => setAiProvider(provider)}
                        className={`py-2.5 px-4 font-['Space_Grotesk'] text-xs tracking-wider font-bold transition capitalize ${
                          aiProvider === provider
                            ? 'text-[#004145] border-[#99f7ff]'
                            : 'text-[#72757d] border-[#44484f]/30 hover:text-[#f1f3fc] hover:border-[#99f7ff]/30'
                        }`}
                        style={aiProvider === provider ? { background: 'linear-gradient(135deg, #99f7ff, #00f1fe)', border: '1px solid #99f7ff' } : { background: 'transparent', border: '1px solid rgba(68,72,79,0.5)' }}>
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-['Space_Grotesk'] text-[9px] text-[#99f7ff] tracking-[0.3em] uppercase block mb-3">API_KEY</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44484f]" />
                      <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={`Enter your ${aiProvider} API key...`}
                        className="w-full py-2.5 pl-9 pr-4 font-['Inter'] text-sm text-[#f1f3fc] placeholder:text-[#44484f] outline-none"
                        style={{ background: 'rgba(153,247,255,0.04)', border: '1px solid rgba(153,247,255,0.1)' }} />
                    </div>
                    <button onClick={() => { 
                        setAiApiKey(aiProvider, apiKeyInput); 
                        setSaveStatus('SAVED ✓');
                        setTimeout(() => setSaveStatus(null), 2000);
                      }}
                      className="px-5 py-2.5 font-['Space_Grotesk'] text-xs tracking-wider font-bold text-[#004145] transition-all min-w-[80px]"
                      style={{ background: saveStatus ? '#00f1fe' : 'linear-gradient(135deg, #99f7ff, #00f1fe)' }}>
                      {saveStatus || 'SAVE'}
                    </button>
                  </div>

                  {/* 🟢 Provider-specific API Key Guide */}
                  <div className="mt-4 p-4" style={{ background: 'rgba(153,247,255,0.03)', border: '1px solid rgba(153,247,255,0.08)' }}>
                    <p className="font-['Space_Grotesk'] text-[9px] text-[#99f7ff] tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                      <span>💡</span> HOW_TO_GET_API_KEY
                    </p>

                    {aiProvider === 'gemini' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">01</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                              className="text-[#99f7ff] underline underline-offset-2 decoration-[#99f7ff]/30 hover:decoration-[#99f7ff] transition">
                              Google AI Studio
                            </a>에 접속합니다 (Google 계정 가입 및 '프로젝트 만들기' 필요)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">02</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[#f1f3fc]">"Create API Key"</strong> 버튼을 클릭합니다
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">03</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            생성된 키를 복사해서 위 입력란에 붙여넣기 하세요
                          </p>
                        </div>
                        <div className="mt-2 py-2 px-3" style={{ background: 'rgba(153,247,255,0.04)', border: '1px solid rgba(153,247,255,0.06)' }}>
                          <p className="font-['Inter'] text-[10px] text-[#72757d] leading-relaxed">
                            ✨ <strong className="text-[#b0b3bc]">추천!</strong> Gemini는 무료 사용량이 넉넉해서 개인용으로 좋습니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'openai' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">01</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                              className="text-[#99f7ff] underline underline-offset-2 decoration-[#99f7ff]/30 hover:decoration-[#99f7ff] transition">
                              OpenAI Platform
                            </a>에 접속합니다 (가입 후 프로젝트 생성 & 결제수단 등록 필요)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">02</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[#f1f3fc]">"+ Create new secret key"</strong>를 클릭합니다
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">03</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[#f1f3fc]">sk-</strong>로 시작하는 키를 복사해서 위에 붙여넣기 하세요
                          </p>
                        </div>
                        <div className="mt-2 py-2 px-3" style={{ background: 'rgba(255,170,59,0.04)', border: '1px solid rgba(255,170,59,0.1)' }}>
                          <p className="font-['Inter'] text-[10px] text-[#72757d] leading-relaxed">
                            ⚡ OpenAI는 사용량에 따라 과금됩니다. <strong className="text-[#b0b3bc]">월 $5 이내</strong>로 충분합니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'claude' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">01</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                              className="text-[#99f7ff] underline underline-offset-2 decoration-[#99f7ff]/30 hover:decoration-[#99f7ff] transition">
                              Anthropic Console
                            </a>에 접속합니다 (가입 후 프로젝트 생성 & 결제수단 등록 필요)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">02</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[#f1f3fc]">"Create Key"</strong>를 클릭합니다
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#99f7ff] font-bold shrink-0">03</span>
                          <p className="font-['Inter'] text-[11px] text-[#b0b3bc] leading-relaxed">
                            <strong className="text-[#f1f3fc]">sk-ant-</strong>로 시작하는 키를 복사해서 위에 붙여넣기 하세요
                          </p>
                        </div>
                        <div className="mt-2 py-2 px-3" style={{ background: 'rgba(255,170,59,0.04)', border: '1px solid rgba(255,170,59,0.1)' }}>
                          <p className="font-['Inter'] text-[10px] text-[#72757d] leading-relaxed">
                            ⚡ Claude도 사용량에 따라 과금됩니다. <strong className="text-[#b0b3bc]">월 $5 이내</strong>로 충분합니다.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Privacy Notice */}
                  <div className="mt-3 flex items-start gap-2">
                    <span className="text-[10px] mt-0.5">🔒</span>
                    <p className="font-['Inter'] text-[10px] text-[#44484f] leading-relaxed">
                      API 키는 이 브라우저의 <strong className="text-[#72757d]">로컬 저장소</strong>에만 보관되며, 
                      선택한 AI 서비스에만 직접 전송됩니다. 서버에 저장되지 않습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] mb-6 tracking-tight">PERSONALIZATION</h2>
              <div className="p-6" style={{ border: '1px solid rgba(153,247,255,0.06)' }}>
                <p className="font-['Space_Grotesk'] text-xs text-[#44484f] tracking-widest uppercase">COMING_SOON...</p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div>
              <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] mb-6 tracking-tight">SYSTEM_INFO</h2>
              <div className="p-6 flex flex-col items-center text-center" style={{ border: '1px solid rgba(153,247,255,0.06)' }}>
                <div className="w-16 h-16 flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)', boxShadow: '0 0 40px rgba(153,247,255,0.15)' }}>
                  <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#004145] italic">S</span>
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-bold text-[#f1f3fc] tracking-tight">SLOWI</h3>
                <p className="font-['Space_Grotesk'] text-[9px] text-[#99f7ff] tracking-[0.3em] mt-1 mb-1">NEURAL_AUDIO v3.0</p>
                <p className="font-['Inter'] text-[10px] text-[#44484f]">Desktop Edition</p>
                <button className="mt-6 px-6 py-2 font-['Space_Grotesk'] text-xs tracking-widest text-[#72757d] border border-[#44484f]/50 hover:border-[#99f7ff]/30 hover:text-[#99f7ff] transition uppercase">
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
