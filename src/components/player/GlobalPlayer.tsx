'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/lib/store/usePlayerStore'
import { analyzeMusicMetadata } from '@/app/actions/metadata'
import { getExternalLyrics } from '@/app/actions/lyrics'
import { 
  Play, Pause, SkipBack, SkipForward, ChevronDown, ListMusic, MoreHorizontal,
  Shuffle, Volume2, VolumeX, Mic2, Gauge, Repeat, Repeat1, Music, Moon 
} from 'lucide-react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'

// [FIX] Lucide 아이콘 타입 에러 해결을 위한 래퍼
const Icon = {
  Play: Play as any,
  Pause: Pause as any,
  SkipBack: SkipBack as any,
  SkipForward: SkipForward as any,
  ChevronDown: ChevronDown as any,
  ListMusic: ListMusic as any,
  MoreHorizontal: MoreHorizontal as any,
  Shuffle: Shuffle as any,
  Volume2: Volume2 as any,
  VolumeX: VolumeX as any,
  Mic2: Mic2 as any,
  Gauge: Gauge as any,
  Repeat: Repeat as any,
  Repeat1: Repeat1 as any,
  Music: Music as any,
  Moon: Moon as any
}

// [NEW] 가사 캐시 (메모리) - 앱 실행 중 유지
const lyricsCache = new Map<string, string | null>()

