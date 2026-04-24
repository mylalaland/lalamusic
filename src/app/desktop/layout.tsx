'use client'

import React from 'react'
import DesktopSidebar from '@/components/layout/DesktopSidebar'
import DesktopPlayer from '@/components/player/DesktopPlayer'

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
      {/* 1. 사이드바 (고정) */}
      <div className="w-56 flex-shrink-0 hidden md:block">
         <DesktopSidebar />
      </div>

      {/* 2. 메인 컨텐츠 & 하단 플레이어 래퍼 */}
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto relative scrollbar-hide">
          {children}
        </main>

        {/* 3. 데스크탑 전용 하단 컨트롤러 (완전한 오디오 엔진 포함) */}
        <DesktopPlayer />
      </div>
    </div>
  )
}
