import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AIProvider = 'gemini' | 'openai' | 'claude'

interface SettingsState {
  aiProvider: AIProvider
  aiApiKeys: Record<AIProvider, string>
  enableVisualizer: boolean
  
  setAiProvider: (provider: AIProvider) => void
  setAiApiKey: (provider: AIProvider, key: string) => void
  setEnableVisualizer: (enable: boolean) => void
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

      setAiProvider: (provider) => set({ aiProvider: provider }),
      
      setAiApiKey: (provider, key) => set((state) => ({
        aiApiKeys: {
          ...state.aiApiKeys,
          [provider]: key
        }
      })),

      setEnableVisualizer: (enable) => set({ enableVisualizer: enable })
    }),
    {
      name: 'lala-settings-storage',
    }
  )
)
