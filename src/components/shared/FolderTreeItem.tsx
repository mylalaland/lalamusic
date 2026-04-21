import React, { useState } from 'react'
import { ChevronDown, ChevronRight, CheckSquare, Square, Folder } from 'lucide-react'

interface FolderTreeItemProps {
  node: any
  level: number
  allFolders: any[]
  selectedIds: string[]
  onSelect: (node: any) => void
  onToggleSelect: (id: string) => void
}

export default function FolderTreeItem({ 
  node, level, allFolders, selectedIds, onSelect, onToggleSelect 
}: FolderTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const children = allFolders.filter(f => f.parent_id === node.id)
  const hasChildren = children.length > 0
  const isSelected = selectedIds.includes(node.id)

  return (
    <div className="select-none relative">
      {/* 계층 가이드라인 (트리 구조 시각화) */}
      {level > 0 && (
          <>
            {/* 세로선 */}
            <div className="absolute top-0 bottom-0 border-l border-gray-700 pointer-events-none" 
                 style={{ left: `${(level - 1) * 24 + 12}px` }} />
            {/* 가로선 */}
            <div className="absolute top-3 w-3 border-t border-gray-700 pointer-events-none" 
                 style={{ left: `${(level - 1) * 24 + 12}px` }} />
          </>
      )}

      <div 
        className={`flex items-center gap-2 p-1.5 hover:bg-gray-800/80 rounded-lg transition-colors group relative ${isSelected ? 'bg-blue-900/30' : ''}`}
        style={{ paddingLeft: `${level * 24 + (level > 0 ? 8 : 0)}px` }}
      >
        {/* 확장/축소 버튼 */}
        <div onClick={(e) => { e.stopPropagation(); hasChildren && setIsOpen(!isOpen); }} className="p-0.5 cursor-pointer z-10 w-5 h-5 flex items-center justify-center">
            {hasChildren ? (
                isOpen ? <ChevronDown size={14} className="text-gray-400"/> : <ChevronRight size={14} className="text-gray-400"/>
            ) : ( <div className="w-3.5" /> )}
        </div>

        {/* 체크박스 (다중 선택용) */}
        <button onClick={(e) => { e.stopPropagation(); onToggleSelect(node.id); }} className="text-gray-500 hover:text-white">
            {isSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} />}
        </button>
        
        {/* 폴더 아이콘 및 이름 */}
        <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(node)}>
            <Folder size={18} className={children.length > 0 ? "text-blue-400" : "text-yellow-500"} fill="currentColor" fillOpacity={0.2} />
            <span className={`text-sm truncate ${isSelected ? 'text-blue-200 font-bold' : 'text-gray-300 group-hover:text-white'}`}>
                {node.name}
            </span>
        </div>
      </div>

      {isOpen && children.map(child => (
        <FolderTreeItem 
            key={child.id} node={child} level={level + 1} 
            allFolders={allFolders} selectedIds={selectedIds}
            onSelect={onSelect} onToggleSelect={onToggleSelect} 
        />
      ))}
    </div>
  )
}
