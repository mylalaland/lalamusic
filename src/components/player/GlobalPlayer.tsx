'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { getExternalLyrics } from '@/app/actions/lyrics'
import { addBookmark } from '@/app/actions/bookmarks'
import { Equalizer } from '@/lib/audio/equalizer'
import { 
  Play, Pause, SkipBack, SkipForward, ChevronDown, ListMusic, MoreHorizontal,
  Shuffle, Volume2, VolumeX, Mic2, Gauge, Repeat, Repeat1, Music, Moon, Settings2, Bookmark
} from 'lucide-react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'

const Icon = {
  Play: Play as any, Pause: Pause as any, SkipBack: SkipBack as any,
  SkipForward: SkipForward as any, ChevronDown: ChevronDown as any,
  ListMusic: ListMusic as any, MoreHorizontal: MoreHorizontal as any,
  Shuffle: Shuffle as any, Volume2: Volume2 as any, VolumeX: VolumeX as any,
  Mic2: Mic2 as any, Gauge: Gauge as any, Repeat: Repeat as any,
  Repeat1: Repeat1 as any, Music: Music as any, Moon: Moon as any,
  Settings2: Settings2 as any, Bookmark: Bookmark as any
}

// 가사 캐시 (메모리)
const lyricsCache = new Map<string, string | null>()