export default function GlobalPlayer() {
  const { 
    currentTrack: track, playlist, setTrack, isPlaying, togglePlay, 
    playNext, playPrev, isExpanded, setExpanded, updateTrackMetadata
  } = usePlayerStore()

  const audioRef = useRef<HTMLAudioElement>(null)
  // [NEW] 현재 재생 중인 곡을 가리키는 ref (스크롤 이동용)
  const activeTrackRef = useRef<HTMLDivElement>(null)
  const activeLyricRef = useRef<HTMLParagraphElement>(null)
  // [NEW] 탐색 중인 시간을 저장하는 ref (상태 클로저 문제 해결용)
  const seekTimeRef = useRef<number>(0)
  // [NEW] Web Audio API 관련 ref (iOS 볼륨 조절용)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const touchStartRef = useRef<{x: number, y: number} | null>(null)
  // [NEW] 에러 발생 시 재시도 횟수 제한
  const retryCountRef = useRef(0)
  
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [isShuffle, setIsShuffle] = useState(false)
  const [viewMode, setViewMode] = useState<'art' | 'lyrics' | 'queue'>('art') // art: 기본, lyrics: 가사, queue: 대기열
  const [metaLoading, setMetaLoading] = useState(false)
  // [NEW] 가사 로딩 상태 추가
  const [lyricsLoading, setLyricsLoading] = useState(false)
  // [NEW] 화면에 표시할 최종 가사 (내장 or 외부)
  const [displayLyrics, setDisplayLyrics] = useState<string | null>(null)
  const [parsedLyrics, setParsedLyrics] = useState<{time: number, text: string}[] | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [isSeeking, setIsSeeking] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [sleepTimer, setSleepTimer] = useState<number>(0) // 0: off, minutes

  // 1. 중복 방지 로그
  useEffect(() => { console.log("GlobalPlayer Mounted") }, [])

  // [NEW] 재생 목록 열릴 때 현재 곡으로 자동 스크롤
  useEffect(() => {
    if (viewMode === 'queue' && activeTrackRef.current) {
        activeTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [viewMode, track?.id])

  // [NEW] 가사 로드 및 파싱 로직 (설정 반영)
  useEffect(() => {
    if (!track) return

    const loadLyrics = async () => {
        // 0. 캐시 확인 (이미 불러온 적 있으면 즉시 사용)
        if (lyricsCache.has(track.id)) {
            const cached = lyricsCache.get(track.id)
            // [FIX] 캐시된 값이 유효한 문자열일 때만 즉시 사용.
            // null인 경우(이전에 못 찾음)에는 메타데이터 로드 후 내장 가사가 생겼을 수 있으므로 다시 시도.
            if (cached) {
                setDisplayLyrics(cached)
                return
            }
        }

        setLyricsLoading(true)
        setDisplayLyrics(null) // [FIX] 로딩 중 이전 가사 잔상 방지

        // 1. 설정 불러오기
        const settings = JSON.parse(localStorage.getItem('slowi_lyrics_settings') || '{"autoSearch":true,"order":["synced","alsong","lrclib","unsynced"]}')
        const order = settings.order || ['synced', 'alsong', 'lrclib', 'unsynced']
        
        // 2. 내장 가사 분석
        const embeddedLyrics = (track.lyrics && !track.lyrics.includes('[object Object]')) ? track.lyrics : null
        const isEmbeddedSynced = embeddedLyrics && /\[\d{1,3}:\d{2}/.test(embeddedLyrics)

        let finalLyrics = null
        const externalSourcesToTry: string[] = []

        // 3. 우선순위 순회
        for (const type of order) {
            if (finalLyrics) break // 이미 찾았으면 종료

            if (type === 'synced') {
                if (isEmbeddedSynced) {
                    // [FIX] 대기 중인 외부 소스가 있다면 먼저 시도 (우선순위 준수)
                    if (externalSourcesToTry.length > 0) {
                        const res = await getExternalLyrics(track.artist || '', track.title || track.name, (track as any).duration, externalSourcesToTry)
                        if (res.success) finalLyrics = res.lyrics
                        else finalLyrics = embeddedLyrics // 실패 시 내장 사용
                        externalSourcesToTry.length = 0 // 처리 완료
                    } else {
                        finalLyrics = embeddedLyrics
                    }
                }
            } else if (type === 'unsynced') {
                if (embeddedLyrics && !isEmbeddedSynced) {
                    if (externalSourcesToTry.length > 0) {
                        const res = await getExternalLyrics(track.artist || '', track.title || track.name, (track as any).duration, externalSourcesToTry)
                        if (res.success) finalLyrics = res.lyrics
                        else finalLyrics = embeddedLyrics
                        externalSourcesToTry.length = 0
                    } else {
                        finalLyrics = embeddedLyrics
                    }
                }
            } else if (type === 'alsong' || type === 'lrclib') {
                // 외부 소스는 모아서 한 번에 요청 (병렬 처리 효율화)
                if (settings.autoSearch) externalSourcesToTry.push(type === 'alsong' ? 'Alsong' : 'LRCLIB')
            }
        }

        // 4. 외부 가사 검색이 필요한 경우 (우선순위에 따라 내장 가사를 못 찾았을 때)
        if (!finalLyrics && externalSourcesToTry.length > 0) {
            // [속도 개선] 필요한 소스들만 병렬로 요청
            const res = await getExternalLyrics(track.artist || '', track.title || track.name, (track as any).duration, externalSourcesToTry)
            if (res.success) {
                finalLyrics = res.lyrics
            }
        }

        // 5. 만약 외부 검색도 실패했는데, 순위가 낮아서 선택 안 된 내장 가사가 있다면 최후의 수단으로 사용
        if (!finalLyrics && embeddedLyrics) {
             // 예: 사용자가 외부 우선으로 설정했으나 외부 가사가 없을 때 -> 내장 가사라도 보여줌
             finalLyrics = embeddedLyrics
        }

        // 6. 결과 캐싱 및 적용
        lyricsCache.set(track.id, finalLyrics)
        setDisplayLyrics(finalLyrics)
        setLyricsLoading(false)

        // [NEW] 다음 곡 가사 미리 불러오기 (Prefetch)
        const currentIndex = playlist.findIndex(p => p.id === track.id)
        if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
            const nextTrack = playlist[currentIndex + 1]
            if (!lyricsCache.has(nextTrack.id)) {
                // 조용히 백그라운드에서 실행 (결과는 캐시에 저장됨)
                prefetchLyrics(nextTrack, settings)
            }
        }
    }

    loadLyrics()
  }, [track?.id, track?.lyrics]) // track 변경 시 실행

  // [NEW] 가사 프리패치 함수 (로직은 loadLyrics와 유사하지만 상태 업데이트 없음)
  const prefetchLyrics = async (targetTrack: any, settings: any) => {
      try {
        const embeddedLyrics = (targetTrack.lyrics && !targetTrack.lyrics.includes('[object Object]')) ? targetTrack.lyrics : null
        const isEmbeddedSynced = embeddedLyrics && /\[\d{1,3}:\d{2}/.test(embeddedLyrics)
        const order = settings.order || ['synced', 'alsong', 'lrclib', 'unsynced']
        
        let finalLyrics = null
        const externalSourcesToTry: string[] = []

        for (const type of order) {
            if (finalLyrics) break
            if (type === 'synced' && isEmbeddedSynced) {
                if (externalSourcesToTry.length > 0) {
                    const res = await getExternalLyrics(targetTrack.artist || '', targetTrack.title || targetTrack.name, targetTrack.duration, externalSourcesToTry)
                    if (res.success) finalLyrics = res.lyrics
                    else finalLyrics = embeddedLyrics
                    externalSourcesToTry.length = 0
                } else {
                    finalLyrics = embeddedLyrics
                }
            } else if (type === 'unsynced' && embeddedLyrics && !isEmbeddedSynced) {
                if (externalSourcesToTry.length > 0) {
                    const res = await getExternalLyrics(targetTrack.artist || '', targetTrack.title || targetTrack.name, targetTrack.duration, externalSourcesToTry)
                    if (res.success) finalLyrics = res.lyrics
                    else finalLyrics = embeddedLyrics
                    externalSourcesToTry.length = 0
                } else {
                    finalLyrics = embeddedLyrics
                }
            }
            else if ((type === 'alsong' || type === 'lrclib') && settings.autoSearch) externalSourcesToTry.push(type === 'alsong' ? 'Alsong' : 'LRCLIB')
        }

        if (!finalLyrics && externalSourcesToTry.length > 0) {
            const res = await getExternalLyrics(targetTrack.artist || '', targetTrack.title || targetTrack.name, targetTrack.duration, externalSourcesToTry)
            if (res.success) finalLyrics = res.lyrics
        }
        if (!finalLyrics && embeddedLyrics) finalLyrics = embeddedLyrics
        
        if (finalLyrics) {
            lyricsCache.set(targetTrack.id, finalLyrics)
            console.log(`Prefetched lyrics for: ${targetTrack.name}`)
        }
      } catch (e) { /* ignore */ }
  }

  // [NEW] displayLyrics가 변경되면 파싱
  useEffect(() => {
    if (displayLyrics) {
      const parsed = parseLRC(displayLyrics)
      setParsedLyrics(parsed)
    } else {
      setParsedLyrics(null)
    }
    setCurrentLyricIndex(-1)
  }, [displayLyrics])

  // [NEW] 가사 싱크 맞추기
  useEffect(() => {
    if (!parsedLyrics) return
    
    // 현재 시간보다 이른 가사 중 가장 뒤에 있는 것 찾기
    let activeIdx = -1
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTime + 0.2) { // 0.2초 보정 (반응 속도 고려)
        activeIdx = i
      } else {
        break
      }
    }
    if (activeIdx !== currentLyricIndex) {
      setCurrentLyricIndex(activeIdx)
    }
  }, [currentTime, parsedLyrics])

  // [NEW] 가사 스크롤
  useEffect(() => {
    if (viewMode === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLyricIndex, viewMode])

  // 2. 곡 변경 및 메타데이터 로딩
  useEffect(() => {
    if (!track) return

    setCurrentTime(0)
    setMetaLoading(false)
    // setViewMode('art') // [삭제] 곡이 바뀌어도 현재 뷰 모드(가사창 등) 유지

    const fetchMetadata = async () => {
      // 제목, 아티스트, 커버, 가사(object 아님)가 다 있으면 패스
      if (track.title && track.artist && track.artist !== 'Unknown Artist' && 
          track.cover_art && !track.cover_art.includes('[object Object]') &&
          track.lyrics && !track.lyrics.includes('[object Object]')) {
        return
      }

      setMetaLoading(true)
      try {
        const result = await analyzeMusicMetadata(track.id)
        if (result.success && result.data) {
           updateTrackMetadata(track.id, result.data)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setMetaLoading(false)
      }
    }

    fetchMetadata()

    if (audioRef.current) {
        // [FIX] 오프라인 파일(Blob URL) 지원: src가 http나 blob으로 시작하면 그대로 사용
        const newSrc = ((track as any).src && ((track as any).src.startsWith('http') || (track as any).src.startsWith('blob')))
            ? (track as any).src 
            : `/api/stream?id=${track.id}`
            
        if (audioRef.current.src.indexOf(track.id) === -1) {
            audioRef.current.src = newSrc
            audioRef.current.playbackRate = playbackRate
            audioRef.current.volume = isMuted ? 0 : volume
            audioRef.current.crossOrigin = "anonymous" // Web Audio API 사용 시 필요
            retryCountRef.current = 0 // 트랙 변경 시 재시도 횟수 초기화
            audioRef.current.load()
            if (isPlaying) audioRef.current.play().catch(() => {})
        }
    }
  }, [track?.id])

  // 3. 상태 동기화
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      // [NEW] AudioContext 재개 (iOS 등에서 자동 재생 정책 대응)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying])

  // [FIX] 볼륨 조절 (Web Audio API 사용)
  useEffect(() => {
    if (!audioRef.current) return
    
    // AudioContext 초기화 (한 번만 실행)
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        audioContextRef.current = new AudioContext()
        gainNodeRef.current = audioContextRef.current.createGain()
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current)
        
        sourceNodeRef.current.connect(gainNodeRef.current)
        gainNodeRef.current.connect(audioContextRef.current.destination)
      }
    }

    const effectiveVolume = (isMuted || volume < 0.01) ? 0 : volume;

    // GainNode가 있으면 Gain으로 조절 (iOS 대응)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = effectiveVolume;
      // 오디오 태그 자체 볼륨은 1로 유지 (Gain으로 조절하므로)
      audioRef.current.volume = 1; 
    } else {
      // Fallback
      audioRef.current.volume = effectiveVolume;
    }
    
    audioRef.current.playbackRate = playbackRate
  }, [volume, isMuted, playbackRate])

  const handleTimeUpdate = () => { 
    if (audioRef.current && !isSeeking) {
      const t = audioRef.current.currentTime
      setCurrentTime(t)
      seekTimeRef.current = t // [FIX] 재생 중에도 ref를 동기화하여 클릭 시 점프 방지
    }
  }
  // [FIX] 메타데이터 로드 시 duration 설정 (Infinity 방지)
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

  // [FIX] 반복 재생 및 셔플 로직 개선
  const handleNextWrapped = () => {
    if (!track) return

    if (repeatMode === 'one') {
        if (audioRef.current) {
            audioRef.current.currentTime = 0
            audioRef.current.play().catch(() => {})
        }
        return
    }

    if (isShuffle && playlist.length > 0) {
        setTrack(playlist[Math.floor(Math.random() * playlist.length)])
    } else {
        // 마지막 곡인지 확인
        const currentIndex = playlist.findIndex(p => p.id === track.id)
        const isLast = currentIndex === playlist.length - 1

        if (isLast) {
            if (repeatMode === 'all') {
                setTrack(playlist[0])
            } else {
                // 반복 없음이면 정지
                if (isPlaying) togglePlay()
            }
        } else {
            playNext()
        }
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
    const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length
    setRepeatMode(modes[nextIndex])
  }

  const toggleSleepTimer = () => {
    const times = [0, 15, 30, 60]
    const next = times[(times.indexOf(sleepTimer) + 1) % times.length]
    setSleepTimer(next)
  }

  useEffect(() => {
    if (sleepTimer === 0) return
    const timer = setTimeout(() => { if (isPlaying) togglePlay(); setSleepTimer(0); }, sleepTimer * 60 * 1000)
    return () => clearTimeout(timer)
  }, [sleepTimer]) // isPlaying 의존성 제거 (설정된 시간 후 무조건 정지)

  // [MOVED & FIX] 유효한 duration 계산 (Media Session API 연동을 위해 위로 이동)
  const validDuration = track 
    // iOS Safari에서 duration이 Infinity일 경우 DB의 duration 사용
    ? ((duration && isFinite(duration) && duration > 0 && duration !== Infinity) 
        ? duration 
        : ((track as any).duration || 0))
    : 0

  // [NEW] Media Session API (iOS 잠금 화면 제어 및 메타데이터 표시)
  useEffect(() => {
    if (!track || !navigator.mediaSession) return

    // 1. 메타데이터 설정
    const title = track.title || track.name?.replace(/\.(mp3|wav|flac|m4a)$/i, '') || 'Unknown Title'
    const artist = track.artist || 'Unknown Artist'
    const album = track.album || 'Slowi Music'
    
    const artwork = []
    let displayArt = track.cover_art || track.thumbnailLink || null
    if (typeof displayArt === 'string' && !displayArt.includes('[object Object]')) {
        artwork.push({ src: displayArt, sizes: '512x512', type: 'image/png' })
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork
    })

    // 2. 액션 핸들러
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
    } catch (e) {
        console.warn('Media Session Action Error:', e)
    }
  }, [track])

  // [NEW] Media Session 상태 동기화
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
        } catch (e) {
            // ignore errors
        }
    }
  }, [isPlaying, validDuration, playbackRate, isSeeking])

  if (!track) return null

  const displayTitle = track.title || track.name.replace(/\.(mp3|wav|flac|m4a)$/i, '')
  let displayArt = track.cover_art || track.thumbnailLink || (track as any).thumbnail_link || null
  if (typeof displayArt === 'string' && displayArt.includes('[object Object]')) displayArt = null 

  // [FIX] 가사 체크 로직 수정: track.lyrics 대신 실제 표시될 displayLyrics 확인
  const hasLyrics = displayLyrics && displayLyrics.length > 0

  // [NEW] 드래그 종료 핸들러 (아래로 쓸어내리면 닫기)
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) { // 100px 이상 아래로 당기면 닫기
        setExpanded(false)
    }
  }

  // [NEW] 플레이어 스와이프 핸들러
  const handlePlayerTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handlePlayerTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    const diffX = touchStartRef.current.x - touchEnd.x
    const diffY = touchStartRef.current.y - touchEnd.y

    // 가로 스와이프 감지 (세로보다 가로가 크고, 100px 이상 - 민감도 완화)
    if (Math.abs(diffX) > 100 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
            // 왼쪽 -> 오른쪽 (DiffX 음수): 이전 곡 (요청사항 반영: 반대로 수정)
            handlePrevWrapped()
        } else {
            // 오른쪽 -> 왼쪽 (DiffX 양수): 다음 곡 (요청사항 반영: 반대로 수정)
            handleNextWrapped()
        }
    }
    touchStartRef.current = null
  }

  // [NEW] 오디오 에러 핸들러 (30분 후 끊김 방지용 재시도 로직)
  const handleAudioError = () => {
    if (!audioRef.current || !track) return
    const error = audioRef.current.error
    console.error("Audio Error:", error)

    // 네트워크 에러나 디코딩 에러 발생 시, 그리고 재시도 횟수가 3회 미만일 때
    if (retryCountRef.current < 3) {
        console.log(`Retrying playback... (${retryCountRef.current + 1}/3)`)
        retryCountRef.current += 1
        
        // src를 다시 로드 (세션 갱신이나 일시적 네트워크 이슈 대응)
        const currentSrc = audioRef.current.src
        audioRef.current.src = currentSrc
        audioRef.current.load()
        if (isPlaying) audioRef.current.play().catch(() => {})
    }
  }

  return (
    <>
      <audio 
        ref={audioRef} 
        preload="auto" 
        playsInline 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata} 
        onEnded={handleNextWrapped}
        onError={handleAudioError} 
      />

      {!isExpanded && (
        <motion.div
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-[90px] left-2 right-2 h-16 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-2xl flex items-center px-3 z-[90] shadow-2xl cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <div className={`w-10 h-10 rounded-lg bg-gray-800 overflow-hidden shrink-0 relative ${isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`}>
            {displayArt ? <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} /> : <div className="w-full h-full flex items-center justify-center text-gray-500"><Icon.Music size={20}/></div>}
          </div>
          <div className="flex-1 min-w-0 mx-3">
             <p className="font-bold text-sm text-white truncate">{displayTitle}</p>
             <p className="text-xs text-gray-400 truncate">{track.artist || 'Unknown Artist'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 flex items-center justify-center text-white">
              {isPlaying ? <Icon.Pause fill="white" size={20}/> : <Icon.Play fill="white" size={20}/>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleNextWrapped(); }} className="w-8 h-8 flex items-center justify-center text-gray-400">
               <Icon.SkipForward fill="currentColor" size={20} />
            </button>
          </div>
          <div className="absolute top-0 left-4 right-4 h-[2px] bg-gray-700 rounded-full overflow-hidden">
             <div className="h-full bg-blue-500" style={{ width: `${(currentTime / (validDuration || 1)) * 100}%` }} />
          </div>
        </motion.div>
      )}

      {/* 전체 화면 플레이어 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.2 }} onDragEnd={handleDragEnd}
            // [NEW] 가로 스와이프 이벤트 추가
            onTouchStart={handlePlayerTouchStart} onTouchEnd={handlePlayerTouchEnd}
            // [FIX] pt-12 제거하고 safe-area-inset-top 적용, h-[100dvh]로 꽉 채우기
            className="fixed top-0 left-0 w-full h-[100dvh] bg-gradient-to-b from-gray-900 to-black z-[100] flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] touch-none"
          >
            {/* 상단 핸들바 */}
            <div className="flex justify-center pt-2 pb-1 cursor-pointer shrink-0" onClick={() => setExpanded(false)}>
               <div className="w-12 h-1.5 bg-gray-700 rounded-full opacity-50" />
            </div>

            {/* 상단 닫기 버튼 (접근성) */}
            <div className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 z-20">
                <button onClick={() => setExpanded(false)} className="p-2 text-gray-400 hover:text-white"><Icon.ChevronDown size={32}/></button>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-2 pb-4 overflow-hidden relative justify-between">
               
               {/* 1. 메인 콘텐츠 영역 (앨범아트 / 가사 / 대기열) */}
               <div className="flex-1 flex flex-col justify-center min-h-0 mb-4 relative">
                   {viewMode === 'queue' ? (
                       /* A. 대기열 */
                       <div className="w-full h-full overflow-y-auto scrollbar-hide space-y-2 py-2">
                           <h3 className="text-lg font-bold mb-4 sticky top-0 bg-black/90 backdrop-blur py-2 z-10 px-2">Up Next</h3>
                           {playlist.map((t, i) => {
                               const art = t.cover_art || t.thumbnailLink || (t as any).thumbnail_link
                               return (
                               <div 
                                 key={i} 
                                 ref={t.id === track.id ? activeTrackRef : null}
                                 onClick={() => setTrack(t)} 
                                 className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${t.id === track.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                               >
                                   <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
                                       <Icon.Music size={20} className="text-gray-500 absolute"/>
                                       {art && <img src={art} loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover relative z-10" onError={(e) => e.currentTarget.style.display='none'}/>}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <p className={`font-medium truncate ${t.id === track.id ? 'text-blue-400' : 'text-white'}`}>{t.title || t.name}</p>
                                       <p className="text-xs text-gray-500 truncate">{t.artist || 'Unknown'}</p>
                                   </div>
                                   {t.id === track.id && <Icon.Gauge size={16} className="text-blue-400 animate-pulse"/>}
                               </div>
                           )})}
                       </div>
                   ) : viewMode === 'lyrics' ? (
                       /* B. 가사 */
                       <div 
                         className="w-full h-full overflow-y-auto overflow-x-hidden text-center space-y-8 py-10 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" 
                         onClick={() => setViewMode('art')}
                       >
                           {hasLyrics ? (
                               parsedLyrics ? (
                                   parsedLyrics.map((line, i) => (
                                       <p 
                                         key={i} 
                                         ref={i === currentLyricIndex ? activeLyricRef : null}
                                         className={`text-2xl font-bold transition-all duration-500 cursor-pointer leading-relaxed ${i === currentLyricIndex ? 'text-white scale-105 opacity-100' : 'text-gray-600 hover:text-gray-400 opacity-60 blur-[1px]'} ${line.text ? '' : 'h-8'}`}
                                         onClick={(e) => {
                                             e.stopPropagation()
                                             if (audioRef.current) audioRef.current.currentTime = line.time
                                         }}
                                       >
                                         {line.text}
                                       </p>
                                   ))
                               ) : (
                                   displayLyrics!.split('\n').map((line: string, i: number) => (
                                       <p key={i} className="text-xl font-medium text-gray-300">{line}</p>
                                   ))
                               )
                           ) : (
                               <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 min-h-[300px]">
                                   <Icon.Mic2 size={48} className={`opacity-30 ${lyricsLoading || metaLoading ? 'animate-pulse' : ''}`}/>
                                   {/* [FIX] '가사가 없습니다' 문구 제거 및 로딩 상태 표시 */}
                                   {(metaLoading || lyricsLoading) && <p className="text-sm text-green-400 animate-pulse">가사 찾는 중...</p>}
                               </div>
                           )}
                       </div>
                   ) : (
                       /* C. 앨범 아트 (기본) */
                       <div className="w-full h-full flex items-center justify-center p-4">
                           {/* [FIX] min() 함수를 사용하여 가로/세로 중 작은 쪽에 맞춰 완벽한 정사각형 유지 */}
                           <div className="aspect-square mx-auto bg-gray-800 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/5 relative group" style={{ width: 'min(85vw, 50vh)' }}>
                               {displayArt ? <img src={displayArt} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-600"><span className="text-6xl mb-4">💿</span><span className="text-sm">No Art</span></div>}
                               {metaLoading && <div className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-full text-xs text-green-400 flex items-center gap-2 backdrop-blur-md"><Icon.Gauge size={12} className="animate-spin"/> Analyzing...</div>}
                           </div>
                       </div>
                   )}
               </div>

               {/* 하단 컨트롤 영역 래퍼 */}
               <div className="shrink-0 flex flex-col justify-end">
               {/* 2. 곡 정보 (제목/가수) */}
               <div className="mb-2 px-1 text-center">
                  <div className="flex justify-between items-end">
                      <div className="flex-1 min-w-0 mr-4">
                          <h2 className="text-2xl font-bold text-white mb-1 truncate leading-tight">{displayTitle}</h2>
                          <p className="text-lg text-gray-400 truncate">{track.artist || 'Unknown Artist'}</p>
                      </div>
                      {/* 좋아요/메뉴 버튼 자리 (필요시 추가) */}
                  </div>
               </div>

               {/* 3. 진행 바 (Scrubber) */}
               <div className="w-full mb-4 group relative px-1">
                  <input 
                    type="range" 
                    min={0} 
                    max={validDuration || 100} 
                    step="any"
                    value={currentTime} 
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    onTouchEnd={handleSeekEnd}
                    className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer z-10" 
                  />
                  <div className="h-1.5 bg-gray-700/50 rounded-full w-full overflow-hidden">
                     <div className="h-full bg-white rounded-full relative" style={{ width: `${(currentTime / (validDuration || 1)) * 100}%` }}>
                        {/* 핸들 (드래그 시 표시) */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity translate-x-1.5"/>
                     </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                     <span>{formatTime(currentTime)}</span><span>{formatTime(validDuration)}</span>
                  </div>
               </div>

               {/* 4. 메인 컨트롤 (재생/일시정지 등) */}
               <div className="flex items-center justify-center gap-8 mb-6 px-2">
                      <button onClick={handlePrevWrapped} className="text-white hover:text-gray-300 transition active:scale-90"><Icon.SkipBack size={40} fill="currentColor" /></button>
                      <button onClick={togglePlay} className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg active:scale-95">
                          {isPlaying ? <Icon.Pause size={36} fill="black" /> : <Icon.Play size={36} fill="black" className="ml-1"/>}
                      </button>
                      <button onClick={handleNextWrapped} className="text-white hover:text-gray-300 transition active:scale-90"><Icon.SkipForward size={40} fill="currentColor" /></button>
               </div>

               {/* 5. 3열: 볼륨(좌) - 셔플/반복(우) */}
               <div className="flex items-center justify-between gap-4 mb-6 px-2">
                  {/* 왼쪽: 볼륨 */}
                  <div className="flex items-center gap-3 flex-1 max-w-[180px]">
                      <button onClick={() => setIsMuted(!isMuted)} className="text-gray-500">
                          {isMuted || volume === 0 ? <Icon.VolumeX size={20}/> : <Icon.Volume2 size={20}/>}
                      </button>
                      <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full relative group">
                          <div className="absolute inset-0 h-full bg-gray-500 rounded-full" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
                          <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} onChange={(e) => setVolume(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                  </div>

                  {/* 오른쪽: 셔플 & 반복 */}
                  <div className="flex items-center gap-4">
                      <button onClick={() => setIsShuffle(!isShuffle)} className={`p-2 transition ${isShuffle ? 'text-green-500' : 'text-gray-500 hover:text-white'}`}>
                          <Icon.Shuffle size={20} />
                      </button>
                      <button onClick={toggleRepeat} className={`p-2 transition ${repeatMode !== 'off' ? 'text-green-500' : 'text-gray-500 hover:text-white'}`}>
                          {repeatMode === 'one' ? <Icon.Repeat1 size={20} /> : <Icon.Repeat size={20} />}
                      </button>
                  </div>
               </div>

               {/* 6. 하단 기능 버튼 (가사, 타이머, 리스트) */}
               <div className="flex justify-center gap-12 text-gray-400 pb-4">
                  <button onClick={() => setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics')} className={`p-3 rounded-full transition ${viewMode === 'lyrics' ? 'bg-gray-800 text-white' : 'hover:text-white'}`}>
                      <Icon.Mic2 size={24} />
                  </button>
                  
                  <button onClick={toggleSleepTimer} className={`p-3 rounded-full flex flex-col items-center gap-1 transition ${sleepTimer > 0 ? 'bg-gray-800 text-green-500' : 'hover:text-white'}`}>
                      <Icon.Moon size={24} />
                      {sleepTimer > 0 && <span className="text-[10px] font-bold absolute mt-6">{sleepTimer}m</span>}
                  </button>

                  <button onClick={() => setViewMode(viewMode === 'queue' ? 'art' : 'queue')} className={`p-3 rounded-full transition ${viewMode === 'queue' ? 'bg-gray-800 text-white' : 'hover:text-white'}`}>
                      <Icon.ListMusic size={24} />
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
  // [mm:ss.xx] 또는 [mm:ss] 형식 지원 (대괄호 앞뒤 공백 허용)
  const timeRegex = /\[\s*(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\s*\]/

  for (const line of lines) {
    const match = line.match(timeRegex)
    if (match) {
      const minutes = parseInt(match[1], 10)
      // [FIX] 초 단위 파싱 오류 수정 (문자열 연결 -> 소수점 처리)
      const seconds = parseFloat(match[2] + '.' + (match[3] || '0'))
      const time = minutes * 60 + seconds
      const text = line.replace(timeRegex, '').trim()
      result.push({ time, text })
    }
  }
  // [FIX] 시간 순서대로 정렬 (가사 파일 순서가 섞여있을 경우 대비)
  return result.length > 0 ? result.sort((a, b) => a.time - b.time) : null
}