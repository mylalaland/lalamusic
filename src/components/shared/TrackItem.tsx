import React from 'react'
import { Music, Play, Disc3, Plus, Clock } from 'lucide-react'

interface TrackItemProps {
  track: any
  isActive: boolean
  isPlaying: boolean
  index: number
  variant: 'desktop' | 'mobile'
  onPlay: (track: any) => void
  onAddPlaylist?: (track: any, e: React.MouseEvent) => void
}

export default function TrackItem({
  track,
  isActive,
  isPlaying,
  index,
  variant,
  onPlay,
  onAddPlaylist
}: TrackItemProps) {
  
  if (variant === 'desktop') {
    return (
      <div
        onDoubleClick={() => onPlay(track)}
        className={`group grid grid-cols-[auto_1fr_auto_100px] gap-4 items-center px-4 py-2 hover:bg-white/10 rounded-md transition cursor-pointer select-none ${isActive ? 'bg-white/10 text-blue-500' : 'text-gray-300'}`}
      >
        <div className="w-8 text-center text-gray-500 group-hover:hidden">
          {isActive && isPlaying ? <Disc3 size={16} className="animate-spin text-blue-500 mx-auto"/> : index + 1}
        </div>
        <div className="w-8 justify-center hidden group-hover:flex">
          <button onClick={() => onPlay(track)}>
            <Play size={16} fill="currentColor" className={isActive ? 'text-blue-500' : 'text-white'}/>
          </button>
        </div>
        
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center shrink-0 border border-white/10 overflow-hidden">
            {track.cover_art || track.thumbnail_link 
              ? <img src={track.cover_art || track.thumbnail_link} className="w-full h-full object-cover" alt=""/>
              : <Music size={16} className="text-gray-500"/>
            }
          </div>
          <div className="flex flex-col truncate">
            <span className={`font-semibold truncate ${isActive ? 'text-blue-500' : 'text-white'}`}>
              {track.title || track.name?.replace(/\.(mp3|wav|flac|m4a)$/i, '') || track.file_name?.replace(/\.[^.]+$/, '')}
              {track._bookmarkObj && <span className="ml-2 text-xs text-blue-400 bg-white/10 px-2 py-0.5 rounded-full">{Math.floor(track._bookmarkObj.position / 60)}:{String(Math.floor(track._bookmarkObj.position % 60)).padStart(2, '0')}</span>}
            </span>
            <span className="text-sm text-gray-400 truncate">{track._bookmarkObj?.bookmark_title || track.artist || 'Unknown'}</span>
          </div>
        </div>
        
        <div className="hidden lg:block w-48 text-sm text-gray-400 truncate">
          {track.album || '-'}
        </div>
        
        <div className="text-sm text-gray-400 text-center">
          {track.duration ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '-'}
        </div>
      </div>
    )
  }

  // Mobile Variant
  return (
    <div onClick={() => onPlay(track)} className="flex items-center gap-3 p-2.5 hover:bg-white/10 rounded-xl cursor-pointer group">
      <div className="w-12 h-12 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-white/5 relative">
          {(isActive && isPlaying) && (
             <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg backdrop-blur-[2px]">
                <Disc3 size={20} className="text-blue-400 animate-spin" />
             </div>
          )}
          {track.cover_art || track.thumbnail_link 
            ? <img src={track.cover_art || track.thumbnail_link} className="w-full h-full object-cover"/> 
            : <Music size={20} className="text-gray-600" />
          }
      </div>
      <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isActive ? 'text-blue-400 font-bold' : 'text-gray-200'}`}>
            {track.title || track.name?.replace(/\.(mp3|wav|flac|m4a)$/i, '')}
            {track._bookmarkObj && <span className="ml-2 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">{Math.floor(track._bookmarkObj.position / 60)}:{String(Math.floor(track._bookmarkObj.position % 60)).padStart(2, '0')}</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
              {(track._bookmarkObj?.bookmark_title || track.artist) && <span className="text-blue-400/80">{track._bookmarkObj?.bookmark_title || track.artist}</span>}
              {track.album && <span>• {track.album}</span>}
          </div>
      </div>
      {onAddPlaylist && (
         <button onClick={(e) => onAddPlaylist(track, e)} className="p-2 text-gray-500 hover:text-white transition">
           <Plus size={20}/>
         </button>
      )}
    </div>
  )
}
