/**
 * Web Audio API Fallback Player
 * 
 * iOS Safari does NOT support FLAC/OGG/OPUS streaming via <audio> tag.
 * However, AudioContext.decodeAudioData() CAN decode FLAC (iOS 11+).
 * 
 * This class fetches the entire file into memory, decodes it,
 * and plays it through an AudioBufferSourceNode.
 */

export type FallbackState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

export class WebAudioFallbackPlayer {
  private audioContext: AudioContext
  private audioBuffer: AudioBuffer | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  
  private _state: FallbackState = 'idle'
  private _startTime = 0      // audioContext.currentTime when playback started
  private _pauseOffset = 0    // how far into the buffer we were when paused
  private _duration = 0
  private _volume = 1
  private _playbackRate = 1
  
  private rafId: number | null = null
  
  // Callbacks
  public onTimeUpdate: ((currentTime: number) => void) | null = null
  public onEnded: (() => void) | null = null
  public onStateChange: ((state: FallbackState) => void) | null = null
  public onDurationChange: ((duration: number) => void) | null = null

  constructor(existingContext?: AudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    this.audioContext = existingContext || new AudioCtx()
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
  }

  get state() { return this._state }
  get duration() { return this._duration }
  get currentTime() {
    if (this._state === 'playing') {
      return this._pauseOffset + (this.audioContext.currentTime - this._startTime) * this._playbackRate
    }
    return this._pauseOffset
  }
  get volume() { return this._volume }

  private setState(s: FallbackState) {
    this._state = s
    this.onStateChange?.(s)
  }

  /**
   * Load a URL, fetch it entirely, decode it via Web Audio API.
   */
  async loadAndDecode(url: string): Promise<boolean> {
    this.stop()
    this.setState('loading')

    try {
      // Resume AudioContext if suspended (iOS requirement)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      
      // decodeAudioData returns a promise in modern browsers
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      this._duration = this.audioBuffer.duration
      this._pauseOffset = 0
      this.setState('ready')
      this.onDurationChange?.(this._duration)
      return true
    } catch (e) {
      console.error('[WebAudioFallback] Decode failed:', e)
      this.setState('error')
      return false
    }
  }

  play(offset?: number) {
    if (!this.audioBuffer) return
    if (this._state === 'playing') return

    // Resume context if needed
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    // Clean up previous source
    this.disconnectSource()

    const source = this.audioContext.createBufferSource()
    source.buffer = this.audioBuffer
    source.playbackRate.value = this._playbackRate
    source.connect(this.gainNode)
    
    source.onended = () => {
      // Only fire onEnded if we played to the end (not if stopped/seeked)
      if (this._state === 'playing') {
        const currentPos = this._pauseOffset + (this.audioContext.currentTime - this._startTime) * this._playbackRate
        if (currentPos >= this._duration - 0.1) {
          this.setState('idle')
          this._pauseOffset = 0
          this.stopTimeTracking()
          this.onEnded?.()
        }
      }
    }

    const startOffset = offset !== undefined ? offset : this._pauseOffset
    this._pauseOffset = startOffset
    this._startTime = this.audioContext.currentTime
    
    source.start(0, startOffset)
    this.sourceNode = source
    this.setState('playing')
    this.startTimeTracking()
  }

  pause() {
    if (this._state !== 'playing') return
    
    // Calculate current position
    this._pauseOffset += (this.audioContext.currentTime - this._startTime) * this._playbackRate
    
    this.disconnectSource()
    this.setState('paused')
    this.stopTimeTracking()
  }

  seek(time: number) {
    const clampedTime = Math.max(0, Math.min(time, this._duration))
    
    if (this._state === 'playing') {
      // Stop current, restart at new position
      this.disconnectSource()
      this._pauseOffset = clampedTime
      this.play(clampedTime)
    } else {
      this._pauseOffset = clampedTime
      this.onTimeUpdate?.(clampedTime)
    }
  }

  stop() {
    this.disconnectSource()
    this._pauseOffset = 0
    this.stopTimeTracking()
    this.setState('idle')
  }

  setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(1, vol))
    this.gainNode.gain.value = this._volume
  }

  setPlaybackRate(rate: number) {
    this._playbackRate = rate
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate
    }
  }

  destroy() {
    this.stop()
    this.gainNode.disconnect()
    // Don't close shared AudioContext
  }

  private disconnectSource() {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null
        this.sourceNode.stop()
        this.sourceNode.disconnect()
      } catch (e) { /* already stopped */ }
      this.sourceNode = null
    }
  }

  private startTimeTracking() {
    this.stopTimeTracking()
    const tick = () => {
      if (this._state === 'playing') {
        this.onTimeUpdate?.(this.currentTime)
        this.rafId = requestAnimationFrame(tick)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopTimeTracking() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

/**
 * Check if a file format needs Web Audio fallback on current platform.
 * Returns true if the current browser likely can't play this format via <audio> tag
 * but might be able to decode it via Web Audio API.
 */
export function needsWebAudioFallback(mimeType?: string, fileName?: string): boolean {
  // Only needed on iOS/Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  
  if (!isIOS && !isSafari) return false
  
  const lower = (fileName || '').toLowerCase()
  const mime = (mimeType || '').toLowerCase()
  
  // FLAC: <audio> doesn't stream on iOS, but decodeAudioData works
  if (lower.endsWith('.flac') || mime.includes('flac')) return true
  // OGG/Vorbis: not supported on Safari at all via <audio>
  if (lower.endsWith('.ogg') || mime.includes('ogg')) return true
  // OPUS: not supported on Safari <audio>
  if (lower.endsWith('.opus') || mime.includes('opus')) return true
  // WMA: not supported anywhere in browser
  if (lower.endsWith('.wma') || mime.includes('wma')) return true
  
  return false
}
