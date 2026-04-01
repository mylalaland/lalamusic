'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useRef } from 'react'
import { usePlayerStore } from '@/lib/store/usePlayerStore'

const TABS = ['/lists', '/library', '/connect', '/files', '/settings']

export default function SwipeNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isExpanded } = usePlayerStore() 
  
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

    // 가로 스와이프 감지 (세로보다 가로 움직임이 크고, 최소 100px 이상 이동 시 - 민감도 완화)
    if (Math.abs(diffX) > 100 && Math.abs(diffX) > Math.abs(diffY)) {
      // 현재 탭 인덱스 찾기
      const currentIndex = TABS.findIndex(tab => pathname.startsWith(tab))
      if (currentIndex === -1) return 

      if (diffX > 0) {
        // 오른쪽에서 왼쪽으로 쓸어넘김 (Next Tab)
        const nextIndex = (currentIndex + 1) % TABS.length
        router.push(TABS[nextIndex])
      } else {
        // 왼쪽에서 오른쪽으로 쓸어넘김 (Prev Tab)
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