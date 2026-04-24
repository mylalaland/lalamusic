'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, 
  Repeat, Repeat1, Mic2, ListMusic, Music, Gauge, ChevronUp, ChevronDown,
  Settings2, Bookmark, X, Moon
} from 'lucide-react'
import { usePlayerStore} from '@/lib/store/usePlayerStore'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { getExternalLyrics } from '@/app/actions/lyrics'
import { addBookmark } from '@/app/actions/bookmarks'
import { Equalizer } from '@/lib/audio/equalizer'
import { AnimatePresence, motion } from 'framer-motion'

const Icon = {
  Play: Play as any, Pause: Pause as any, SkipBack: SkipBack as any,
  SkipForward: SkipForward as any, Volume2: Volume2 as any, VolumeX: VolumeX as any,
  Shuffle: Shuffle as any, Repeat: Repeat as any, Repeat1: Repeat1 as any,
  Mic2: Mic2 as any, ListMusic: ListMusic as any, Music: Music as any,
  Gauge: Gauge as any, ChevronUp: ChevronUp as any, ChevronDown: ChevronDown as any,
  Settings2: Settings2 as any, Bookmark: Bookmark as any, X: X as any, Moon: Moon as any
}

// 가사 캐시 (메모리)
const lyricsCache = new Map<string, string | null>()

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function parseLRC(lrc: string) {
  const lines = lrc.split('\n')
  const result: { time: number, text: string }[] = []
  const timeRegex = /\[\s*(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\s*\]/
  for (const line of lines) {
    const match = line.match(timeRegex)
    if (match) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseFloat(match[2] + '.' + (match[3] || '0'))
      const time = minutes * 60 + seconds
      const text = line.replace(timeRegex, '').trim()
      result.push({ time, text })
    }
  }
  return result.length > 0 ? result.sort((a, b) => a.time - b.time) : null
}

function getFormatFromMime(mimeType?: string, fileName?: string) {
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'M4A';
    if (lower.endsWith('.flac')) return 'FLAC';
    if (lower.endsWith('.mp3')) return 'MP3';
    if (lower.endsWith('.wav')) return 'WAV';
    if (lower.endsWith('.aac')) return 'AAC';
  }
  if (!mimeType) return 'AUDIO'
  const map: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3',
    'audio/flac': 'FLAC', 'audio/x-flac': 'FLAC',
    'audio/wav': 'WAV', 'audio/x-wav': 'WAV',
    'audio/mp4': 'M4A', 'audio/x-m4a': 'M4A', 'audio/m4a': 'M4A',
    'audio/aac': 'AAC', 'audio/ogg': 'OGG', 'audio/opus': 'OPUS',
    'audio/aiff': 'AIFF', 'audio/x-aiff': 'AIFF',
    'audio/webm': 'WEBM', 'audio/wma': 'WMA', 'audio/x-ms-wma': 'WMA',
  }
  return map[mimeType] || mimeType.replace('audio/', '').toUpperCase()
}

