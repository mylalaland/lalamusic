'use client'

import React, { useState, useRef } from 'react'

interface SideIndexProps {
  items: string[]
  onSelect: (char: string) => void
}

export default function SideIndex({ items, onSelect }: SideIndexProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePointerInteraction = (e: React.PointerEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    const index = Math.floor((y / height) * items.length)
    
    if (index >= 0 && index < items.length) {
      if (activeIndex !== index) {
        setActiveIndex(index)
        onSelect(items[index])
      }
    }
  }

  return (
    <div 
      ref={containerRef}
      className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-50 touch-none w-6 py-4"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        handlePointerInteraction(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          handlePointerInteraction(e)
        }
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        setActiveIndex(null)
      }}
      onPointerCancel={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        setActiveIndex(null)
      }}
    >
      {items.map((item, idx) => (
        <div
          key={item}
          className={`text-[10px] font-bold h-4 flex items-center justify-center transition-all w-full
            ${activeIndex === idx 
              ? 'text-blue-500 scale-150 transform' 
              : 'text-blue-500/60 hover:text-blue-400 hover:scale-125'
            }`}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
