'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ListMusic, Library, Globe, Settings, FolderClosed, Heart, Clock } from 'lucide-react'

const Icon = {
  ListMusic: ListMusic as any, Library: Library as any,
  Globe: Globe as any, Settings: Settings as any, FolderClosed: FolderClosed as any,
  Heart: Heart as any, Clock: Clock as any
}

export default function BottomTabBar() {
  const pathname = usePathname()

  const tabs = [
    { name: 'CONNECT', href: '/mobile/connect', icon: Icon.Globe },
    { name: 'LIBRARY', href: '/mobile/library', icon: Icon.Library },
    { name: 'LISTS', href: '/mobile/lists', icon: Icon.ListMusic },
    { name: 'FILES', href: '/mobile/files', icon: Icon.FolderClosed },
    { name: 'SETTINGS', href: '/mobile/settings', icon: Icon.Settings },
  ]

  return (
    <div 
      className="flex-none z-50 analog-surface border-t border-[var(--border-light)]"
      style={{ 
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        height: 'calc(64px + max(env(safe-area-inset-bottom), 12px))'
      }}
    >
      <div className="flex justify-around items-center h-[64px] px-1">
        {tabs.map((tab) => {
          const TabIcon = tab.icon
          const isActive = pathname.startsWith(tab.href)
          
          return (
            <Link 
              key={tab.name} 
              href={tab.href}
              className="flex flex-col items-center justify-center w-full h-full space-y-0.5 active:scale-95 transition-transform relative"
            >
              {/* Active top indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[var(--tertiary)] rounded-b-md" />
              )}
              <TabIcon 
                size={20} 
                strokeWidth={isActive ? 2 : 1.5}
                className={`transition-colors duration-200 ${isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] opacity-60'}`}
              />
              <span className={`text-[8px] font-['Work_Sans'] tracking-wider font-bold uppercase ${isActive ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] opacity-60'}`}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}