import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AIProvider = 'gemini' | 'openai' | 'claude'

interface SettingsState {
  aiProvider: AIProvider
  aiApiKeys: Record<AIProvider, string>
  enableVisualizer: boolean
  autoPlayNext: boolean
  highQualityAudio: boolean
  themeColor: string
  showLyrics: boolean
  
  setAiProvider: (provider: AIProvider) => void
  setAiApiKey: (provider: AIProvider, key: string) => void
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
