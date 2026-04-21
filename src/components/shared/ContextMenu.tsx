'use client'

import React, { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'

export interface ContextMenuItem {
  key: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
  hasSubmenu?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  isOpen: boolean
  onClose: () => void
  items: ContextMenuItem[]
  position: { x: number; y: number } | 'top-right' | 'center'
}

export default function ContextMenu({ isOpen, onClose, items, position }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Calculate generic positioning styles based on the 'position' prop
  let positionStyles: React.CSSProperties = {}
  
  if (position === 'top-right') {
    positionStyles = { top: '80px', right: '32px' }
  } else if (position === 'center') {
    positionStyles = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else {
    // Prevent menu from going off-screen
    const x = Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 300 : position.x)
    const y = Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 400 : position.y)
    positionStyles = { top: `${y}px`, left: `${x}px` }
  }

  return (
    <>
      {/* Invisible overlay to catch clicks */}
      <div className="fixed inset-0 z-[110]" onClick={onClose} />
      
      <div 
        ref={menuRef}
        style={positionStyles}
        className="fixed w-[280px] bg-[#1a1b26]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 flex flex-col z-[111] animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="h-px bg-white/10 my-2" />
            }

            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => {
                  item.onClick()
                  if (!item.hasSubmenu) onClose()
                }}
                className="w-full flex items-center px-5 py-3 hover:bg-white/10 transition text-left group"
              >
                {Icon && (
                  <div className="w-8 shrink-0 flex items-center text-gray-400 group-hover:text-blue-400 transition-colors">
                    <Icon size={20} />
                  </div>
                )}
                <span className="flex-1 text-[15px] font-medium text-gray-200 group-hover:text-white transition-colors">
                  {item.label}
                </span>
                {item.hasSubmenu && (
                  <ChevronRight size={18} className="text-gray-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
