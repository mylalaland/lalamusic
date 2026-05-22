import BottomTabBar from '@/components/layout/BottomTabBar'
import GlobalPlayer from '@/components/player/GlobalPlayer'
import SwipeNavigation from '@/components/layout/SwipeNavigation'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <SwipeNavigation>
      <div className="flex flex-col h-[100dvh] analog-surface text-[var(--text-main)] overflow-hidden relative">
        {/* 1. 메인 콘텐츠 — pb adjusted for safe-area BottomTabBar + MiniPlayer */}
        <main className="flex-1 overflow-y-auto relative scrollbar-hide" style={{
          paddingBottom: 'calc(64px + max(env(safe-area-inset-bottom), 12px) + 70px)'
        }}>
          {children}
        </main>

        <GlobalPlayer />

        {/* 3. 하단 탭바 — fixed for consistent positioning */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <BottomTabBar />
        </div>
      </div>
    </SwipeNavigation>
  )
}