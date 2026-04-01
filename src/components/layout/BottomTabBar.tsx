'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ListMusic, Library, Globe, Settings, FolderClosed } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BottomTabBar() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Lists', href: '/lists', icon: ListMusic },
    { name: 'Library', href: '/library', icon: Library },
    { name: 'Connect', href: '/connect', icon: Globe }, // 여기가 메인(구글 드라이브)
    { name: 'Files', href: '/files', icon: FolderClosed },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <div className="flex-none h-[85px] bg-black/95 backdrop-blur-lg border-t border-white/10 pb-5 z-50">
      <div className="flex justify-around items-center h-full px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon as any
          // 현재 경로가 탭의 href와 시작 부분이 일치하면 활성화 (예: /connect/folder/123 -> Connect 활성화)
          const isActive = pathname.startsWith(tab.href)
          
          return (
            <Link 
              key={tab.name} 
              href={tab.href}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform"
            >
              <Icon 
                size={26} 
                strokeWidth={2}
                className={cn(
                  "transition-colors duration-200",
                  isActive ? "text-[#3B82F6]" : "text-gray-500" // 활성화되면 파란색(Evermusic 컬러)
                )} 
              />
              <span className={cn(
                "text-[10px] font-medium tracking-wide",
                isActive ? "text-[#3B82F6]" : "text-gray-500"
              )}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}