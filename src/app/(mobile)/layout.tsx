// src/app/(tabs)/layout.tsx

import BottomTabBar from '@/components/layout/BottomTabBar'
// GlobalPlayer 임포트 제거! (이미 app/layout.tsx에 있습니다)

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden relative">
      {/* 1. 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide pb-[85px]">
        {children}
      </main>

      {/* 2. 전역 플레이어는 여기서 삭제! (RootLayout에 이미 있음) */}

      {/* 3. 하단 탭바 (여기만 남김) */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <BottomTabBar />
      </div>
    </div>
  )
}