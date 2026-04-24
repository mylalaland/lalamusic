import BottomTabBar from '@/components/layout/BottomTabBar'
import GlobalPlayer from '@/components/player/GlobalPlayer'
import SwipeNavigation from '@/components/layout/SwipeNavigation'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <SwipeNavigation>
      <div className="flex flex-col h-screen analog-surface text-[var(--text-main)] overflow-hidden relative">
        {/* 1. 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto relative scrollbar-hide pb-[85px]">
          {children}
        </main>

        <GlobalPlayer />

        {/* 3. 하단 탭바 */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <BottomTabBar />
        </div>
      </div>
    </SwipeNavigation>
  )
}