export default function GlobalPlayer() {
  const { 
    currentTrack: track, playlist, setTrack, isPlaying, togglePlay, 
    playNext, playPrev, isExpanded, setExpanded, updateTrackMetadata,
    eqGains, setEqGain
  } = usePlayerStore()

  const audioRef = useRef<HTMLAudioElement>(null)
  const activeTrackRef = useRef<HTMLDivElement>(null)
  const activeLyricRef = useRef<HTMLParagraphElement>(null)
  const seekTimeRef = useRef<number>(0)
  const equalizerRef = useRef<Equalizer | null>(null)
  const touchStartRef = useRef<{x: number, y: number} | null>(null)
  const retryCountRef = useRef(0)
  
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [isShuffle, setIsShuffle] = useState(false)
  const [viewMode, setViewMode] = useState<'art' | 'lyrics' | 'queue' | 'eq'>('art')
  const [metaLoading, setMetaLoading] = useState(false)
  const [localCoverArt, setLocalCoverArt] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [displayLyrics, setDisplayLyrics] = useState<string | null>(null)
  const [parsedLyrics, setParsedLyrics] = useState<{time: number, text: string}[] | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [isSeeking, setIsSeeking] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [sleepTimer, setSleepTimer] = useState<number>(0)

  useEffect(() => { console.log("GlobalPlayer Mounted") }, [])

  useEffect(() => {
    if (viewMode === 'queue' && activeTrackRef.current) {
        activeTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [viewMode, track?.id])

  // ============================================================
  // [NEW] 가사 4단계 폭포식(Waterfall) 로딩
  // 우선순위: 내장싱크 → 외부싱크 → 내장일반 → 외부일반
  // ============================================================
  useEffect(() => {
    if (!track) return

    const loadLyrics = async () => {
      // 0. 캐시 확인
      if (lyricsCache.has(track.id)) {
        const cached = lyricsCache.get(track.id)
        if (cached) { setDisplayLyrics(cached); return }
      }

      setLyricsLoading(true)
      setDisplayLyrics(null)

      // 1. 내장 가사 추출 (IndexedDB 또는 track 객체)
      const { getOfflineMetadata } = await import('@/lib/db/offline')
      const offlineMeta = await getOfflineMetadata(track.id).catch(() => null)
      const embeddedLyrics = (offlineMeta?.lyrics) || 
        (track.lyrics && !track.lyrics.includes('[object Object]') ? track.lyrics : null)
      const isEmbeddedSynced = embeddedLyrics && /\[\d{1,3}:\d{2}/.test(embeddedLyrics)

      // 2. 내장 싱크 가사가 있으면 → 즉시 반환 (최우선)
      if (isEmbeddedSynced) {
        lyricsCache.set(track.id, embeddedLyrics)
        setDisplayLyrics(embeddedLyrics)
        setLyricsLoading(false)
        prefetchNextLyrics()
        return
      }

      // 3. 외부 소스에서 가사 검색 (Alsong + LRCLIB 병렬)
      const externalResult = await getExternalLyrics(
        track.artist || '', 
        track.title || track.name, 
        (track as any).duration,
        ['Alsong', 'LRCLIB']
      )

      // 4. 외부 싱크 가사가 있으면 → 반환
      if (externalResult.success && externalResult.syncedLyrics) {
        lyricsCache.set(track.id, externalResult.syncedLyrics)
        setDisplayLyrics(externalResult.syncedLyrics)
        setLyricsLoading(false)
        prefetchNextLyrics()
        return
      }

      // 5. 내장 일반 가사가 있으면 → 반환
      if (embeddedLyrics && !isEmbeddedSynced) {
        lyricsCache.set(track.id, embeddedLyrics)
        setDisplayLyrics(embeddedLyrics)
        setLyricsLoading(false)
        prefetchNextLyrics()
        return
      }

      // 6. 외부 일반 가사가 있으면 → 반환
      if (externalResult.success && externalResult.plainLyrics) {
        lyricsCache.set(track.id, externalResult.plainLyrics)
        setDisplayLyrics(externalResult.plainLyrics)
        setLyricsLoading(false)
        prefetchNextLyrics()
        return
      }

      // 7. 모두 없으면 → null
      lyricsCache.set(track.id, null)
      setDisplayLyrics(null)
      setLyricsLoading(false)
    }

    const prefetchNextLyrics = () => {
      const currentIndex = playlist.findIndex(p => p.id === track.id)
      if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
        const nextTrack = playlist[currentIndex + 1]
        if (!lyricsCache.has(nextTrack.id)) {
          prefetchLyrics(nextTrack)
        }
      }
    }

    loadLyrics()
  }, [track?.id, track?.lyrics])

  // 프리패치 (동일한 4단계 로직, 상태 업데이트 없음)
  const prefetchLyrics = async (targetTrack: any) => {
    try {
      const { getOfflineMetadata } = await import('@/lib/db/offline')
      const offlineMeta = await getOfflineMetadata(targetTrack.id).catch(() => null)
      const embeddedLyrics = (offlineMeta?.lyrics) || 
        (targetTrack.lyrics && !targetTrack.lyrics.includes('[object Object]') ? targetTrack.lyrics : null)
      const isEmbeddedSynced = embeddedLyrics && /\[\d{1,3}:\d{2}/.test(embeddedLyrics)

      if (isEmbeddedSynced) { lyricsCache.set(targetTrack.id, embeddedLyrics); return }

      const res = await getExternalLyrics(targetTrack.artist || '', targetTrack.title || targetTrack.name, targetTrack.duration, ['Alsong', 'LRCLIB'])
      
      if (res.success && res.syncedLyrics) { lyricsCache.set(targetTrack.id, res.syncedLyrics); return }
      if (embeddedLyrics) { lyricsCache.set(targetTrack.id, embeddedLyrics); return }
      if (res.success && res.plainLyrics) { lyricsCache.set(targetTrack.id, res.plainLyrics); return }
    } catch (e) { /* ignore */ }
  }

  // 가사 파싱
  useEffect(() => {
    if (displayLyrics) {
      const parsed = parseLRC(displayLyrics)
      setParsedLyrics(parsed)
    } else {
      setParsedLyrics(null)
    }
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
    if (viewMode === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLyricIndex, viewMode])

  // 곡 변경 및 메타데이터 로딩
  useEffect(() => {
    if (!track) return
    setCurrentTime(0)
    setMetaLoading(false)

    const fetchMetadata = async () => {
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

    fetchMetadata()

    if (audioRef.current) {
      const newSrc = ((track as any).src && ((track as any).src.startsWith('http') || (track as any).src.startsWith('blob')))
        ? (track as any).src 
        : `/api/stream?id=${track.id}&mimeType=${encodeURIComponent(track.mimeType || '')}`
            
      if (audioRef.current.src.indexOf(track.id) === -1) {
        audioRef.current.src = newSrc
        audioRef.current.playbackRate = playbackRate
        audioRef.current.volume = isMuted ? 0 : volume
        audioRef.current.crossOrigin = "anonymous"
        retryCountRef.current = 0
        audioRef.current.load()
        if ((track as any).initialPosition) audioRef.current.currentTime = (track as any).initialPosition
        if (isPlaying) audioRef.current.play().catch(() => {})
      } else {
        if ((track as any).initialPosition) {
          audioRef.current.currentTime = (track as any).initialPosition
          if (isPlaying) audioRef.current.play().catch(() => {})
        }
      }
    }
  }, [track?.id])

  // 재생 상태 동기화
  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      if (equalizerRef.current && equalizerRef.current.audioContext.state === 'suspended') {
        equalizerRef.current.audioContext.resume()
      }
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying])

  // 볼륨 및 EQ
  useEffect(() => {
    if (!audioRef.current) return
    if (!equalizerRef.current) {
      try { equalizerRef.current = new Equalizer(audioRef.current) } catch(e) { }
    }
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

  const handleTimeUpdate = () => { 
    if (audioRef.current && !isSeeking) {
      const t = audioRef.current.currentTime
      setCurrentTime(t)
      seekTimeRef.current = t
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

  const handleNextWrapped = () => {
    if (!track) return
    if (repeatMode === 'one') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}) }
      return
    }
    if (isShuffle && playlist.length > 0) {
      setTrack(playlist[Math.floor(Math.random() * playlist.length)])
    } else {
      const currentIndex = playlist.findIndex(p => p.id === track.id)
      const isLast = currentIndex === playlist.length - 1
      if (isLast) {
        if (repeatMode === 'all') setTrack(playlist[0])
        else { if (isPlaying) togglePlay() }
      } else { playNext() }
    }
  }
  const handlePrevWrapped = () => {
    if (currentTime > 3 && audioRef.current) { audioRef.current.currentTime = 0 } else { playPrev() }
  }
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

  useEffect(() => {
    if (sleepTimer === 0) return
    const timer = setTimeout(() => { if (isPlaying) togglePlay(); setSleepTimer(0); }, sleepTimer * 60 * 1000)
    return () => clearTimeout(timer)
  }, [sleepTimer])

  const validDuration = track 
    ? ((duration && isFinite(duration) && duration > 0 && duration !== Infinity) 
        ? duration 
        : ((track as any).duration || 0))
    : 0

  // Media Session API
  useEffect(() => {
    if (!track || !navigator.mediaSession) return
    const title = track.title || track.name?.replace(/\.(mp3|wav|flac|m4a)$/i, '') || 'Unknown Title'
    const artist = track.artist || 'Unknown Artist'
    const album = track.album || 'Lala Music'
    const artwork: MediaImage[] = []
    let mediaArt = track.cover_art || track.thumbnailLink || null
    if (typeof mediaArt === 'string' && !mediaArt.includes('[object Object]')) {
      artwork.push({ src: mediaArt, sizes: '512x512', type: 'image/png' })
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album, artwork })
    try {
      navigator.mediaSession.setActionHandler('play', () => togglePlay())
      navigator.mediaSession.setActionHandler('pause', () => togglePlay())
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevWrapped())
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNextWrapped())
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime
          setCurrentTime(details.seekTime)
        }
      })
    } catch (e) { console.warn('Media Session Action Error:', e) }
  }, [track])

  useEffect(() => {
    if (!navigator.mediaSession || !audioRef.current) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    if (validDuration > 0 && isFinite(validDuration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: validDuration,
          playbackRate: audioRef.current.playbackRate,
          position: audioRef.current.currentTime
        })
      } catch (e) { }
    }
  }, [isPlaying, validDuration, playbackRate, isSeeking])

  if (!track) return null

  const displayTitle = track.title || track.name.replace(/\.(mp3|wav|flac|m4a)$/i, '')
  let displayArt = localCoverArt || track.cover_art || track.thumbnailLink || (track as any).thumbnail_link || null
  if (typeof displayArt === 'string' && displayArt.includes('[object Object]')) displayArt = null 
  const hasLyrics = displayLyrics && displayLyrics.length > 0

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) setExpanded(false)
  }

  const handlePlayerTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handlePlayerTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    const diffX = touchStartRef.current.x - touchEnd.x
    const diffY = touchStartRef.current.y - touchEnd.y
    if (Math.abs(diffX) > 100 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) handlePrevWrapped()
      else handleNextWrapped()
    }
    touchStartRef.current = null
  }

  const handleAudioError = () => {
    if (!audioRef.current || !track) return
    if (retryCountRef.current < 3) {
      retryCountRef.current += 1
      const currentSrc = audioRef.current.src
      audioRef.current.src = currentSrc
      audioRef.current.load()
      if (isPlaying) audioRef.current.play().catch(() => {})
    }
  }

  const progressPercent = (currentTime / (validDuration || 1)) * 100

  // ============================================================
  // NEURAL_AUDIO UI
  // ============================================================
  return (
    <>
      <audio 
        ref={audioRef} preload="auto" playsInline 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata} 
        onEnded={handleNextWrapped}
        onError={handleAudioError} 
      />

      {/* ---- 미니 플레이어 (NEURAL_AUDIO Style) ---- */}
      {!isExpanded && (
        <motion.div
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-[90px] left-2 right-2 h-[68px] z-[90] cursor-pointer"
          style={{ background: 'rgba(10, 14, 20, 0.92)', backdropFilter: 'blur(20px)' }}
          onClick={() => setExpanded(true)}
        >
          {/* 상단 프로그레스 바 */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5">
            <div className="h-full bg-[#99f7ff] transition-all duration-200" style={{ width: `${progressPercent}%`, boxShadow: '0 0 10px rgba(153,247,255,0.6)' }} />
          </div>
          <div className="flex items-center h-full px-3 gap-3">
            {/* 앨범아트 */}
            <div className="w-11 h-11 bg-[#151a21] border border-[#99f7ff]/20 shrink-0 overflow-hidden flex items-center justify-center">
              {displayArt ? <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} /> : <Icon.Music size={18} className="text-[#99f7ff]/40" />}
            </div>
            {/* 곡 정보 */}
            <div className="flex-1 min-w-0">
              <p className="font-['Space_Grotesk'] font-bold text-sm text-[#f1f3fc] truncate tracking-tight">{displayTitle}</p>
              <p className="font-['Inter'] text-[11px] text-[#a8abb3] truncate">{track.artist || 'Unknown Artist'}</p>
            </div>
            {/* 컨트롤 */}
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 flex items-center justify-center text-[#99f7ff] hover:text-[#00f1fe] transition-colors">
                {isPlaying ? <Icon.Pause size={22} fill="currentColor" /> : <Icon.Play size={22} fill="currentColor" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleNextWrapped(); }} className="w-8 h-8 flex items-center justify-center text-[#72757d] hover:text-[#99f7ff] transition-colors">
                <Icon.SkipForward size={18} fill="currentColor" />
              </button>
            </div>
          </div>
          {/* 좌우 보더 라인 */}
          <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-[#99f7ff]/10" />
          <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-[#99f7ff]/10" />
        </motion.div>
      )}

      {/* ---- 전체 화면 플레이어 ---- */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.2 }} onDragEnd={handleDragEnd}
            onTouchStart={handlePlayerTouchStart} onTouchEnd={handlePlayerTouchEnd}
            className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] touch-none overflow-hidden"
            style={{ background: '#0a0e14' }}
          >
            {/* 배경 글로우 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(153,247,255,0.15) 0%, transparent 70%)' }} />
              {/* 도트 그리드 */}
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#99f7ff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
            </div>

            {/* 상단 핸들바 */}
            <div className="flex justify-center pt-3 pb-1 cursor-pointer shrink-0 relative z-10" onClick={() => setExpanded(false)}>
              <div className="w-12 h-[2px] bg-[#99f7ff]/30" />
            </div>

            {/* 닫기 버튼 */}
            <div className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 z-20">
              <button onClick={() => setExpanded(false)} className="p-2 text-[#72757d] hover:text-[#99f7ff] transition-colors">
                <Icon.ChevronDown size={28} />
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-2 pb-4 overflow-hidden relative z-10 justify-between">
               
              {/* ===== 메인 콘텐츠 영역 ===== */}
              <div className="flex-1 flex flex-col justify-center min-h-0 mb-4 relative">
                {viewMode === 'queue' ? (
                  /* ===== A. 대기열 ===== */
                  <div className="w-full h-full overflow-y-auto space-y-1 py-2" style={{ scrollbarWidth: 'none' }}>
                    <h3 className="font-['Space_Grotesk'] text-xs tracking-[0.3em] text-[#99f7ff] uppercase mb-4 sticky top-0 py-2 z-10 flex justify-between items-center" style={{ background: 'rgba(10,14,20,0.9)', backdropFilter: 'blur(10px)' }}>
                      UP_NEXT_QUEUE
                      <button onClick={toggleSpeed} className="bg-[#99f7ff]/10 px-3 py-1 text-xs text-[#99f7ff] hover:bg-[#99f7ff]/20 transition font-['Space_Grotesk'] tracking-wider">
                        {playbackRate}x
                      </button>
                    </h3>
                    {playlist.map((t, i) => {
                      const art = t.cover_art || t.thumbnailLink || (t as any).thumbnail_link
                      return (
                        <div 
                          key={i} 
                          ref={t.id === track.id ? activeTrackRef : null}
                          onClick={() => setTrack(t)} 
                          className={`flex items-center gap-3 p-3 cursor-pointer transition-all border-l-2 ${t.id === track.id ? 'bg-[#99f7ff]/5 border-[#99f7ff]' : 'border-transparent hover:bg-white/5 hover:border-[#99f7ff]/30'}`}
                        >
                          <div className="w-11 h-11 bg-[#1b2028] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                            <Icon.Music size={16} className="text-[#44484f] absolute"/>
                            {art && <img src={art} loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover relative z-10" onError={(e) => e.currentTarget.style.display='none'}/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-['Space_Grotesk'] text-sm truncate tracking-tight ${t.id === track.id ? 'text-[#99f7ff] font-bold' : 'text-[#f1f3fc]'}`}>{t.title || t.name}</p>
                            <p className="text-[10px] text-[#72757d] truncate font-['Inter']">{t.artist || 'Unknown'}</p>
                          </div>
                          {t.id === track.id && <div className="w-1.5 h-1.5 bg-[#99f7ff] animate-pulse" />}
                        </div>
                      )
                    })}
                  </div>
                ) : viewMode === 'lyrics' ? (
                  /* ===== B. 가사 (NEURAL_AUDIO Style) ===== */
                  <div 
                    className="w-full h-full overflow-y-auto overflow-x-hidden text-center space-y-6 py-10 px-4"
                    style={{ scrollbarWidth: 'none' }}
                    onClick={() => setViewMode('art')}
                  >
                    {hasLyrics ? (
                      parsedLyrics ? (
                        parsedLyrics.map((line, i) => (
                          <p 
                            key={i} 
                            ref={i === currentLyricIndex ? activeLyricRef : null}
                            className={`font-['Space_Grotesk'] text-xl font-bold transition-all duration-500 cursor-pointer leading-relaxed ${
                              i === currentLyricIndex 
                                ? 'text-[#99f7ff] scale-105 opacity-100' 
                                : 'text-[#44484f] hover:text-[#72757d] opacity-60 blur-[0.5px]'
                            } ${line.text ? '' : 'h-6'}`}
                            style={i === currentLyricIndex ? { textShadow: '0 0 20px rgba(153,247,255,0.5)' } : undefined}
                            onClick={(e) => { e.stopPropagation(); if (audioRef.current) audioRef.current.currentTime = line.time }}
                          >
                            {line.text}
                          </p>
                        ))
                      ) : (
                        displayLyrics!.split('\n').map((line: string, i: number) => (
                          <p key={i} className="font-['Inter'] text-lg text-[#a8abb3] leading-relaxed">{line}</p>
                        ))
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-[#44484f] space-y-4 min-h-[300px]">
                        <Icon.Mic2 size={48} className={`opacity-30 ${lyricsLoading || metaLoading ? 'animate-pulse' : ''}`}/>
                        {(metaLoading || lyricsLoading) && <p className="text-xs text-[#99f7ff] animate-pulse font-['Space_Grotesk'] tracking-widest uppercase">SCANNING_LYRICS...</p>}
                      </div>
                    )}
                  </div>
                ) : viewMode === 'eq' ? (
                  /* ===== D. 이퀄라이저 (NEURAL_AUDIO Style) ===== */
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-8 text-center px-4">
                    <h3 className="font-['Space_Grotesk'] text-xs tracking-[0.3em] text-[#99f7ff] uppercase">FREQ_CALIBRATION</h3>
                    <div className="flex gap-4 sm:gap-6 md:gap-10 h-56 items-end justify-center w-full max-w-md">
                      {['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'].map((label, idx) => (
                        <div key={idx} className="flex flex-col items-center h-full gap-3">
                          <span className="text-[10px] font-['Space_Grotesk'] text-[#72757d] tracking-wider">{label}</span>
                          <div className="relative flex-1 w-[10px] bg-[#1b2028] border border-[#44484f]/30 flex items-end overflow-hidden group">
                            <div className="w-full transition-all duration-300" 
                              style={{ 
                                height: `${(eqGains[idx] + 12) / 24 * 100}%`,
                                background: 'linear-gradient(to top, rgba(0,242,255,0.2), #99f7ff)',
                                boxShadow: '0 0 10px rgba(153,247,255,0.4)'
                              }} 
                            />
                            <input 
                              type="range" min="-12" max="12" step="0.1" 
                              value={eqGains[idx]} 
                              onChange={(e) => setEqGain(idx, Number(e.target.value))}
                              className="absolute inset-0 -rotate-90 origin-center opacity-0 cursor-pointer h-full z-30" 
                              style={{ width: '224px', height: '10px', left: '-107px', top: '107px' }}
                            />
                          </div>
                          <span className="text-[10px] font-['Space_Grotesk'] text-[#99f7ff] w-10 text-center">
                            {eqGains[idx] > 0 ? `+${eqGains[idx].toFixed(1)}` : eqGains[idx].toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { eqGains.forEach((_, i) => setEqGain(i, 0)) }} 
                      className="mt-4 px-6 py-2 border border-[#44484f] text-xs font-['Space_Grotesk'] tracking-widest text-[#a8abb3] hover:border-[#99f7ff] hover:text-[#99f7ff] transition-all uppercase">
                      RESET_EQ
                    </button>
                  </div>
                ) : (
                  /* ===== C. 앨범 아트 (NEURAL_AUDIO Style) ===== */
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="relative group" style={{ width: 'min(85vw, 50vh)' }}>
                      {/* 홀로그램 프레임 */}
                      <div className="absolute -inset-3 border border-[#99f7ff]/10 pointer-events-none opacity-50" />
                      <div className="absolute -inset-6 border border-[#99f7ff]/5 pointer-events-none opacity-30" />
                      {/* 메인 아트 */}
                      <div className="aspect-square w-full bg-[#0f141a] border border-[#99f7ff]/20 overflow-hidden relative" style={{ boxShadow: '0 0 60px rgba(0,241,254,0.1)' }}>
                        {displayArt ? (
                          <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: 'radial-gradient(circle, rgba(153,247,255,0.05) 0%, transparent 70%)' }}>
                            <Icon.Music size={64} className="text-[#99f7ff]/20" />
                            <span className="text-[10px] font-['Space_Grotesk'] text-[#44484f] mt-4 tracking-[0.3em] uppercase">NO_SIGNAL</span>
                          </div>
                        )}
                        {/* 기술 데이터 오버레이 */}
                        {displayArt && (
                          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                            <div className="bg-black/60 backdrop-blur-md border border-[#99f7ff]/20 px-2 py-0.5">
                              <span className="text-[9px] font-['Space_Grotesk'] text-[#99f7ff] font-bold tracking-wider">{(track as any).mimeType?.replace('audio/', '').toUpperCase() || 'AUDIO'}</span>
                            </div>
                          </div>
                        )}
                        {metaLoading && (
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-[#99f7ff]/20 px-3 py-1 flex items-center gap-2">
                            <Icon.Gauge size={10} className="text-[#99f7ff] animate-spin"/>
                            <span className="text-[9px] font-['Space_Grotesk'] text-[#99f7ff] tracking-wider">ANALYZING...</span>
                          </div>
                        )}
                      </div>
                      {/* 글로우 */}
                      <div className="absolute inset-0 bg-[#99f7ff]/5 blur-[80px] -z-10 rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              {/* ===== 하단 컨트롤 영역 ===== */}
              <div className="shrink-0 flex flex-col justify-end">
                {/* 곡 정보 */}
                <div className="mb-3 px-1">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0 mr-4">
                      <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[#f1f3fc] mb-0.5 truncate tracking-tight uppercase">{displayTitle}</h2>
                      <p className="font-['Space_Grotesk'] text-sm text-[#99f7ff] truncate tracking-[0.15em] opacity-80 uppercase">{track.artist || 'Unknown Artist'}</p>
                    </div>
                    <button 
                      onClick={async (e) => { 
                        e.stopPropagation();
                        if(audioRef.current) {
                          const res = await addBookmark(track.id, audioRef.current.currentTime);
                          if (res.success) alert('북마크가 저장되었습니다!');
                          else alert('저장 실패: ' + res.error);
                        }
                      }} 
                      className="p-2.5 text-[#99f7ff]/60 hover:text-[#99f7ff] transition-colors border border-[#44484f]/50 hover:border-[#99f7ff]/30"
                    >
                      <Icon.Bookmark size={18} fill="currentColor" />
                    </button>
                  </div>
                </div>

                {/* 진행 바 (HUD) */}
                <div className="w-full mb-4 group relative px-1">
                  <input 
                    type="range" min={0} max={validDuration || 100} step="any"
                    value={currentTime} 
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    onTouchEnd={handleSeekEnd}
                    className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer z-10" 
                  />
                  <div className="h-[3px] bg-[#1b2028] w-full overflow-hidden border border-[#44484f]/20">
                    <div className="h-full bg-[#99f7ff] relative" style={{ width: `${progressPercent}%`, boxShadow: '0 0 10px rgba(153,247,255,0.6)' }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#99f7ff] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1.5" style={{ boxShadow: '0 0 15px rgba(153,247,255,1)' }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#72757d] mt-2 font-['Space_Grotesk'] tracking-wider">
                    <span>{formatTime(currentTime)}</span><span>{formatTime(validDuration)}</span>
                  </div>
                </div>

                {/* 메인 컨트롤 */}
                <div className="flex items-center justify-center gap-8 mb-5">
                  <button onClick={handlePrevWrapped} className="w-12 h-12 flex items-center justify-center border border-[#44484f]/50 text-[#f1f3fc] hover:border-[#99f7ff] hover:text-[#99f7ff] transition-all active:scale-90">
                    <Icon.SkipBack size={24} fill="currentColor" />
                  </button>
                  <button onClick={togglePlay} className="w-20 h-20 flex items-center justify-center text-[#004145] hover:scale-105 transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #99f7ff, #00f1fe)', boxShadow: '0 0 30px rgba(0,241,254,0.3)' }}
                  >
                    {isPlaying ? <Icon.Pause size={36} fill="currentColor" /> : <Icon.Play size={36} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={handleNextWrapped} className="w-12 h-12 flex items-center justify-center border border-[#44484f]/50 text-[#f1f3fc] hover:border-[#99f7ff] hover:text-[#99f7ff] transition-all active:scale-90">
                    <Icon.SkipForward size={24} fill="currentColor" />
                  </button>
                </div>

                {/* 볼륨 + 셔플/반복 */}
                <div className="flex items-center justify-between gap-4 mb-5 px-2">
                  <div className="flex items-center gap-3 flex-1 max-w-[180px]">
                    <button onClick={() => setIsMuted(!isMuted)} className="text-[#72757d] hover:text-[#99f7ff] transition-colors">
                      {isMuted || volume === 0 ? <Icon.VolumeX size={18}/> : <Icon.Volume2 size={18}/>}
                    </button>
                    <div className="flex-1 h-[2px] bg-[#1b2028] relative group border border-[#44484f]/20">
                      <div className="absolute inset-y-0 left-0 bg-[#99f7ff]" style={{ width: `${(isMuted ? 0 : volume) * 100}%`, boxShadow: '0 0 8px rgba(153,247,255,0.4)' }} />
                      <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} onChange={(e) => setVolume(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setIsShuffle(!isShuffle)} className={`p-2 transition-colors ${isShuffle ? 'text-[#99f7ff]' : 'text-[#72757d] hover:text-[#99f7ff]'}`}>
                      <Icon.Shuffle size={18} />
                    </button>
                    <button onClick={toggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-[#99f7ff]' : 'text-[#72757d] hover:text-[#99f7ff]'}`}>
                      {repeatMode === 'one' ? <Icon.Repeat1 size={18} /> : <Icon.Repeat size={18} />}
                    </button>
                  </div>
                </div>

                {/* 하단 기능 버튼 (HUD 스타일) */}
                <div className="flex justify-center gap-6 pb-4">
                  <button onClick={() => setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics')} className={`flex flex-col items-center gap-1 p-2 transition-all ${viewMode === 'lyrics' ? 'text-[#99f7ff]' : 'text-[#72757d] hover:text-[#99f7ff]'}`}>
                    <Icon.Mic2 size={20} />
                    <span className="text-[8px] font-['Space_Grotesk'] tracking-wider uppercase">LYRICS</span>
                  </button>
                  <button onClick={() => setViewMode(viewMode === 'eq' ? 'art' : 'eq')} className={`flex flex-col items-center gap-1 p-2 transition-all ${viewMode === 'eq' ? 'text-[#99f7ff]' : 'text-[#72757d] hover:text-[#99f7ff]'}`}>
                    <Icon.Settings2 size={20} />
                    <span className="text-[8px] font-['Space_Grotesk'] tracking-wider uppercase">EQ</span>
                  </button>
                  <button onClick={toggleSleepTimer} className={`flex flex-col items-center gap-1 p-2 transition-all relative ${sleepTimer > 0 ? 'text-[#99f7ff]' : 'text-[#72757d] hover:text-[#99f7ff]'}`}>
                    <Icon.Moon size={20} />
                    <span className="text-[8px] font-['Space_Grotesk'] tracking-wider uppercase">{sleepTimer > 0 ? `${sleepTimer}M` : 'SLEEP'}</span>
                  </button>
                  <button onClick={() => setViewMode(viewMode === 'queue' ? 'art' : 'queue')} className={`flex flex-col items-center gap-1 p-2 transition-all ${viewMode === 'queue' ? 'text-[#99f7ff]' : 'text-[#72757d] hover:text-[#99f7ff]'}`}>
                    <Icon.ListMusic size={20} />
                    <span className="text-[8px] font-['Space_Grotesk'] tracking-wider uppercase">QUEUE</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

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