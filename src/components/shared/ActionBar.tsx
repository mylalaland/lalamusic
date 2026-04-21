'use client'

import React from 'react'

export interface ActionButton {
  key: string
  icon: React.ComponentType<{ size?: number; className?: string; fill?: string }>
  label?: string
  onClick: () => void
  primary?: boolean
}

interface ActionBarProps {
  buttons: ActionButton[]
  className?: string
}

export default function ActionBar({ buttons, className = '' }: ActionBarProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {buttons.map((btn) => {
        const Icon = btn.icon
        return (
          <button
            key={btn.key}
            onClick={btn.onClick}
            title={btn.label}
            className={`
              flex items-center justify-center rounded-2xl transition shadow-lg
              ${btn.primary 
                ? 'w-[72px] h-[48px] bg-white text-black hover:bg-gray-200 active:scale-95' 
                : 'w-[64px] h-[48px] bg-[#2a2b36] text-white hover:bg-[#3a3b46] active:scale-95'
              }
            `}
          >
            <Icon 
              size={24} 
              fill={btn.primary && btn.key.includes('play') ? "currentColor" : "none"} 
              className={btn.primary ? "ml-0.5" : ""}
            />
          </button>
        )
      })}
    </div>
  )
}
