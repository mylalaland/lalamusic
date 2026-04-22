'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ListMusic, Library, Globe, Settings, FolderClosed } from 'lucide-react'

const Icon = {
  ListMusic: ListMusic as any, Library: Library as any,
  Globe: Globe as any, Settings: Settings as any, FolderClosed: FolderClosed as any
}

export default function BottomTabBar() {
  const pathname = usePathname()

  const tabs = [
    { name: 'LISTS', href: '/mobile/lists', icon: Icon.ListMusic },
    { name: 'LIBRARY', href: '/mobile/library', icon: Icon.Library },
    { name: 'CONNECT', href: '/mobile/connect', icon: Icon.Globe },
    { name: 'FILES', href: '/mobile/files', icon: Icon.FolderClosed },
    { name: 'CONFIG', href: '/mobile/settings', icon: Icon.Settings },
  ]

  return (
    <div 
      className="flex-none h-[85px] pb-5 z-50"
      style={{ 
        background: 'rgba(7, 9, 13, 0.95)', 
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(153, 247, 255, 0.08)' 
      }}
    >
      <div className="flex justify-around items-center h-full px-2">
        {tabs.map((tab) => {
          const TabIcon = tab.icon
          const isActive = pathname.startsWith(tab.href)
          
          return (
            <Link 
              key={tab.name} 
              href={tab.href}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform relative"
            >
              {/* Active top indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[#99f7ff]" style={{ boxShadow: '0 0 10px rgba(153,247,255,0.6)' }} />
              )}
              <TabIcon 
                size={22} 
                strokeWidth={1.5}
                className={`transition-colors duration-200 ${isActive ? 'text-[#99f7ff]' : 'text-[#44484f]'}`}
                style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(153,247,255,0.5))' } : undefined}
              />
              <span className={`text-[9px] font-['Space_Grotesk'] tracking-[0.15em] font-medium ${isActive ? 'text-[#99f7ff]' : 'text-[#44484f]'}`}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}