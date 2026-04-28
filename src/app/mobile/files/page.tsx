'use client'

import { useEffect, useState } from 'react'
import { getOfflineFiles, deleteOfflineFile } from '../../../lib/db/offline'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { Music, Trash2, Play, FolderClosed, RefreshCw, Shuffle } from 'lucide-react'

const Icon = {
  Music: Music as any,
  Trash2: Trash2 as any,
  Play: Play as any,
  FolderClosed: FolderClosed as any,
  RefreshCw: RefreshCw as any,
  Shuffle: Shuffle as any
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
        cover_art: file.cover_art,
        lyrics: file.lyrics,
        src: objectUrl,
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

  const handlePlayAll = () => {
    if (files.length === 0) return
    const playlist = files.map(f => ({
        id: f.id, name: f.name, artist: f.artist,
        thumbnailLink: f.thumbnailLink, cover_art: f.cover_art, lyrics: f.lyrics,
        src: URL.createObjectURL(f.blob), mimeType: f.mimeType
    }))
    setPlaylist(playlist)
    setTrack(playlist[0])
  }

  const handleShufflePlay = () => {
    if (files.length === 0) return
    const playlist = files.map(f => ({
        id: f.id, name: f.name, artist: f.artist,
        thumbnailLink: f.thumbnailLink, cover_art: f.cover_art, lyrics: f.lyrics,
        src: URL.createObjectURL(f.blob), mimeType: f.mimeType
    }))
    const shuffled = [...playlist].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled)
    setTrack(shuffled[0])
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('정말 삭제하시겠습니까?')) return
    await deleteOfflineFile(id)
    loadFiles()
  }

  return (
    <div className="min-h-screen analog-surface text-[var(--text-main)] pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-[color:var(--bg-surface)]/90 backdrop-blur-md z-20 border-b border-[var(--border-strong)]">
        <div className="px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon.FolderClosed size={24} className="text-[var(--tertiary)]" />
            <h1 className="text-2xl font-bold text-[var(--text-main)]">Offline Files</h1>
          </div>
          <button onClick={loadFiles} className="p-2 bg-[var(--bg-container-high)] rounded-full hover:bg-[var(--bg-container-highest)]"><Icon.RefreshCw size={20}/></button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center text-[color:var(--text-muted)]/80 mt-20">Loading...</div>
        ) : files.length === 0 ? (
          <div className="text-center text-[color:var(--text-muted)]/80 mt-20">저장된 파일이 없습니다.</div>
        ) : (
          <div className="space-y-2">
              {/* Play All / Shuffle 액션 바 */}
              <div className="flex gap-2 mb-3">
                  <button onClick={handlePlayAll} 
                          className="flex-1 py-3 bg-[var(--tertiary)]/10 text-[var(--tertiary)] rounded-xl font-bold hover:bg-[var(--tertiary)]/20 flex items-center justify-center gap-2 transition border border-[var(--tertiary)]/20">
                      <Icon.Play size={18} fill="currentColor"/> Play All ({files.length})
                  </button>
                  <button onClick={handleShufflePlay} 
                          className="w-14 bg-[var(--bg-container-high)] rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container-highest)] transition border border-[var(--border-strong)]">
                      <Icon.Shuffle size={22} />
                  </button>
              </div>

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
    </div>
  )
}