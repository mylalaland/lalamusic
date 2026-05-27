import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AIProvider = 'gemini' | 'openai' | 'claude'

// 각 프로바이더별 사용 가능 모델
export const AI_MODELS: Record<AIProvider, { id: string, label: string }[]> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (추천)' },
    { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (추천)' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  claude: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (추천)' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ]
}

interface SettingsState {
  aiProvider: AIProvider
  aiApiKeys: Record<AIProvider, string>
  aiModels: Record<AIProvider, string>   // [NEW] 프로바이더별 모델 선택
  enableVisualizer: boolean
  autoPlayNext: boolean
  highQualityAudio: boolean
  themeColor: string
  showLyrics: boolean
  
  setAiProvider: (provider: AIProvider) => void
  setAiApiKey: (provider: AIProvider, key: string) => void
  setAiModel: (provider: AIProvider, model: string) => void   // [NEW]
  setEnableVisualizer: (enable: boolean) => void
  setAutoPlayNext: (enable: boolean) => void
  setHighQualityAudio: (enable: boolean) => void
  setThemeColor: (color: string) => void
  setShowLyrics: (enable: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: 'gemini',
      aiApiKeys: {
        gemini: '',
        openai: '',
        claude: ''
      },
      aiModels: {
        gemini: 'gemini-2.0-flash',
        openai: 'gpt-4o-mini',
        claude: 'claude-sonnet-4-20250514'
      },
      enableVisualizer: true,
      autoPlayNext: true,
      highQualityAudio: false,
      themeColor: 'var(--primary)',
      showLyrics: true,

      setAiProvider: (provider) => set({ aiProvider: provider }),
      
      setAiApiKey: (provider, key) => set((state) => ({
        aiApiKeys: {
          ...state.aiApiKeys,
          [provider]: key
        }
      })),

      setAiModel: (provider, model) => set((state) => ({
        aiModels: {
          ...state.aiModels,
          [provider]: model
        }
      })),

      setEnableVisualizer: (enable) => set({ enableVisualizer: enable }),
      setAutoPlayNext: (enable) => set({ autoPlayNext: enable }),
      setHighQualityAudio: (enable) => set({ highQualityAudio: enable }),
      setThemeColor: (color) => set({ themeColor: color }),
      setShowLyrics: (enable) => set({ showLyrics: enable })
    }),
    {
      name: 'lala-settings-storage',
    }
  )
)
