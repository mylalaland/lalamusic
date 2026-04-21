'use client'

import React from 'react'
import { Globe, Search, Library, ListMusic, FolderClosed, Settings, Zap, Heart, Clock } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const Icon = {
  Globe: Globe as any, Search: Search as any, Library: Library as any,
  ListMusic: ListMusic as any, FolderClosed: FolderClosed as any,
  Settings: Settings as any, Zap: Zap as any,
  Heart: Heart as any, Clock: Clock as any
}

const menuItems = [
  { name: 'CONNECT',     href: '/connect',   icon: Icon.Globe,        label: '구글 드라이브' },
  { name: 'FAVORITES',   href: '/favorites', icon: Icon.Heart,        label: '좋아요' },
  { name: 'RECENTS',     href: '/recents',   icon: Icon.Clock,        label: '최근 재생' },
  { name: 'LIBRARY',     href: '/library',   icon: Icon.Library,      label: '라이브러리' },
  { name: 'LISTS',       href: '/lists',     icon: Icon.ListMusic,    label: '플레이리스트' },
  { name: 'FILES',       href: '/files',     icon: Icon.FolderClosed, label: '오프라인 파일' },
  { name: 'SETTINGS',    href: '/settings',  icon: Icon.Settings,     label: '설정' },
]

export default function DesktopSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    const desktopPath = `/desktop${href}`
    return pathname === href || pathname === desktopPath || pathname.startsWith(`${href}/`) || pathname.startsWith(`${desktopPath}/`)
  }

  return (
    <div className="h-full flex flex-col pt-6" style={{ background: '#07090d', borderRight: '1px solid rgba(153,247,255,0.08)' }}>
      {/* Logo */}
      <div className="px-5 mb-8">
        <Link href="/connect" className="flex items-center gap-3 group">
          <div className="w-8 h-8 flex items-center justify-center border border-[#99f7ff]/30" style={{ background: 'linear-gradient(135deg, rgba(153,247,255,0.15), rgba(0,241,254,0.05))', boxShadow: '0 0 15px rgba(153,247,255,0.15)' }}>
            <Icon.Zap size={16} className="text-[#99f7ff]" />
          </div>
          <div className="flex flex-col">
            <span className="font-['Space_Grotesk'] text-lg font-bold text-[#f1f3fc] tracking-tight group-hover:text-[#99f7ff] transition-colors">LALA</span>
            <span className="text-[8px] font-['Space_Grotesk'] text-[#44484f] tracking-[0.3em] -mt-0.5">NEURAL_AUDIO</span>
          </div>
        </Link>
      </div>
       
      {/* Navigation */}
      <nav className="px-2 flex-1">
        <ul className="space-y-0.5">
          {menuItems.map((item) => {
            const active = isActive(item.href)
            const MenuIcon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 font-['Space_Grotesk'] font-medium transition-all duration-150 text-xs tracking-[0.15em] border-l-2
                    ${active 
                      ? 'text-[#99f7ff] border-[#99f7ff] bg-[#99f7ff]/5' 
                      : 'text-[#72757d] border-transparent hover:text-[#a8abb3] hover:bg-white/3 hover:border-[#99f7ff]/20'
                    }`}
                >
                  <MenuIcon size={18} className={active ? 'text-[#99f7ff]' : ''} />
                  <span>{item.name}</span>
                  {active && <div className="ml-auto w-1 h-1 bg-[#99f7ff] animate-pulse" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
       
      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#99f7ff]/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#00f1fe] animate-pulse" />
          <span className="text-[9px] text-[#44484f] font-['Space_Grotesk'] tracking-[0.2em]">SYS_ACTIVE v3.0</span>
        </div>
      </div>
    </div>
  )
}
