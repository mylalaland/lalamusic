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
  { name: 'CONNECT',     href: '/desktop/connect',   icon: Icon.Globe,        label: '구글 드라이브' },
  { name: 'FAVORITES',   href: '/desktop/favorites', icon: Icon.Heart,        label: '좋아요' },
  { name: 'RECENTS',     href: '/desktop/recents',   icon: Icon.Clock,        label: '최근 재생' },
  { name: 'LIBRARY',     href: '/desktop/library',   icon: Icon.Library,      label: '라이브러리' },
  { name: 'LISTS',       href: '/desktop/lists',     icon: Icon.ListMusic,    label: '플레이리스트' },
  { name: 'FILES',       href: '/desktop/files',     icon: Icon.FolderClosed, label: '오프라인 파일' },
  { name: 'SETTINGS',    href: '/desktop/settings',  icon: Icon.Settings,     label: '설정' },
]

export default function DesktopSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    const desktopPath = `/desktop${href}`
    return pathname === href || pathname === desktopPath || pathname.startsWith(`${href}/`) || pathname.startsWith(`${desktopPath}/`)
  }

  return (
    <div className="h-full flex flex-col pt-6 analog-surface border-r border-[var(--border-light)]">
      {/* Logo */}
      <div className="px-5 mb-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 flex items-center justify-center rounded-sm bg-[var(--primary)] text-[var(--on-primary)] shadow-[var(--shadow-ambient)] transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              {/* Abstract Lobster Claws */}
              <path d="M4 12C4 8 8 4 12 4S20 8 20 12" />
              <path d="M12 4V20" />
              <circle cx="8" cy="8" r="2" />
              <circle cx="16" cy="8" r="2" />
              <path d="M6 16C8 16 9 18 9 20" />
              <path d="M18 16C16 16 15 18 15 20" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-['Noto_Serif'] text-lg font-bold text-[var(--text-main)] tracking-tight">LALA MUSIC</span>
            <span className="text-[8px] font-['Work_Sans'] text-[var(--tertiary)] tracking-[0.2em] uppercase font-bold mt-0.5">Precision Audio</span>
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
                  className={`flex items-center gap-3 px-3 py-2.5 font-['Work_Sans'] font-medium transition-all duration-150 text-xs tracking-[0.05em] rounded-md
                    ${active 
                      ? 'bg-[var(--bg-container-high)] text-[var(--text-main)] shadow-[var(--shadow-pressed)]' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container)]'
                    }`}
                >
                  <MenuIcon size={18} className={active ? 'text-[var(--tertiary)]' : 'text-[var(--primary)]'} />
                  <span>{item.name}</span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--tertiary)] shadow-[0_0_8px_var(--tertiary)]" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
       
      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--tertiary)]" />
          <span className="text-[9px] text-[var(--text-muted)] font-['Work_Sans'] tracking-[0.1em] uppercase">SYSTEM READY</span>
        </div>
      </div>
    </div>
  )
}
