'use client'

import { useEffect, useState } from 'react'
import { getOfflineFiles, deleteOfflineFile } from '../../../lib/db/offline'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { Music, Trash2, Play, FolderClosed, RefreshCw } from 'lucide-react'

const Icon = {
  Music: Music as any,
  Trash2: Trash2 as any,
  Play: Play as any,
  FolderClosed: FolderClosed as any,
  RefreshCw: RefreshCw as any
}

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { setTrack, setPlaylist } = usePlayerStore()

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    setLoading(true)
    try {
        const data = await getOfflineFiles()
        // 최신순 정렬
        setFiles(data.sort((a: any, b: any) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()))
    } catch (e) {
        console.error(e)
    } finally {
        setLoading(false)
    }
  }

  const handlePlay = (file: any) => {
    // Blob을 URL로 변환하여 재생
    const objectUrl = URL.createObjectURL(file.blob)
    
    const track = {
        id: file.id,
        name: file.name,
        artist: file.artist,
        thumbnailLink: file.thumbnailLink,
        cover_art: file.cover_art, // [NEW] 저장된 앨범 아트
        lyrics: file.lyrics,       // [NEW] 저장된 가사
        src: objectUrl, // [중요] Blob URL 사용
        mimeType: file.mimeType
    }

    // 플레이리스트 구성 (현재 목록 전체)
    const playlist = files.map(f => ({
        id: f.id,
        name: f.name,
        artist: f.artist,
        thumbnailLink: f.thumbnailLink,
        cover_art: f.cover_art,
        lyrics: f.lyrics,
        src: URL.createObjectURL(f.blob),
        mimeType: f.mimeType
    }))

    setPlaylist(playlist)
    setTrack(track)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('정말 삭제하시겠습니까?')) return
    await deleteOfflineFile(id)
    loadFiles()
  }

  return (
    <div className="min-h-screen analog-surface text-[var(--text-main)] p-4 pb-32">
      <div className="flex items-center justify-between mb-6 pt-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon.FolderClosed className="text-[var(--tertiary)]" /> Offline Files
        </h1>
        <button onClick={loadFiles} className="p-2 bg-[var(--bg-container-high)] rounded-full hover:bg-[var(--bg-container-highest)]"><Icon.RefreshCw size={20}/></button>
      </div>

      {loading ? (
        <div className="text-center text-[color:var(--text-muted)]/80 mt-20">Loading...</div>
      ) : files.length === 0 ? (
        <div className="text-center text-[color:var(--text-muted)]/80 mt-20">저장된 파일이 없습니다.</div>
      ) : (
        <div className="space-y-2">
            {files.map(file => (
                <div key={file.id} onClick={() => handlePlay(file)} className="flex items-center gap-3 p-3 bg-[color:var(--bg-container)]/50 rounded-xl cursor-pointer hover:bg-[var(--bg-container-high)] transition border border-[var(--border-strong)]">
                    <div className="w-12 h-12 bg-[var(--bg-container-high)] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                        {file.thumbnailLink ? (
                            <img 
                                src={file.thumbnailLink} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                        ) : (
                            <Icon.Music size={20} className="text-[color:var(--text-muted)]/80"/>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-[var(--text-main)]">{file.name}</p>
                        <p className="text-xs text-[color:var(--text-muted)]/80">{file.artist} • {(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={(e) => handleDelete(e, file.id)} className="p-2 text-[color:var(--text-muted)]/80 hover:text-red-500"><Icon.Trash2 size={18}/></button>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}