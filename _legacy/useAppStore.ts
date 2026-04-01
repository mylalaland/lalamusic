import { create } from 'zustand';

interface AppState {
  // Connect 메뉴의 상태 (예: 현재 단계, 입력된 데이터 등)
  connectState: {
    step: number;
    inputData: Record<string, any>;
  };
  // 현재 활성화된 메뉴 탭 (필요한 경우)
  activeTab: string;
  
  // [NEW] Connect 탭 상태 유지 (경로 및 아이템)
  connectPath: {id: string, name: string}[];
  connectItems: any[];

  // 상태 업데이트 함수들
  setConnectStep: (step: number) => void;
  setConnectInput: (data: Record<string, any>) => void;
  setActiveTab: (tab: string) => void;
  resetConnectState: () => void;
  setConnectPath: (path: {id: string, name: string}[]) => void;
  setConnectItems: (items: any[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  connectState: {
    step: 0,
    inputData: {},
  },
  activeTab: 'home',
  connectPath: [],
  connectItems: [],

  setConnectStep: (step) => set((state) => ({ connectState: { ...state.connectState, step } })),
  setConnectInput: (data) => set((state) => ({ connectState: { ...state.connectState, inputData: { ...state.connectState.inputData, ...data } } })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  resetConnectState: () => set({ connectState: { step: 0, inputData: {} } }),
  setConnectPath: (path) => set({ connectPath: path }),
  setConnectItems: (items) => set({ connectItems: items }),
}));