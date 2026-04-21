'use client'

import React, { useEffect, useRef } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

export interface SortOption {
  key: string
  label: string
}

interface SortPopupProps {
  isOpen: boolean
  onClose: () => void
  options: SortOption[]
  currentSort: string
  currentDirection: 'asc' | 'desc'
  onSortChange: (key: string, dir: 'asc' | 'desc') => void
  title?: string
}

export default function SortPopup({
  isOpen, onClose, options, currentSort, currentDirection, onSortChange, title = 'Sort'
}: SortPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[100] transition-opacity backdrop-blur-sm" />
      <div 
        ref={popupRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 max-h-[70vh] bg-[#1a1b26]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[101] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <span className="text-blue-500">↕</span> {title}
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition">
            <Check size={20} className="text-white" />
          </button>
        </div>

        {/* Options */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 p-2 custom-scrollbar">
          {options.map((option) => {
            const isSelected = currentSort === option.key
            return (
              <button
                key={option.key}
                onClick={() => {
                  if (isSelected) {
                    onSortChange(option.key, currentDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    onSortChange(option.key, 'asc')
                  }
                }}
                className={`w-full flex items-center px-4 py-3.5 rounded-xl transition text-left
                  ${isSelected ? 'bg-blue-500/10 text-blue-400' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
              >
                <div className="w-8 flex justify-center shrink-0">
                  {isSelected && (
                    currentDirection === 'asc' ? <ChevronDown size={18} /> : <ChevronUp size={18} />
                  )}
                </div>
                <span className={`flex-1 text-[15px] ${isSelected ? 'font-semibold' : ''}`}>
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
