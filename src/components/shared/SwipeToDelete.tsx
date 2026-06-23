'use client'

import React, { useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { Trash2 } from 'lucide-react'

const TrashIcon = Trash2 as any

interface SwipeToDeleteProps {
  children: React.ReactNode
  onDelete: () => void
  /**
   * 삭제 버튼이 활성화되는 최소 스와이프 거리 (px)
   * 기본값: 80
   */
  threshold?: number
}

/**
 * SwipeToDelete — 좌측 스와이프로 삭제 버튼을 노출하는 래퍼 컴포넌트
 * 
 * iOS 네이티브 UX와 유사한 삭제 패턴을 구현합니다.
 * - 왼쪽 스와이프 → 빨간 "삭제" 버튼 노출
 * - 삭제 버튼 클릭 → onDelete 콜백 호출
 * - 다른 곳 터치 → 자동 복귀
 */
export default function SwipeToDelete({ children, onDelete, threshold = 80 }: SwipeToDeleteProps) {
  const x = useMotionValue(0)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 배경 삭제 버튼의 opacity와 width
  const deleteOpacity = useTransform(x, [-threshold, -threshold * 0.3, 0], [1, 0.3, 0])
  const deleteWidth = useTransform(x, [-threshold * 1.5, -threshold, 0], [threshold * 1.5, threshold, 0])

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -threshold) {
      // 충분히 스와이프함 → 삭제 버튼 노출 상태 유지
      setIsOpen(true)
    } else {
      // 되돌리기
      setIsOpen(false)
    }
  }

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    // 삭제 애니메이션 후 콜백
    setIsOpen(false)
    onDelete()
  }

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden" 
      style={{ touchAction: 'pan-y' }}
    >
      {/* 뒤쪽 삭제 버튼 레이어 */}
      <motion.div 
        className="absolute top-0 right-0 bottom-0 flex items-center justify-center bg-red-500 z-0"
        style={{ width: isOpen ? threshold : deleteWidth, opacity: isOpen ? 1 : deleteOpacity }}
      >
        <button 
          onClick={handleDelete}
          className="flex flex-col items-center justify-center gap-1 text-white w-full h-full px-4 active:bg-red-600 transition-colors"
        >
          <TrashIcon size={18} />
          <span className="text-[10px] font-['Work_Sans'] font-bold tracking-wider uppercase">삭제</span>
        </button>
      </motion.div>

      {/* 메인 콘텐츠 (드래그 가능) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -threshold * 1.5, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: isOpen ? -threshold : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{ x }}
        className="relative z-10 bg-[var(--bg-surface)]"
      >
        {children}
      </motion.div>
    </div>
  )
}
