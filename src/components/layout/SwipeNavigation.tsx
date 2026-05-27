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

    // 가로 스와이프 감지 (세로보다 가로 움직임이 크고, 최소 80px)
    if (Math.abs(diffX) > 80 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      const isConnect = pathname.startsWith('/connect') || pathname.startsWith('/mobile/connect')
      
      // Connect 페이지: 스와이프 = 폴더 뒤로가기 (iOS 기본 동작처럼)
      // 왼쪽←오른쪽 스와이프(뒤로) + 오른쪽→왼쪽 스와이프는 무시
      if (isConnect) {
        if (diffX < 0 && path.length > 1) {
          // ← 뒤로 스와이프: 이전 폴더로
          popPath()
        }
        // → 앞으로 스와이프: Connect에서는 무시 (iOS에서도 forward는 기본적으로 없음)
        touchStart.current = null
        return
      }

      // 다른 페이지: 기본 iOS 뒤로가기만 (탭 전환 안 함)
      // iOS 앱 표준: 왼→오 스와이프 = 뒤로가기 (브라우저 기본 동작에 맡김)
    }
    touchStart.current = null
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-screen" suppressHydrationWarning>
      {children}
    </div>
  )
}