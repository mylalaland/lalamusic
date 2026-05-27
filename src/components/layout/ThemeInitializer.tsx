'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

export default function ThemeInitializer() {
  const themeColor = useSettingsStore(state => state.themeColor)

  useEffect(() => {
    if (!themeColor) return

    // var(--tertiary) 등으로 들어온 경우 브라우저 기본 CSS 변수 상속 유지
    if (themeColor.startsWith('var(')) {
      if (themeColor.includes('--tertiary')) {
        document.documentElement.style.setProperty('--tertiary', '#a93914')
      } else if (themeColor.includes('--primary')) {
        document.documentElement.style.setProperty('--tertiary', '#5f5e5e')
      }
    } else {
      // 헥스 컬러가 지정되었을 때, 전체 Accent를 변경하기 위해 --tertiary 변수를 재정의
      document.documentElement.style.setProperty('--tertiary', themeColor)
    }
  }, [themeColor])

  return null
}
