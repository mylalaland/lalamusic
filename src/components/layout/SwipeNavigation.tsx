'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useRef } from 'react'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { useConnectStore } from '@/lib/store/useConnectStore'

const TABS = ['/lists', '/library', '/connect', '/files', '/settings']

export default function SwipeNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isExpanded } = usePlayerStore() 
  const { path, popPath } = useConnectStore()
  
  const touchStart = useRef<{x: number, y: number} | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    if (isExpanded) return 

    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    const diffX = touchStart.current.x - touchEnd.x
    const diffY = touchStart.current.y - touchEnd.y

    // 가로 스와이프 감지 (세로보다 가로 움직임이 크고, 최소 80px 이상)
    if (Math.abs(diffX) > 80 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      const isConnect = pathname.startsWith('/connect') || pathname.startsWith('/mobile/connect')
      
      // [FIX] Connect 페이지에서는 스와이프 = 폴더 뒤로가기
      if (isConnect && path.length > 1) {
        if (diffX < 0) {
          // 왼쪽에서 오른쪽 스와이프 (←) = 이전 폴더로
          popPath()
        }
        // 오른쪽에서 왼쪽 스와이프 (→)는 Connect에서 무시
        touchStart.current = null
        return
      }

      // 다른 페이지에서는 탭 전환
      const currentIndex = TABS.findIndex(tab => pathname.startsWith(tab) || pathname.startsWith('/mobile' + tab))
      if (currentIndex === -1) { touchStart.current = null; return }

      if (diffX > 0) {
        // 오른쪽에서 왼쪽 (→) = Next Tab
        const nextIndex = (currentIndex + 1) % TABS.length
        router.push(TABS[nextIndex])
      } else {
        // 왼쪽에서 오른쪽 (←) = Prev Tab
        const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length
        router.push(TABS[prevIndex])
      }
    }
    touchStart.current = null
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-screen" suppressHydrationWarning>
      {children}
    </div>
  )
}