export default function DesktopPlayer() {
  const { 
    currentTrack: track, playlist, setTrack, isPlaying, togglePlay, 
    playNext, playPrev, isExpanded, setExpanded, updateTrackMetadata,
    eqGains, setEqGain
  } = usePlayerStore()

  const audioRef = useRef<HTMLAudioElement>(null)
  const activeLyricRef = useRef<HTMLParagraphElement>(null)
  const activeTrackRef = useRef<HTMLDivElement>(null)
  const seekTimeRef = useRef<number>(0)
  const equalizerRef = useRef<Equalizer | null>(null)
  const retryCountRef = useRef(0)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [isShuffle, setIsShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [isSeeking, setIsSeeking] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [localCoverArt, setLocalCoverArt] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [displayLyrics, setDisplayLyrics] = useState<string | null>(null)
  const [parsedLyrics, setParsedLyrics] = useState<{time: number, text: string}[] | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [expandedView, setExpandedView] = useState<'art' | 'lyrics' | 'queue' | 'eq'>('lyrics')
  const [sleepTimer, setSleepTimer] = useState(0)
  const [lyricsFontSize, setLyricsFontSize] = useState(18) // px, 10~50 range, step 4

  // ============================================================
  // 오디오 엔진 — 곡 변경 시 로드 + 재생
  // ============================================================
  useEffect(() => {
    if (!track) return
    setCurrentTime(0)
    setMetaLoading(false)

    // 메타데이터 로드
    const fetchMeta = async () => {
      const { getOfflineMetadata, saveOfflineMetadata } = await import('@/lib/db/offline')
      const offlineMeta = await getOfflineMetadata(track.id).catch(() => null)
      if (offlineMeta) {
        if (offlineMeta.cover_art) setLocalCoverArt(offlineMeta.cover_art)
        else setLocalCoverArt(null)
        return
      }
      setLocalCoverArt(null)
      setMetaLoading(true)
      try {
        const result = await analyzeMusicMetadata(track.id)
        if (result.success && result.data) {
          updateTrackMetadata(track.id, result.data)
          if (result.heavyMetadata) {
            await saveOfflineMetadata(track.id, result.heavyMetadata)
            if (result.heavyMetadata.cover_art) setLocalCoverArt(result.heavyMetadata.cover_art)
          }
        }
      } catch (e) { console.error(e) }
      finally { setMetaLoading(false) }
    }
    fetchMeta()

    // 오디오 소스설정
    if (audioRef.current) {
      const newSrc = ((track as any).src && ((track as any).src.startsWith('http') || (track as any).src.startsWith('blob')))
        ? (track as any).src
        : `/api/stream?id=${track.id}&mimeType=${encodeURIComponent(track.mimeType || '')}&name=${encodeURIComponent(track.name || track.title || 'music.mp3')}`
      
      if (audioRef.current.src.indexOf(track.id) === -1) {
        audioRef.current.crossOrigin = "anonymous"
        audioRef.current.src = newSrc
        audioRef.current.playbackRate = playbackRate
        audioRef.current.volume = isMuted ? 0 : volume
        retryCountRef.current = 0
        audioRef.current.load()
        if ((track as any).initialPosition) audioRef.current.currentTime = (track as any).initialPosition
        // We do NOT call play() here synchronously. We wait for onCanPlay mapping!
      }
    }
  }, [track?.id])

  // 재생 상태 리스너 (강제 동기화)
  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      if (equalizerRef.current && equalizerRef.current.audioContext.state === 'suspended') {
        equalizerRef.current.audioContext.resume()
      }
      audioRef.current.play().catch((e) => {
         console.warn("Audio play blocked by browser:", e)
      })
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, track?.id]) // Added track?.id so it acts on new track loads if isPlaying remains true

  // EQ 초기화 — canplaythrough에서 안전하게 한번만 생성
  useEffect(() => {
    if (!audioRef.current) return
    const audio = audioRef.current
    const initEQ = () => {
      if (!equalizerRef.current && audio) {
        try {
          equalizerRef.current = new Equalizer(audio)
          // 현재 EQ gains 적용
          eqGains.forEach((g, i) => equalizerRef.current!.setGain(i, g))
          const effectiveVolume = (isMuted || volume < 0.01) ? 0 : volume
          equalizerRef.current.setVolume(effectiveVolume)
          audio.volume = 1
        } catch(e) { console.warn('EQ init failed:', e) }
      }
    }
    audio.addEventListener('canplaythrough', initEQ, { once: true })
    return () => audio.removeEventListener('canplaythrough', initEQ)
  }, [track?.id])

  // 볼륨 & 재생속도 동기화
  useEffect(() => {
    if (!audioRef.current) return
    const effectiveVolume = (isMuted || volume < 0.01) ? 0 : volume
    if (equalizerRef.current) {
      equalizerRef.current.setVolume(effectiveVolume)
      audioRef.current.volume = 1
    } else {
      audioRef.current.volume = effectiveVolume
    }
    audioRef.current.playbackRate = playbackRate
  }, [volume, isMuted, playbackRate])

  useEffect(() => {
    if (equalizerRef.current) {
      eqGains.forEach((g, i) => equalizerRef.current!.setGain(i, g))
    }
  }, [eqGains])

  // ============================================================
  // 가사 4단계 폭포식 로딩
  // ============================================================
  useEffect(() => {
    if (!track) return
    const loadLyrics = async () => {
      if (lyricsCache.has(track.id)) {
        const cached = lyricsCache.get(track.id)
        if (cached) { setDisplayLyrics(cached); return }
        setDisplayLyrics(null); return
      }
      setLyricsLoading(true)
      setDisplayLyrics(null)

      const { getOfflineMetadata } = await import('@/lib/db/offline')
      const offlineMeta = await getOfflineMetadata(track.id).catch(() => null)
      const embeddedLyrics = (offlineMeta?.lyrics) || 
        (track.lyrics && !track.lyrics.includes('[object Object]') ? track.lyrics : null)
      const isEmbeddedSynced = embeddedLyrics && /\[\d{1,3}:\d{2}/.test(embeddedLyrics)

      if (isEmbeddedSynced) {
        lyricsCache.set(track.id, embeddedLyrics)
        setDisplayLyrics(embeddedLyrics)
        setLyricsLoading(false)
        return
      }

      // 파일명에서 아티스트/제목 파싱 ("001 IVE (아이브)-01-BANG BANG.flac" → artist: IVE, title: BANG BANG)
      let searchArtist = track.artist || ''
      let searchTitle = track.title || track.name || ''
      // 확장자 제거
      searchTitle = searchTitle.replace(/\.(mp3|flac|m4a|wav|aac|ogg|wma|opus)$/i, '')
      // 넘버링 제거 (앞쪽 "001 ", "01-" 등)
      searchTitle = searchTitle.replace(/^\d{1,4}[\s._-]+/, '')
      // "아티스트-번호-제목" or "아티스트 - 제목" 패턴
      if (!searchArtist || searchArtist === 'Unknown' || searchArtist === 'Google Drive') {
        const dashSplit = searchTitle.split(/[-–—]/)
        if (dashSplit.length >= 2) {
          searchArtist = dashSplit[0].replace(/\(.*?\)/g, '').trim()
          // 마지막 부분을 제목으로 (중간에 트랙번호가 있을 수 있으므로)
          searchTitle = dashSplit[dashSplit.length - 1].trim()
          // 중간 부분이 숫자면 스킵
          if (dashSplit.length >= 3 && /^\d+$/.test(dashSplit[1].trim())) {
            searchTitle = dashSplit.slice(2).join('-').trim()
          }
        }
      }

      const externalResult = await getExternalLyrics(
        searchArtist, searchTitle, 
        (track as any).duration, ['Alsong', 'LRCLIB']
      )

      if (externalResult.success && externalResult.syncedLyrics) {
        lyricsCache.set(track.id, externalResult.syncedLyrics)
        setDisplayLyrics(externalResult.syncedLyrics)
        setLyricsLoading(false)
        return
      }
      if (embeddedLyrics) {
        lyricsCache.set(track.id, embeddedLyrics)
        setDisplayLyrics(embeddedLyrics)
        setLyricsLoading(false)
        return
      }
      if (externalResult.success && externalResult.plainLyrics) {
        lyricsCache.set(track.id, externalResult.plainLyrics)
        setDisplayLyrics(externalResult.plainLyrics)
        setLyricsLoading(false)
        return
      }
      lyricsCache.set(track.id, null)
      setDisplayLyrics(null)
      setLyricsLoading(false)
    }
    loadLyrics()
  }, [track?.id, track?.lyrics])

  // 가사 파싱
  useEffect(() => {
    if (displayLyrics) { setParsedLyrics(parseLRC(displayLyrics)) }
    else { setParsedLyrics(null) }
    setCurrentLyricIndex(-1)
  }, [displayLyrics])

  // 가사 싱크
  useEffect(() => {
    if (!parsedLyrics) return
    let activeIdx = -1
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTime + 0.2) { activeIdx = i } else { break }
    }
    if (activeIdx !== currentLyricIndex) { setCurrentLyricIndex(activeIdx) }
  }, [currentTime, parsedLyrics])

  // 가사 스크롤
  useEffect(() => {
    if (isExpanded && expandedView === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLyricIndex, isExpanded, expandedView])

  // Queue 스크롤
  useEffect(() => {
    if (isExpanded && expandedView === 'queue' && activeTrackRef.current) {
      activeTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isExpanded, expandedView, track?.id])

  // 오디오 이벤트
  const handleTimeUpdate = () => { 
    if (audioRef.current && !isSeeking) {
      setCurrentTime(audioRef.current.currentTime)
      seekTimeRef.current = audioRef.current.currentTime
    }
  }
  const handleLoadedMetadata = () => { 
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration)
    } else if ((track as any)?.duration) {
      setDuration((track as any).duration)
    }
  }
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
    setIsSeeking(true)
    setCurrentTime(time)
    seekTimeRef.current = time
  }
  const handleSeekEnd = () => {
    if (audioRef.current) audioRef.current.currentTime = seekTimeRef.current
    setIsSeeking(false)
  }

  // 다음/이전 곡
  const handleNextWrapped = useCallback(() => {
    if (!track) return
    if (repeatMode === 'one') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}) }
      return
    }
    if (isShuffle && playlist.length > 0) {
      setTrack(playlist[Math.floor(Math.random() * playlist.length)])
    } else {
      const idx = playlist.findIndex(p => p.id === track.id)
      const isLast = idx === playlist.length - 1
      if (isLast) {
        if (repeatMode === 'all') setTrack(playlist[0])
        else { if (isPlaying) togglePlay() }
      } else { playNext() }
    }
  }, [track, repeatMode, isShuffle, playlist, isPlaying])

  const handlePrevWrapped = useCallback(() => {
    if (currentTime > 3 && audioRef.current) { audioRef.current.currentTime = 0 }
    else { playPrev() }
  }, [currentTime])

  const toggleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 0.5]
    setPlaybackRate(speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length])
  }
  const toggleRepeat = () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one']
    setRepeatMode(modes[(modes.indexOf(repeatMode) + 1) % modes.length])
  }
  const toggleSleepTimer = () => {
    const times = [0, 15, 30, 60]
    setSleepTimer(times[(times.indexOf(sleepTimer) + 1) % times.length])
  }

  const handleAudioError = () => {
    if (!audioRef.current || !track) return
    if (retryCountRef.current < 3) {
      retryCountRef.current += 1
      audioRef.current.src = audioRef.current.src
      audioRef.current.load()
      if (isPlaying) audioRef.current.play().catch(() => {})
    }
  }

  // Media Session
  useEffect(() => {
    if (!track || !navigator.mediaSession) return
    const title = track.title || track.name?.replace(/\.(mp3|wav|flac|m4a)$/i, '') || 'Unknown'
    const artist = track.artist || 'Unknown Artist'
    const album = track.album || 'Lala Music'
    const artwork: MediaImage[] = []
    let mediaArt = localCoverArt || track.cover_art || track.thumbnailLink || null
    if (typeof mediaArt === 'string' && !mediaArt.includes('[object Object]')) {
      artwork.push({ src: mediaArt, sizes: '512x512', type: 'image/png' })
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album, artwork })
    try {
      navigator.mediaSession.setActionHandler('play', () => togglePlay())
      navigator.mediaSession.setActionHandler('pause', () => togglePlay())
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevWrapped())
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNextWrapped())
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        if (d.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = d.seekTime
          setCurrentTime(d.seekTime)
        }
      })
    } catch (e) {}
  }, [track, localCoverArt])

  // Sleep timer
  useEffect(() => {
    if (sleepTimer === 0) return
    const timer = setTimeout(() => { if (isPlaying) togglePlay(); setSleepTimer(0) }, sleepTimer * 60 * 1000)
    return () => clearTimeout(timer)
  }, [sleepTimer])

  const displayTitle = track?.title || track?.name?.replace(/\.(mp3|wav|flac|m4a|ogg|aac|wma)$/i, '') || 'Unknown'
  let displayArt = localCoverArt || track?.cover_art || track?.thumbnailLink || (track as any)?.thumbnail_link || null
  if (typeof displayArt === 'string' && displayArt.includes('[object Object]')) displayArt = null
  const validDuration = (duration && isFinite(duration) && duration > 0) ? duration : ((track as any)?.duration || 0)
  const progressPercent = (currentTime / (validDuration || 1)) * 100
  const hasLyrics = displayLyrics && displayLyrics.length > 0
  const audioFormat = getFormatFromMime(track?.mimeType ?? undefined, track?.name || track?.title)

  // Media Session API 동기화
  useEffect(() => {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTitle,
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Lala Music',
        artwork: displayArt ? [
          { src: displayArt, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      })

      navigator.mediaSession.setActionHandler('play', () => { togglePlay() })
      navigator.mediaSession.setActionHandler('pause', () => { togglePlay() })
      navigator.mediaSession.setActionHandler('previoustrack', () => { playPrev() })
      navigator.mediaSession.setActionHandler('nexttrack', () => { playNext() })
    }
  }, [track, displayArt, displayTitle])

  return (
    <>
      {!track ? (
        <div className="h-[80px] flex items-center justify-center analog-surface border-t border-[var(--border-light)]">
          <span className="text-[11px] font-['Work_Sans'] text-[var(--text-muted)] tracking-[0.2em] font-bold uppercase">NO ARTWORK</span>
        </div>
      ) : (
        <>
          <audio 
            ref={audioRef} preload="auto" playsInline 
            onTimeUpdate={handleTimeUpdate} 
            onLoadedMetadata={handleLoadedMetadata} 
            onEnded={handleNextWrapped}
            onError={handleAudioError}
          />

      {/* ==================== 하단 바 (항상 표시) ==================== */}
      <div 
        className="h-[80px] flex items-center justify-between px-4 relative z-50 shrink-0 analog-surface border-t border-[var(--border-light)]"
      >
        {/* 상단 프로그레스 */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--bg-container-highest)]">
          <div className="h-full bg-[var(--tertiary)] transition-all duration-200" style={{ width: `${progressPercent}%` }} />
          <input type="range" min={0} max={validDuration || 100} step="any" value={currentTime}
            onChange={handleSeekChange} onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
            className="absolute top-0 left-0 w-full h-3 -translate-y-1 opacity-0 cursor-pointer z-20" />
        </div>

        {/* 좌측: 곡 정보 (클릭하면 확장) */}
        <div className="flex items-center gap-3 w-[30%] min-w-[220px] cursor-pointer group" onClick={() => setExpanded(!isExpanded)}>
          <div className="w-12 h-12 bg-[var(--bg-container)] border border-[var(--border-strong)] shrink-0 overflow-hidden flex items-center justify-center relative shadow-[var(--shadow-ambient)] rounded-sm">
            {displayArt ? (
              <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
            ) : (
              <Icon.Music size={18} className="text-[var(--text-muted)] opacity-50" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-['Noto_Serif'] font-bold text-[var(--text-main)] truncate tracking-tight group-hover:text-[var(--tertiary)] transition-colors">
                {displayTitle}
              </span>
              <span className="text-[9px] font-['Work_Sans'] text-[var(--tertiary)] bg-[var(--tertiary)]/10 px-1.5 py-0.5 border border-[var(--tertiary)]/20 shrink-0 rounded-sm font-bold uppercase tracking-wider">
                {audioFormat}
              </span>
            </div>
            <span className="font-['Work_Sans'] text-xs text-[var(--text-muted)] truncate">{track.artist || 'Unknown'}</span>
          </div>
          <button className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shrink-0">
            {isExpanded ? <Icon.ChevronDown size={18} /> : <Icon.ChevronUp size={18} />}
          </button>
        </div>

        {/* 중앙: 컨트롤 */}
        <div className="flex flex-col items-center justify-center w-[40%] max-w-[600px]">
          <div className="flex items-center gap-5 mb-1.5">
            <button onClick={() => setIsShuffle(!isShuffle)} className={`transition-colors ${isShuffle ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
              <Icon.Shuffle size={16} />
            </button>
            <button onClick={handlePrevWrapped} className="text-[var(--primary)] hover:text-[var(--tertiary)] transition active:scale-90">
              <Icon.SkipBack size={20} fill="currentColor" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center bg-[var(--primary)] text-[var(--on-primary)] rounded-full hover:scale-105 active:scale-95 transition-all shadow-[var(--shadow-ambient)]"
            >
              {isPlaying ? <Icon.Pause size={18} fill="currentColor" /> : <Icon.Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={handleNextWrapped} className="text-[var(--primary)] hover:text-[var(--tertiary)] transition active:scale-90">
              <Icon.SkipForward size={20} fill="currentColor" />
            </button>
            <button onClick={toggleRepeat} className={`transition-colors ${repeatMode !== 'off' ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
              {repeatMode === 'one' ? <Icon.Repeat1 size={16} /> : <Icon.Repeat size={16} />}
            </button>
          </div>
          <div className="w-full flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-['Work_Sans'] font-medium">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-[var(--bg-container-highest)] rounded-full relative cursor-pointer overflow-hidden group/seek shadow-[var(--shadow-pressed)]">
              <div className="absolute inset-y-0 left-0 bg-[var(--tertiary)] rounded-full" style={{ width: `${progressPercent}%` }} />
              <input type="range" min={0} max={validDuration || 100} step="any" value={currentTime}
                onChange={handleSeekChange} onMouseUp={handleSeekEnd}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>
            <span className="w-10">{formatTime(validDuration)}</span>
          </div>
        </div>

        {/* 우측: 볼륨 + 부가 */}
        <div className="flex items-center justify-end gap-2 w-[30%] min-w-[200px] text-[var(--text-muted)]">
          <button onClick={() => setExpandedView('lyrics')} className={`p-1.5 transition-colors ${expandedView === 'lyrics' && isExpanded ? 'text-[var(--tertiary)]' : 'hover:text-[var(--text-main)]'}`}>
            <Icon.Mic2 size={16} />
          </button>
          <button onClick={() => { setExpandedView('queue'); if(!isExpanded) setExpanded(true) }} className={`p-1.5 transition-colors ${expandedView === 'queue' && isExpanded ? 'text-[var(--tertiary)]' : 'hover:text-[var(--text-main)]'}`}>
            <Icon.ListMusic size={16} />
          </button>
          <button onClick={() => { setExpandedView('eq'); if(!isExpanded) setExpanded(true) }} className={`p-1.5 transition-colors ${expandedView === 'eq' && isExpanded ? 'text-[var(--tertiary)]' : 'hover:text-[var(--text-main)]'}`}>
            <Icon.Settings2 size={16} />
          </button>
          <div className="w-[1px] h-5 bg-[var(--border-strong)] mx-1 opacity-50" />
          <button onClick={() => setIsMuted(!isMuted)} className="hover:text-[var(--text-main)] transition-colors">
            {isMuted || volume === 0 ? <Icon.VolumeX size={16} /> : <Icon.Volume2 size={16} />}
          </button>
          <div className="flex items-center w-24 relative group/vol">
            <div className="flex-1 h-1 bg-[var(--bg-container-highest)] rounded-full relative overflow-hidden shadow-[var(--shadow-pressed)]">
              <div className="absolute inset-y-0 left-0 bg-[var(--primary)] rounded-full" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
            </div>
            <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} 
              onChange={(e) => { setVolume(Number(e.target.value)); if(isMuted) setIsMuted(false) }} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <button onClick={toggleSpeed} className="text-[10px] font-['Work_Sans'] font-medium hover:text-[var(--text-main)] px-1.5 py-0.5 border border-[var(--border-strong)] rounded-sm hover:bg-[var(--bg-container)] transition-all">
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* ==================== 확장 패널 (가사/QUE/EQ/ART) ==================== */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'calc(100vh - 80px)', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-[80px] left-0 right-0 z-40 overflow-hidden analog-surface"
          >
            <div className="w-full h-full flex relative">
              {/* 배경 텍스처 */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

              {/* 좌측: 앨범 아트 + 곡 정보 */}
              <div className="w-[400px] shrink-0 flex flex-col items-center justify-center p-8 relative z-10 border-r border-[var(--border-light)] bg-[var(--bg-container-low)]">
                {/* 앨범 아트 */}
                <div className="relative mb-6" style={{ width: 'min(300px, 28vw)' }}>
                  <div className="aspect-square w-full bg-[var(--bg-container)] border border-[var(--border-strong)] overflow-hidden relative shadow-[var(--shadow-ambient)] rounded-sm">
                    {displayArt ? (
                      <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Icon.Music size={48} className="text-[var(--text-muted)] opacity-30" />
                        <span className="text-[9px] font-['Work_Sans'] text-[var(--text-muted)] mt-3 tracking-[0.2em] uppercase font-bold">NO ARTWORK</span>
                      </div>
                    )}
                    {/* 포맷 뱃지 */}
                    <div className="absolute top-2 right-2 bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-strong)] px-2 py-0.5 rounded-sm">
                      <span className="text-[9px] font-['Work_Sans'] text-[var(--tertiary)] font-bold tracking-wider uppercase">{audioFormat}</span>
                    </div>
                    {metaLoading && (
                      <div className="absolute top-2 left-2 bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-strong)] px-2 py-0.5 rounded-sm flex items-center gap-1.5">
                        <Icon.Gauge size={10} className="text-[var(--tertiary)] animate-spin" />
                        <span className="text-[8px] font-['Work_Sans'] font-bold text-[var(--tertiary)] tracking-wider">ANALYZING</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 곡 정보 */}
                <div className="text-center max-w-[300px]">
                  <h2 className="font-['Noto_Serif'] text-xl font-bold text-[var(--text-main)] truncate tracking-tight mb-1">{displayTitle}</h2>
                  <p className="font-['Work_Sans'] text-sm text-[var(--tertiary)] truncate font-medium uppercase tracking-wider">{track.artist || 'Unknown Artist'}</p>
                  {track.album && <p className="font-['Work_Sans'] text-xs text-[var(--text-muted)] truncate mt-1.5">{track.album}</p>}
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={async () => {
                      if (audioRef.current) {
                        const res = await addBookmark(track.id, audioRef.current.currentTime)
                        if (res.success) alert('북마크 저장!')
                        else alert('실패: ' + res.error)
                      }
                    }}
                    className="p-2 border border-[var(--border-strong)] rounded-full text-[var(--text-muted)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] hover:bg-[var(--tertiary)]/5 transition-all shadow-sm bg-[var(--bg-surface)]"
                  >
                    <Icon.Bookmark size={16} />
                  </button>
                  <button onClick={toggleSleepTimer} className={`p-2 border rounded-full transition-all shadow-sm bg-[var(--bg-surface)] ${sleepTimer > 0 ? 'text-[var(--tertiary)] border-[var(--tertiary)] bg-[var(--tertiary)]/10' : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] hover:bg-[var(--tertiary)]/5'}`}>
                    <Icon.Moon size={16} />
                  </button>
                </div>
                {sleepTimer > 0 && (
                  <span className="text-[9px] font-['Work_Sans'] font-bold text-[var(--tertiary)] mt-3 tracking-wider uppercase">{sleepTimer} min sleep</span>
                )}
              </div>

              {/* 우측: 탭 콘텐츠 */}
              <div className="flex-1 flex flex-col min-w-0 relative z-10 bg-[var(--bg-surface)]">
                {/* 탭 헤더 */}
                <div className="flex items-center gap-1 px-8 pt-6 pb-3 shrink-0 border-b border-[var(--border-light)] bg-[var(--bg-container-low)]">
                  {(['lyrics', 'queue', 'eq'] as const).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setExpandedView(tab)}
                      className={`px-4 py-2 text-[11px] font-['Work_Sans'] font-bold tracking-[0.15em] uppercase transition-all rounded-md ${expandedView === tab ? 'bg-[var(--bg-container-highest)] text-[var(--text-main)] shadow-sm border border-[var(--border-strong)]' : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-container)]'}`}
                    >
                      {tab === 'lyrics' ? 'Lyrics' : tab === 'queue' ? 'Queue' : 'Equalizer'}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button onClick={() => setExpanded(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-container)] rounded-md transition-colors">
                    <Icon.X size={18} />
                  </button>
                </div>

                {/* 탭 콘텐츠 */}
                <div className="flex-1 overflow-y-auto px-8 py-6 analog-scrollbar bg-[var(--bg-surface)] relative">
                  {expandedView === 'lyrics' ? (
                    /* ===== 가사 ===== */
                    <div className="text-center py-8 max-w-2xl mx-auto relative">
                      {/* 글자 크기 조절 */}
                      <div className="sticky top-0 z-20 flex items-center justify-end gap-1 mb-6 pb-2" style={{ background: 'linear-gradient(to bottom, var(--bg-surface) 60%, transparent)' }}>
                        <button onClick={() => setLyricsFontSize(s => Math.max(10, s - 4))}
                          className="w-7 h-7 flex items-center justify-center font-['Work_Sans'] text-[12px] font-bold text-[var(--text-muted)] border border-[var(--border-strong)] rounded-sm bg-[var(--bg-container)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition shadow-sm">A-</button>
                        <span className="font-['Work_Sans'] text-[11px] font-bold text-[var(--text-main)] tracking-wider w-8 text-center">{lyricsFontSize}</span>
                        <button onClick={() => setLyricsFontSize(s => Math.min(50, s + 4))}
                          className="w-7 h-7 flex items-center justify-center font-['Work_Sans'] text-[12px] font-bold text-[var(--text-muted)] border border-[var(--border-strong)] rounded-sm bg-[var(--bg-container)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] transition shadow-sm">A+</button>
                      </div>
                      <div className="space-y-5">
                      {hasLyrics ? (
                        parsedLyrics ? (
                          parsedLyrics.map((line, i) => (
                            <p 
                              key={i} 
                              ref={i === currentLyricIndex ? activeLyricRef : null}
                              style={{ fontSize: `${lyricsFontSize}px` }}
                              className={`font-['Noto_Serif'] font-bold transition-all duration-300 cursor-pointer leading-relaxed ${
                                i === currentLyricIndex 
                                  ? 'text-[var(--text-main)] scale-[1.03] opacity-100' 
                                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] opacity-50'
                              } ${line.text ? '' : 'h-4'}`}
                              onClick={() => { if (audioRef.current) audioRef.current.currentTime = line.time }}
                            >
                              {line.text}
                            </p>
                          ))
                        ) : (
                          displayLyrics!.split('\n').map((line: string, i: number) => (
                            <p key={i} style={{ fontSize: `${lyricsFontSize}px` }} className="font-['Noto_Serif'] text-[var(--text-muted)] leading-relaxed">{line}</p>
                          ))
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[40vh] text-[var(--text-muted)] space-y-4">
                          <Icon.Mic2 size={40} className={`opacity-40 ${lyricsLoading ? 'animate-pulse' : ''}`} />
                          <p className="text-xs font-['Work_Sans'] font-bold tracking-widest uppercase">
                            {lyricsLoading ? 'Searching Lyrics...' : 'No Lyrics Found'}
                          </p>
                        </div>
                      )}
                      </div>
                    </div>
                  ) : expandedView === 'queue' ? (
                    /* ===== 대기열 ===== */
                    <div className="space-y-1.5 max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-4 sticky top-0 py-2 z-10 bg-[var(--bg-surface)]">
                        <h3 className="font-['Work_Sans'] text-xs font-bold tracking-[0.15em] text-[var(--tertiary)] uppercase">Playback Queue <span className="text-[var(--text-muted)]">({playlist.length})</span></h3>
                      </div>
                      {playlist.map((t, i) => {
                        const art = t.cover_art || t.thumbnailLink || (t as any).thumbnail_link
                        const fmt = getFormatFromMime(t.mimeType ?? undefined, t.name || t.title)
                        return (
                          <div 
                            key={i}
                            ref={t.id === track.id ? activeTrackRef : null}
                            onClick={() => setTrack(t)}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-md border ${t.id === track.id ? 'bg-[var(--bg-container-high)] border-[var(--border-strong)] shadow-[var(--shadow-pressed)]' : 'border-transparent hover:bg-[var(--bg-container)] hover:border-[var(--border-light)]'}`}
                          >
                            <span className="w-6 text-center text-[11px] font-['Work_Sans'] font-bold text-[var(--text-muted)]">{i + 1}</span>
                            <div className="w-10 h-10 bg-[var(--bg-container)] border border-[var(--border-strong)] flex items-center justify-center shrink-0 overflow-hidden relative rounded-sm shadow-[var(--shadow-ambient)]">
                              <Icon.Music size={14} className="text-[var(--text-muted)] absolute opacity-50" />
                              {art && <img src={art} loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover relative z-10" onError={(e) => e.currentTarget.style.display='none'} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-['Noto_Serif'] text-sm truncate tracking-tight ${t.id === track.id ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-main)]'}`}>
                                {t.title || t.name?.replace(/\.[^.]+$/, '')}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)] truncate font-['Work_Sans'] uppercase font-medium mt-0.5">{t.artist || 'Unknown'}</p>
                            </div>
                            <span className="text-[9px] font-['Work_Sans'] font-bold text-[var(--text-muted)] tracking-wider uppercase px-2 py-0.5 bg-[var(--bg-container-high)] rounded-sm border border-[var(--border-light)]">{fmt}</span>
                            {t.id === track.id && <div className="w-2 h-2 rounded-full bg-[var(--tertiary)] shadow-[0_0_8px_var(--tertiary)] ml-2" />}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* ===== 이퀄라이저 ===== */
                    <div className="flex flex-col items-center justify-center h-full space-y-10 max-w-xl mx-auto py-10">
                      <h3 className="font-['Work_Sans'] text-xs font-bold tracking-[0.2em] text-[var(--text-main)] uppercase">Frequency Calibration</h3>
                      <div className="flex gap-10 h-64 items-end justify-center w-full bg-[var(--bg-container-low)] p-8 rounded-lg border border-[var(--border-light)] shadow-[var(--shadow-pressed)]">
                        {['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'].map((label, idx) => (
                          <div key={idx} className="flex flex-col items-center h-full gap-4">
                            <span className="text-[10px] font-['Work_Sans'] font-bold text-[var(--text-muted)] tracking-wider">{label}</span>
                            <div className="relative flex-1 w-4 bg-[var(--bg-container-highest)] border border-[var(--border-strong)] rounded-full flex items-end overflow-hidden shadow-[var(--shadow-pressed)]">
                              <div className="w-full transition-all duration-300 rounded-full"
                                style={{ 
                                  height: `${(eqGains[idx] + 12) / 24 * 100}%`,
                                  background: 'var(--primary)'
                                }} 
                              />
                              <input type="range" min="-12" max="12" step="0.1" value={eqGains[idx]}
                                onChange={(e) => setEqGain(idx, Number(e.target.value))}
                                className="absolute inset-0 -rotate-90 origin-center opacity-0 cursor-pointer"
                                style={{ width: '256px', height: '16px', left: '-120px', top: '120px' }}
                              />
                            </div>
                            <span className="text-[10px] font-['Work_Sans'] font-bold text-[var(--text-main)] w-10 text-center bg-[var(--bg-surface)] py-1 border border-[var(--border-light)] rounded-sm">
                              {eqGains[idx] > 0 ? `+${eqGains[idx].toFixed(1)}` : eqGains[idx].toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => eqGains.forEach((_, i) => setEqGain(i, 0))} 
                        className="px-6 py-2 border border-[var(--border-strong)] rounded-md text-xs font-['Work_Sans'] font-bold tracking-widest text-[var(--text-main)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] hover:bg-[var(--tertiary)]/5 transition-all shadow-sm bg-[var(--bg-surface)] uppercase">
                        Reset EQ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}
    </>
  )
}
