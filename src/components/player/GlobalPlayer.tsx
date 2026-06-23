'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { getExternalLyrics } from '@/app/actions/lyrics'
import { addBookmark } from '@/app/actions/bookmarks'
import { Equalizer } from '@/lib/audio/equalizer'
import { WebAudioFallbackPlayer, needsWebAudioFallback } from '@/lib/audio/webAudioFallback'
import { unlockAllAudioContexts } from '@/lib/audio/sharedAudioCtx'
import { preloadTrack, getCachedUrl, releaseAllExcept, isCached } from '@/lib/audio/audioPreloader'
import { 
  Play, Pause, SkipBack, SkipForward, ChevronDown, ListMusic, MoreHorizontal,
  Shuffle, Volume2, VolumeX, Mic2, Gauge, Repeat, Repeat1, Music, Moon, Settings2, Bookmark, Plus, Check
} from 'lucide-react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'

const Icon = {
  Play: Play as any, Pause: Pause as any, SkipBack: SkipBack as any,
  SkipForward: SkipForward as any, ChevronDown: ChevronDown as any,
  ListMusic: ListMusic as any, MoreHorizontal: MoreHorizontal as any,
  Shuffle: Shuffle as any, Volume2: Volume2 as any, VolumeX: VolumeX as any,
  Mic2: Mic2 as any, Gauge: Gauge as any, Repeat: Repeat as any,
  Repeat1: Repeat1 as any, Music: Music as any, Moon: Moon as any,
  Settings2: Settings2 as any, Bookmark: Bookmark as any,
  Plus: Plus as any, Check: Check as any
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
  const metaTrackIdRef = useRef<string | null>(null)
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(isPlaying)
  const fallbackPlayerRef = useRef<WebAudioFallbackPlayer | null>(null)
  
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFallbackMode, setIsFallbackMode] = useState(false)
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
  const [showFullTitle, setShowFullTitle] = useState(false)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [bufferProgress, setBufferProgress] = useState(0)
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false)
  const [playlists, setPlaylists] = useState<any[]>([])
  const [playlistAdded, setPlaylistAdded] = useState(false)
  const preloadAbortRef = useRef<(() => void) | null>(null)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const addDebug = (msg: string) => { setDebugLog(prev => [...prev.slice(-15), `${new Date().toLocaleTimeString()}: ${msg}`]) }
  
  const handleTogglePlay = () => {
    unlockAllAudioContexts().catch(() => {})
    // @ts-ignore
    if (fallbackPlayerRef.current?.audioContext?.state === 'suspended') {
      // @ts-ignore
      fallbackPlayerRef.current.audioContext.resume().catch(() => {})
    }
    togglePlay()
  }

  // isPlayingRef 동기화
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // WebAudioFallbackPlayer 정리
  const cleanupFallback = () => {
    if (fallbackPlayerRef.current) {
      fallbackPlayerRef.current.destroy()
      fallbackPlayerRef.current = null
    }
    // 무음 <audio> 정리 (iOS playback session 유지용)
    if (audioRef.current && audioRef.current.loop) {
      audioRef.current.loop = false
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setIsFallbackMode(false)
  }

  // 1-sample silent WAV (forces iOS audio session to "playback" mode)
  const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

  // WebAudioFallbackPlayer로 FLAC/OGG/OPUS 재생 (iOS Safari 전용)
  const startFallbackPlayback = async (url: string) => {
    addDebug('▶ startFallbackPlayback 시작')
    cleanupFallback()

    // [CRITICAL] iOS: <audio> 태그로 무음 재생 (fire-and-forget, await 하면 iOS에서 랫)
    if (audioRef.current) {
      audioRef.current.src = SILENT_WAV
      audioRef.current.loop = true
      audioRef.current.volume = 0.001
      audioRef.current.play()
        .then(() => addDebug('✅ 무음WAV play() 성공'))
        .catch((e: any) => addDebug(`❌ 무음WAV play() 실패: ${e?.message || e}`))
    }
    addDebug('무음WAV 시도 후 계속 진행')

    const player = new WebAudioFallbackPlayer(undefined)
    fallbackPlayerRef.current = player
    // @ts-ignore
    addDebug(`AudioContext 상태: ${player.audioContext?.state}`)

    player.onTimeUpdate = (t) => { if (!isSeeking) { setCurrentTime(t); seekTimeRef.current = t } }
    player.onDurationChange = (d) => { setDuration(d); addDebug(`duration 설정: ${d.toFixed(1)}s`) }
    player.onEnded = () => handleNextWrapped()

    // iOS: AudioContext resume
    try {
      // @ts-ignore
      if (player.audioContext?.state === 'suspended') {
        // @ts-ignore
        await player.audioContext.resume()
        // @ts-ignore
        addDebug(`AudioContext resume 후: ${player.audioContext?.state}`)
      }
    } catch (e: any) {
      addDebug(`❌ AudioContext resume 실패: ${e?.message}`)
    }

    addDebug('loadAndDecode 시작...')
    const ok = await player.loadAndDecode(url)
    addDebug(`loadAndDecode 결과: ${ok}`)

    if (ok) {
      player.setVolume(isMuted ? 0 : volume)
      player.setPlaybackRate(playbackRate)
      setIsFallbackMode(true)
      // @ts-ignore
      addDebug(`play() 호출 전 - ctx상태: ${player.audioContext?.state}, buffer: ${player.audioBuffer ? player.audioBuffer.duration.toFixed(1) + 's' : 'null'}`)
      try {
        await player.play()
        addDebug('✅ play() 완료')
        // @ts-ignore
        addDebug(`play() 후 - ctx상태: ${player.audioContext?.state}, state: ${player._state}`)
      } catch (e: any) {
        addDebug(`❌ play() 실패: ${e?.message || e}`)
      }
    } else {
      addDebug('❌ loadAndDecode 실패!')
    }
  }

  // [FIX] iOS Safari: AudioContext must be unlocked via user gesture
  useEffect(() => {
    console.log("GlobalPlayer Mounted")
    let unlocked = false
    const unlockAudio = () => {
      if (unlocked) return
      unlocked = true
      addDebug('🔓 unlockAudio 호출됨')
      
      // [FIX] iOS: src 없는 <audio>의 play()는 unlock이 안 됨. 무음 WAV를 src로 설정
      if (audioRef.current) {
        if (!audioRef.current.src || audioRef.current.src === '' || audioRef.current.src === window.location.href) {
          audioRef.current.src = SILENT_WAV
        }
        const silentPlay = audioRef.current.play()
        silentPlay?.then(() => {
          addDebug('✅ unlock play() 성공')
          audioRef.current?.pause()
        }).catch((e) => {
          addDebug(`❌ unlock play() 실패: ${e}`)
        })
      }
      
      unlockAllAudioContexts().catch(() => {})
      // @ts-ignore
      if (fallbackPlayerRef.current?.audioContext?.state === 'suspended') {
        // @ts-ignore
        fallbackPlayerRef.current.audioContext.resume().catch(() => {})
      }
      
      document.removeEventListener('touchstart', unlockAudio)
      document.removeEventListener('click', unlockAudio)
    }
    document.addEventListener('touchstart', unlockAudio, { passive: true })
    document.addEventListener('click', unlockAudio, { passive: true })
    return () => {
      document.removeEventListener('touchstart', unlockAudio)
      document.removeEventListener('click', unlockAudio)
    }
  }, [])

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
        setDisplayLyrics(null); return
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

      // [FIX] 파일명에서 아티스트/제목 파싱 (DesktopPlayer와 동일한 고급 로직)
      let searchArtist = track.artist || ''
      let searchTitle = track.title || track.name || ''
      // 확장자 제거
      searchTitle = searchTitle.replace(/\.(mp3|flac|m4a|wav|aac|ogg|wma|opus)$/i, '')
      // 넘버링 제거 (앞쪽 "001 ", "01-" 등)
      searchTitle = searchTitle.replace(/^\d{1,4}[\s._-]+/, '')
      // "아티스트-번호-제목" or "아티스트 - 제목" 패턴
      if (!searchArtist || searchArtist === 'Unknown' || searchArtist === 'Google Drive' || searchArtist === 'Unknown Artist') {
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

      // 3. 외부 소스에서 가사 검색 (Alsong + LRCLIB 병렬)
      const externalResult = await getExternalLyrics(
        searchArtist, 
        searchTitle, 
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
    setPlaylistAdded(false)
    setBufferProgress(0)

    // [FIX] 곡 빠르게 넘길 때 이전 곡의 커버아트가 덮어쓰는 문제 방지
    const thisTrackId = track.id
    metaTrackIdRef.current = thisTrackId

    // [OPT] 1단계: Google Drive 썸네일 즉시 표시 (img 태그는 CORS 불필요)
    const thumbUrl = track.thumbnailLink || (track as any).thumbnail_link
    if (thumbUrl && typeof thumbUrl === 'string' && !thumbUrl.includes('[object Object]')) {
      setLocalCoverArt(thumbUrl)
    } else {
      setLocalCoverArt(null)
    }

    // [OPT] 2단계: IndexedDB 캐시 확인 (즉시, 비동기)
    if (metaTimerRef.current) { clearTimeout(metaTimerRef.current); metaTimerRef.current = null }

    const checkCacheAndFetch = async () => {
      const { getOfflineMetadata, saveOfflineMetadata } = await import('@/lib/db/offline')
      const offlineMeta = await getOfflineMetadata(track.id).catch(() => null)
      if (offlineMeta) {
        if (metaTrackIdRef.current !== thisTrackId) return
        if (offlineMeta.cover_art) setLocalCoverArt(offlineMeta.cover_art)
        return // 캐시에 있으면 서버 호출 불필요
      }
      
      // [OPT] 3단계: 서버 메타데이터 추출을 3초 후 실행 (곡에 머물 때만)
      if (metaTrackIdRef.current !== thisTrackId) return
      metaTimerRef.current = setTimeout(async () => {
        if (metaTrackIdRef.current !== thisTrackId) return
        setMetaLoading(true)
        try {
          const result = await analyzeMusicMetadata(track.id)
          if (metaTrackIdRef.current !== thisTrackId) return
          if (result.success && result.data) {
            updateTrackMetadata(track.id, result.data)
            if (result.heavyMetadata) {
              await saveOfflineMetadata(track.id, result.heavyMetadata)
              if (metaTrackIdRef.current !== thisTrackId) return
              if (result.heavyMetadata.cover_art) setLocalCoverArt(result.heavyMetadata.cover_art)
            }
          }
        } catch (e) { console.error(e) } 
        finally { if (metaTrackIdRef.current === thisTrackId) setMetaLoading(false) }
      }, 3000)
    }

    checkCacheAndFetch()

    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    cleanupFallback()

    // [NEW] 오디오 소스 로딩 — src 설정만, 재생은 isPlaying useEffect가 담당
    const loadAudioSource = async () => {
      let newSrc: string

      // blob/http 소스가 이미 있으면 (오프라인 파일 등) 그대로 사용
      if ((track as any).src && ((track as any).src.startsWith('http') || (track as any).src.startsWith('blob'))) {
        newSrc = (track as any).src
        setLoadProgress(null)
      } else {
        // [OFFLINE MODE] 오프라인 모드에서는 스트리밍 차단
        const { useSettingsStore } = await import('@/lib/store/useSettingsStore')
        const isOffline = useSettingsStore.getState().offlineMode
        if (isOffline) {
          console.log('[GlobalPlayer] Offline mode ON — streaming blocked for:', track.name)
          setLoadProgress(null)
          return
        }

        // 모든 포맷 preloader 사용 (Vercel 트래픽 0)
        try {
          setLoadProgress(0)
          newSrc = await preloadTrack(track.id, track.id, {
            fileName: track.name || track.title || '',
            onProgress: (pct) => {
              if (metaTrackIdRef.current === thisTrackId) setLoadProgress(pct)
            }
          })
          if (metaTrackIdRef.current === thisTrackId) {
            setLoadProgress(1.0)
            setTimeout(() => {
              if (metaTrackIdRef.current === thisTrackId) setLoadProgress(null)
            }, 1500)
          }
        } catch (e) {
          console.error('[GlobalPlayer] Preloader failed:', e)
          setLoadProgress(null)
          return
        }
      }

      // stale check
      if (metaTrackIdRef.current !== thisTrackId) return

      // 포맷별 재생 경로 분기 — iOS에서 FLAC/OGG/OPUS는 <audio> 태그로 재생 불가
      // AudioContext.decodeAudioData()로 디코딩하는 WebAudioFallbackPlayer 사용
      const useFallback = needsWebAudioFallback(track.mimeType ?? undefined, (track.name || track.title) ?? undefined)
      addDebug(`포맷 분기: ${track.name}, fallback=${useFallback}, src길이=${newSrc.length}`)
      if (useFallback) {
        addDebug('→ WebAudioFallbackPlayer 경로')
        startFallbackPlayback(newSrc)
        return
      }

      // Standard <audio> playback path
      setIsFallbackMode(false)
      if (audioRef.current) {
        if (newSrc.startsWith('blob:')) audioRef.current.removeAttribute('crossorigin')
        else audioRef.current.crossOrigin = "anonymous"
        audioRef.current.src = newSrc
        audioRef.current.playbackRate = playbackRate
        audioRef.current.volume = isMuted ? 0 : volume
        retryCountRef.current = 0
        audioRef.current.load()

        const handleCanPlay = () => {
          if ((track as any).initialPosition) audioRef.current!.currentTime = (track as any).initialPosition
          if (isPlayingRef.current) {
            unlockAllAudioContexts().catch(() => {})
            audioRef.current!.play().catch((e) => console.warn('Play blocked:', e))
          }
          audioRef.current!.removeEventListener('canplay', handleCanPlay)
        }
        audioRef.current.addEventListener('canplay', handleCanPlay)
      }
    }

    loadAudioSource()

    return () => {
      if (metaTimerRef.current) { clearTimeout(metaTimerRef.current); metaTimerRef.current = null }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      cleanupFallback()
    }
  }, [track?.id])

  // [NEW] 다음곡 프리로드 + 이전곡 캐시 유지
  useEffect(() => {
    if (!track || !playlist.length) return
    const currentIndex = playlist.findIndex(p => p.id === track.id)
    if (currentIndex === -1) return

    // 이전 프리로드 취소
    if (preloadAbortRef.current) {
      preloadAbortRef.current()
      preloadAbortRef.current = null
    }

    // 다음곡 프리로드 (blob/src가 없는 경우에만)
    const nextTrack = playlist[currentIndex + 1]
    if (nextTrack && !(nextTrack as any).src && !isCached(nextTrack.id)) {
      console.log('[GlobalPlayer] Pre-fetching next track:', nextTrack.name || nextTrack.title)
      const controller = new AbortController()
      preloadAbortRef.current = () => controller.abort()
      preloadTrack(nextTrack.id, nextTrack.id, { signal: controller.signal }).catch(() => {})
    }

    // 캐시 정리: prev + current + next만 유지
    const keepIds = [track.id]
    if (currentIndex > 0) keepIds.push(playlist[currentIndex - 1].id)
    if (nextTrack) keepIds.push(nextTrack.id)
    releaseAllExcept(keepIds)
  }, [track?.id, playlist])

  // 재생 상태 동기화 — UI 버튼으로 play/pause 토글
  useEffect(() => {
    // WebAudioFallbackPlayer 모드 (FLAC/OGG on iOS)
    if (isFallbackMode && fallbackPlayerRef.current) {
      // @ts-ignore
      const ctx = fallbackPlayerRef.current.audioContext
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
      if (isPlaying) fallbackPlayerRef.current.play()
      else fallbackPlayerRef.current.pause()
      return
    }

    // Standard <audio> 모드
    if (!audioRef.current) return
    if (isPlaying) {
      unlockAllAudioContexts().catch(() => {})
      if (audioRef.current.readyState >= 2) {
        audioRef.current.play().catch((e) => console.warn('Play state sync blocked:', e))
      }
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, isFallbackMode])

  // 볼륨 동기화 (모바일: EQ 미사용 — createMediaElementSource가 iOS에서 무음 유발)
  useEffect(() => {
    const effectiveVolume = (isMuted || volume < 0.01) ? 0 : volume

    // WebAudioFallbackPlayer 볼륨/속도 동기화
    if (fallbackPlayerRef.current) {
      fallbackPlayerRef.current.setVolume(effectiveVolume)
      fallbackPlayerRef.current.setPlaybackRate(playbackRate)
    }

    if (!audioRef.current) return
    // 모바일에서는 Equalizer 사용 안 함 — <audio> 태그 직접 볼륨 제어
    audioRef.current.volume = effectiveVolume
    audioRef.current.playbackRate = playbackRate
  }, [volume, isMuted, playbackRate])

  useEffect(() => {
    if (equalizerRef.current) {
      eqGains.forEach((g, i) => equalizerRef.current!.setGain(i, g))
    }
  }, [eqGains])

  // fallback 모드에서는 WebAudioFallbackPlayer가 onTimeUpdate 콜백으로 직접 처리
  const handleTimeUpdate = () => { 
    if (isFallbackMode) return // fallback은 player.onTimeUpdate 콜백이 담당
    if (audioRef.current && !isSeeking) {
      const t = audioRef.current.currentTime
      setCurrentTime(t)
      seekTimeRef.current = t
    }
  }
  const handleProgress = () => {
    if (isFallbackMode) return // fallback은 전체 파일을 메모리에 로드하므로 버퍼 100%
    if (audioRef.current && audioRef.current.buffered.length > 0 && audioRef.current.duration > 0) {
      const bufferedEnd = audioRef.current.buffered.end(audioRef.current.buffered.length - 1)
      setBufferProgress(bufferedEnd / audioRef.current.duration)
    }
  }
  const handleLoadedMetadata = () => { 
    if (isFallbackMode) return // fallback은 player.onDurationChange 콜백이 담당
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
    if (isFallbackMode && fallbackPlayerRef.current) {
      fallbackPlayerRef.current.seek(seekTimeRef.current)
    } else if (audioRef.current) {
      audioRef.current.currentTime = seekTimeRef.current
    }
    setIsSeeking(false)
  }

  const handleNextWrapped = () => {
    if (!track) return
    if (repeatMode === 'one') {
      if (isFallbackMode && fallbackPlayerRef.current) {
        fallbackPlayerRef.current.seek(0)
        fallbackPlayerRef.current.play()
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }
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
    if (currentTime > 3) {
      if (isFallbackMode && fallbackPlayerRef.current) fallbackPlayerRef.current.seek(0)
      else if (audioRef.current) audioRef.current.currentTime = 0
    } else { playPrev() }
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
    // [FIX] localCoverArt를 최우선으로 사용 (비동기 로드 후 재갱신됨)
    let mediaArt = localCoverArt || track.cover_art || track.thumbnailLink || null
    if (typeof mediaArt === 'string' && !mediaArt.includes('[object Object]')) {
      // data URI는 type 지정 불필요, http URL은 image/jpeg로 추정
      const imgType = mediaArt.startsWith('data:') ? mediaArt.split(';')[0].split(':')[1] : 'image/png'
      artwork.push({ src: mediaArt, sizes: '512x512', type: imgType })
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album, artwork })
    try {
      navigator.mediaSession.setActionHandler('play', () => handleTogglePlay())
      navigator.mediaSession.setActionHandler('pause', () => handleTogglePlay())
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevWrapped())
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNextWrapped())
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime
          setCurrentTime(details.seekTime)
        }
      })
    } catch (e) { console.warn('Media Session Action Error:', e) }
  }, [track, localCoverArt])

  useEffect(() => {
    if (!navigator.mediaSession) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    if (validDuration > 0 && isFinite(validDuration)) {
      try {
        const position = isFallbackMode && fallbackPlayerRef.current
          ? fallbackPlayerRef.current.currentTime
          : (audioRef.current?.currentTime ?? 0)
        const rate = isFallbackMode ? playbackRate : (audioRef.current?.playbackRate ?? 1)
        navigator.mediaSession.setPositionState({
          duration: validDuration,
          playbackRate: rate,
          position: Math.min(position, validDuration)
        })
      } catch (e) { }
    }
  }, [isPlaying, validDuration, playbackRate, isSeeking, isFallbackMode])

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
    if (isFallbackMode) return // WebAudioFallbackPlayer has its own error handling
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
        onProgress={handleProgress}
      />

      {/* DEBUG OVERLAY - FLAC 재생 디버깅용 (배포 후 제거) */}
      {debugLog.length > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', color: '#0f0', fontSize: '10px',
          padding: '4px 8px', maxHeight: '40vh', overflow: 'auto',
          fontFamily: 'monospace', lineHeight: '1.4'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <b>🔧 FLAC Debug</b>
            <button onClick={() => setDebugLog([])} style={{ color: '#f00', background: 'none', border: 'none', fontSize: '10px' }}>CLEAR</button>
          </div>
          {debugLog.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}

      {/* ---- 미니 플레이어 (Precision Instrument Style) ---- */}
      {!isExpanded && (
        <motion.div
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-[90px] left-2 right-2 h-[68px] z-[90] cursor-pointer rounded-lg shadow-[var(--shadow-floating)] border border-[var(--border-light)] overflow-hidden"
          style={{ background: 'var(--bg-surface)' }}
          onClick={() => setExpanded(true)}
        >
          {/* 상단 프로그레스 바 (버퍼 + 재생) */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--bg-container-highest)]">
            <div className="absolute inset-0 h-full bg-[var(--tertiary)] transition-all duration-500" style={{ width: `${(loadProgress !== null ? loadProgress : bufferProgress) * 100}%`, opacity: 0.25 }} />
            <div className="absolute inset-0 h-full bg-[var(--tertiary)] transition-all duration-200" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center h-full px-3 gap-3">
            {/* 앨범아트 */}
            <div className="w-12 h-12 bg-[var(--bg-container)] border border-[var(--border-strong)] shrink-0 overflow-hidden flex items-center justify-center rounded-sm shadow-[var(--shadow-ambient)]">
              {displayArt ? <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} /> : <Icon.Music size={18} className="text-[var(--text-muted)] opacity-50" />}
            </div>
            {/* 곡 정보 */}
            <div className="flex-1 min-w-0">
              <p className="font-['Noto_Serif'] font-bold text-[15px] text-[var(--text-main)] truncate tracking-tight">{displayTitle}</p>
              <p className="font-['Work_Sans'] text-[11px] text-[var(--text-muted)] truncate font-medium">{track.artist || 'Unknown Artist'}</p>
            </div>
            {/* 컨트롤 */}
            <div className="flex items-center gap-2 pr-1">
              <button onClick={(e) => { e.stopPropagation(); handleTogglePlay(); }} className="w-10 h-10 flex items-center justify-center text-[var(--tertiary)] hover:text-[var(--primary)] transition-colors active:scale-90">
                {isPlaying ? <Icon.Pause size={24} fill="currentColor" /> : <Icon.Play size={24} fill="currentColor" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleNextWrapped(); }} className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors active:scale-90">
                <Icon.SkipForward size={20} fill="currentColor" />
              </button>
            </div>
          </div>
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
            className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] touch-none overflow-hidden analog-surface"
          >
            {/* 배경 텍스처 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            </div>

            {/* 상단 핸들바 */}
            <div className="flex justify-center pt-3 pb-1 cursor-pointer shrink-0 relative z-10" onClick={() => setExpanded(false)}>
              <div className="w-12 h-[4px] rounded-full bg-[var(--border-strong)]" />
            </div>

            {/* 닫기 버튼 */}
            <div className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 z-20">
              <button onClick={() => setExpanded(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                <Icon.ChevronDown size={28} />
              </button>
            </div>

            <div className="flex-1 flex flex-col landscape:flex-row px-6 pt-2 pb-4 overflow-hidden relative z-10 justify-between">
               
              {/* ===== 메인 콘텐츠 영역 ===== */}
              <div className="flex-1 flex flex-col justify-center min-h-0 mb-4 landscape:mb-0 landscape:mr-6 relative">
                {viewMode === 'queue' ? (
                  /* ===== A. 대기열 ===== */
                  <div className="w-full h-full overflow-y-auto space-y-1.5 py-2 analog-scrollbar">
                    <h3 className="font-['Work_Sans'] text-xs font-bold tracking-[0.15em] text-[var(--tertiary)] uppercase mb-4 sticky top-0 py-2 z-10 flex justify-between items-center bg-[var(--bg-surface)]">
                      Up Next Queue
                      <button onClick={toggleSpeed} className="border border-[var(--border-strong)] rounded-sm px-3 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition font-['Work_Sans'] font-bold uppercase tracking-wider">
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
                          className={`flex items-center gap-3 p-3 cursor-pointer transition-all rounded-md border ${t.id === track.id ? 'bg-[var(--bg-container-high)] border-[var(--border-strong)] shadow-[var(--shadow-pressed)]' : 'border-transparent hover:bg-[var(--bg-container)] hover:border-[var(--border-light)]'}`}
                        >
                          <div className="w-11 h-11 bg-[var(--bg-container)] border border-[var(--border-strong)] rounded-sm flex items-center justify-center shrink-0 overflow-hidden relative shadow-[var(--shadow-ambient)]">
                            <Icon.Music size={16} className="text-[var(--text-muted)] absolute opacity-50"/>
                            {art && <img src={art} loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover relative z-10" onError={(e) => e.currentTarget.style.display='none'}/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-['Noto_Serif'] text-sm truncate tracking-tight ${t.id === track.id ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-main)]'}`}>{t.title || t.name}</p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate font-['Work_Sans'] font-medium">{t.artist || 'Unknown'}</p>
                          </div>
                          {t.id === track.id && <div className="w-2 h-2 rounded-full bg-[var(--tertiary)] shadow-[0_0_8px_var(--tertiary)]" />}
                        </div>
                      )
                    })}
                  </div>
                ) : viewMode === 'lyrics' ? (
                  /* ===== B. 가사 ===== */
                  <div 
                    className="w-full h-full overflow-y-auto overflow-x-hidden text-center space-y-6 py-10 px-4 analog-scrollbar"
                    onClick={() => setViewMode('art')}
                  >
                    {hasLyrics ? (
                      parsedLyrics ? (
                        parsedLyrics.map((line, i) => (
                          <p 
                            key={i} 
                            ref={i === currentLyricIndex ? activeLyricRef : null}
                            className={`font-['Noto_Serif'] text-xl font-bold transition-all duration-300 cursor-pointer leading-relaxed ${
                              i === currentLyricIndex 
                                ? 'text-[var(--text-main)] scale-105 opacity-100' 
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] opacity-50'
                            } ${line.text ? '' : 'h-6'}`}
                            onClick={(e) => { e.stopPropagation(); if (audioRef.current) audioRef.current.currentTime = line.time }}
                          >
                            {line.text}
                          </p>
                        ))
                      ) : (
                        displayLyrics!.split('\n').map((line: string, i: number) => (
                          <p key={i} className="font-['Noto_Serif'] text-lg text-[var(--text-muted)] leading-relaxed">{line}</p>
                        ))
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] space-y-4 min-h-[300px]">
                        <Icon.Mic2 size={48} className={`opacity-40 ${lyricsLoading || metaLoading ? 'animate-pulse' : ''}`}/>
                        {(metaLoading || lyricsLoading) && <p className="text-xs text-[var(--tertiary)] animate-pulse font-['Work_Sans'] tracking-widest font-bold uppercase">Scanning Lyrics...</p>}
                      </div>
                    )}
                  </div>
                ) : viewMode === 'eq' ? (
                  /* ===== D. 이퀄라이저 ===== */
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-10 text-center px-4 bg-[var(--bg-container-low)] rounded-lg border border-[var(--border-light)] shadow-[var(--shadow-pressed)] my-4">
                    <h3 className="font-['Work_Sans'] text-xs font-bold tracking-[0.2em] text-[var(--text-main)] uppercase pt-8">Frequency Calibration</h3>
                    <div className="flex gap-4 sm:gap-6 md:gap-10 h-56 items-end justify-center w-full max-w-md pb-6">
                      {['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'].map((label, idx) => (
                        <div key={idx} className="flex flex-col items-center h-full gap-4">
                          <span className="text-[10px] font-['Work_Sans'] font-bold text-[var(--text-muted)] tracking-wider">{label}</span>
                          <div className="relative flex-1 w-3 sm:w-4 bg-[var(--bg-container-highest)] border border-[var(--border-strong)] flex items-end overflow-hidden group rounded-full shadow-[var(--shadow-pressed)]">
                            <div className="w-full transition-all duration-300 rounded-full" 
                              style={{ 
                                height: `${(eqGains[idx] + 12) / 24 * 100}%`,
                                background: 'var(--primary)'
                              }} 
                            />
                            <input 
                              type="range" min="-12" max="12" step="0.1" 
                              value={eqGains[idx]} 
                              onChange={(e) => setEqGain(idx, Number(e.target.value))}
                              className="absolute inset-0 -rotate-90 origin-center opacity-0 cursor-pointer h-full z-30" 
                              style={{ width: '224px', height: '12px', left: '-106px', top: '106px' }}
                            />
                          </div>
                          <span className="text-[10px] font-['Work_Sans'] font-bold text-[var(--text-main)] w-10 text-center bg-[var(--bg-surface)] py-1 border border-[var(--border-light)] rounded-sm">
                            {eqGains[idx] > 0 ? `+${eqGains[idx].toFixed(1)}` : eqGains[idx].toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { eqGains.forEach((_, i) => setEqGain(i, 0)) }} 
                      className="mb-8 px-6 py-2 border border-[var(--border-strong)] rounded-md text-xs font-['Work_Sans'] font-bold tracking-widest text-[var(--text-main)] hover:border-[var(--tertiary)] hover:text-[var(--tertiary)] hover:bg-[var(--tertiary)]/5 transition-all uppercase shadow-sm bg-[var(--bg-surface)]">
                      Reset EQ
                    </button>
                  </div>
                ) : (
                  /* ===== C. 앨범 아트 ===== */
                  <div className="w-full h-full flex items-center justify-center p-4 landscape:p-1">
                    <div className="relative group w-[min(85vw,50vh)] landscape:w-[min(85vh,40vw)] landscape:h-[min(85vh,40vw)]">
                      {/* 메인 아트 */}
                      <div className="aspect-square w-full bg-[var(--bg-container)] border border-[var(--border-strong)] overflow-hidden relative shadow-[var(--shadow-ambient)] rounded-md">
                        {displayArt ? (
                          <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-surface)]">
                            <Icon.Music size={64} className="text-[var(--text-muted)] opacity-30" />
                            <span className="text-[10px] font-['Work_Sans'] font-bold text-[var(--text-muted)] mt-4 tracking-[0.2em] uppercase">NO ARTWORK</span>
                          </div>
                        )}
                        {/* 포맷 라벨 */}
                        {displayArt && (
                          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                            <div className="bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-strong)] px-2 py-0.5 rounded-sm">
                              <span className="text-[9px] font-['Work_Sans'] text-[var(--tertiary)] font-bold tracking-wider uppercase">{(track as any).mimeType?.replace('audio/', '') || 'AUDIO'}</span>
                            </div>
                          </div>
                        )}
                        {metaLoading && (
                          <div className="absolute top-3 left-3 bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-strong)] px-3 py-1 flex items-center gap-2 rounded-sm">
                            <Icon.Gauge size={10} className="text-[var(--tertiary)] animate-spin"/>
                            <span className="text-[9px] font-['Work_Sans'] font-bold text-[var(--tertiary)] tracking-wider">ANALYZING...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== 하단 컨트롤 영역 ===== */}
              <div className="shrink-0 flex flex-col justify-end landscape:justify-center landscape:w-1/2 landscape:gap-2">
                {/* 곡 정보 */}
                <div className="mb-4 landscape:mb-1 px-1">
                  <div className="flex justify-between items-center">
                    <div 
                      className="flex-1 min-w-0 mr-4 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setShowFullTitle(!showFullTitle); }}
                    >
                      <h2 className={`font-['Noto_Serif'] text-2xl font-bold text-[var(--text-main)] mb-1 tracking-tight ${showFullTitle ? 'break-words whitespace-normal' : 'truncate'}`}>{displayTitle}</h2>
                      <p className="font-['Work_Sans'] text-sm text-[var(--tertiary)] truncate tracking-wider font-medium uppercase">{track.artist || 'Unknown Artist'}</p>
                    </div>
                    <button 
                      onClick={async (e) => { 
                        e.stopPropagation();
                        if(audioRef.current) {
                          const res = await addBookmark(track, audioRef.current.currentTime);
                          if (res.success) alert('북마크가 저장되었습니다!');
                          else alert('저장 실패: ' + res.error);
                        }
                      }} 
                      className="p-3 bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--tertiary)] transition-colors border border-[var(--border-strong)] rounded-full shadow-sm active:scale-95"
                    >
                      <Icon.Bookmark size={20} fill="currentColor" />
                    </button>
                    <button 
                      onClick={async (e) => { 
                        e.stopPropagation();
                        if (!showPlaylistPopup) {
                          try {
                            const { getPlaylists } = await import('@/app/actions/playlist')
                            const pls = await getPlaylists()
                            setPlaylists(pls)
                          } catch(err) { setPlaylists([]) }
                        }
                        setShowPlaylistPopup(!showPlaylistPopup)
                        setPlaylistAdded(false)
                      }} 
                      className={`p-3 bg-[var(--bg-surface)] transition-colors border border-[var(--border-strong)] rounded-full shadow-sm active:scale-95 ${showPlaylistPopup ? 'text-[var(--tertiary)]' : 'text-[var(--text-muted)] hover:text-[var(--tertiary)]'}`}
                    >
                      <Icon.Plus size={20} />
                    </button>
                  </div>
                  {/* 플레이리스트 추가 팝업 */}
                  <AnimatePresence>
                    {showPlaylistPopup && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="mt-2 bg-[var(--bg-container)] border border-[var(--border-strong)] rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {playlists.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-[var(--text-muted)] font-['Work_Sans']">플레이리스트가 없습니다</p>
                        ) : (
                          playlists.map((pl: any) => (
                            <button
                              key={pl.id}
                              onClick={async () => {
                                try {
                                  const { addTrackToPlaylist } = await import('@/app/actions/playlist')
                                  await addTrackToPlaylist(pl.id, track.id)
                                  setPlaylistAdded(true)
                                  setTimeout(() => setShowPlaylistPopup(false), 800)
                                } catch(err) { alert('추가 실패') }
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-[var(--bg-container-high)] transition-colors flex items-center gap-2 border-b border-[var(--border-light)] last:border-b-0"
                            >
                              <Icon.ListMusic size={16} className="text-[var(--tertiary)] shrink-0" />
                              <span className="text-sm text-[var(--text-main)] truncate font-['Work_Sans']">{pl.name}</span>
                            </button>
                          ))
                        )}
                        {playlistAdded && (
                          <div className="px-4 py-2 bg-[var(--tertiary)]/10 text-[var(--tertiary)] text-xs font-['Work_Sans'] font-bold flex items-center gap-1">
                            <Icon.Check size={14} /> 추가 완료!
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 진행 바 — 3-layer: 배경 → 버퍼(흐림) → 재생(진함) */}
                <div className="w-full mb-6 landscape:mb-2 group relative px-1">
                  <input 
                    type="range" min={0} max={validDuration || 100} step="any"
                    value={currentTime} 
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    onTouchEnd={handleSeekEnd}
                    className="absolute inset-0 w-full h-5 -translate-y-1 opacity-0 cursor-pointer z-10" 
                  />
                  <div className="h-1.5 bg-[var(--bg-container-highest)] w-full overflow-hidden rounded-full shadow-[var(--shadow-pressed)] relative">
                    {/* 버퍼 진행 (다운로드 또는 audio.buffered) */}
                    <div 
                      className="absolute inset-0 h-full bg-[var(--tertiary)] rounded-full transition-all duration-500 ease-out" 
                      style={{ 
                        width: `${(loadProgress !== null ? loadProgress : bufferProgress) * 100}%`,
                        opacity: 0.2 
                      }} 
                    />
                    {/* 재생 진행 */}
                    <div className="absolute inset-0 h-full bg-[var(--tertiary)] rounded-full transition-[width] duration-100" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-2 font-['Work_Sans'] font-medium">
                    <span>{formatTime(currentTime)}</span><span>{formatTime(validDuration)}</span>
                  </div>
                </div>

                {/* 메인 컨트롤 */}
                <div className="flex items-center justify-center gap-10 landscape:gap-8 mb-8 landscape:mb-2">
                  <button onClick={handlePrevWrapped} className="w-14 h-14 landscape:w-12 landscape:h-12 flex items-center justify-center text-[var(--primary)] hover:text-[var(--tertiary)] transition-all active:scale-90 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-full shadow-sm">
                    <Icon.SkipBack size={24} fill="currentColor" />
                  </button>
                   <button onClick={handleTogglePlay} className="w-20 h-20 landscape:w-16 landscape:h-16 flex items-center justify-center text-[var(--on-primary)] bg-[var(--primary)] hover:scale-105 transition-all active:scale-95 rounded-full shadow-[var(--shadow-ambient)]"
                  >
                    {isPlaying ? <Icon.Pause size={36} fill="currentColor" /> : <Icon.Play size={36} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={handleNextWrapped} className="w-14 h-14 flex items-center justify-center text-[var(--primary)] hover:text-[var(--tertiary)] transition-all active:scale-90 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-full shadow-sm">
                    <Icon.SkipForward size={24} fill="currentColor" />
                  </button>
                </div>

                {/* 하단 기능 버튼 */}
                <div className="flex justify-between items-center w-full px-2 pb-4 landscape:pb-0">
                  <button onClick={() => setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics')} className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${viewMode === 'lyrics' ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/15' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    <Icon.Mic2 size={22} />
                    <span className="text-[9px] font-['Work_Sans'] font-bold tracking-wider uppercase text-center">Lyrics</span>
                  </button>
                  <button onClick={() => setViewMode(viewMode === 'eq' ? 'art' : 'eq')} className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${viewMode === 'eq' ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/15' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    <Icon.Settings2 size={22} />
                    <span className="text-[9px] font-['Work_Sans'] font-bold tracking-wider uppercase text-center">EQ</span>
                  </button>
                  <button onClick={() => setIsShuffle(!isShuffle)} className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all relative ${isShuffle ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/15' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    <Icon.Shuffle size={20} />
                    <span className="text-[9px] font-['Work_Sans'] font-bold tracking-wider uppercase text-center">Shuffle</span>
                    {isShuffle && <span className="absolute top-1 right-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--tertiary)]" />}
                  </button>
                  <button onClick={toggleRepeat} className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all relative ${repeatMode !== 'off' ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/15' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    {repeatMode === 'one' ? <Icon.Repeat1 size={20} /> : <Icon.Repeat size={20} />}
                    <span className="text-[9px] font-['Work_Sans'] font-bold tracking-wider uppercase text-center">{repeatMode === 'one' ? 'Repeat 1' : 'Repeat'}</span>
                    {repeatMode !== 'off' && <span className="absolute top-1 right-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--tertiary)]" />}
                  </button>
                  <button onClick={() => setViewMode(viewMode === 'queue' ? 'art' : 'queue')} className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${viewMode === 'queue' ? 'text-[var(--tertiary)] bg-[var(--tertiary)]/15' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    <Icon.ListMusic size={22} />
                    <span className="text-[9px] font-['Work_Sans'] font-bold tracking-wider uppercase text-center">Queue</span>
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