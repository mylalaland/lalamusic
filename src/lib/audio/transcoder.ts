/**
 * Client-side audio transcoding using FFmpeg.wasm
 * 
 * Chrome은 ALAC(Apple Lossless) m4a를 디코딩할 수 없습니다.
 * <audio> 태그와 decodeAudioData() 모두 실패합니다.
 * 
 * FFmpeg.wasm을 사용하여 브라우저에서 직접 WAV로 변환합니다.
 * - Vercel 트래픽: 0 (전부 클라이언트에서 처리)
 * - 변환된 WAV를 Blob URL로 반환
 * - 한번 변환하면 캐시
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loading: Promise<void> | null = null

// 변환 캐시 (trackId → WAV blob URL)
const transcodeCache = new Map<string, string>()

/**
 * FFmpeg 인스턴스를 지연 로드합니다.
 * 최초 1회만 로드하며, 이후에는 재사용합니다.
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg

  if (loading) {
    await loading
    return ffmpeg!
  }

  ffmpeg = new FFmpeg()

  // 로그 (디버그용)
  ffmpeg.on('log', ({ message }) => {
    if (message.includes('Duration') || message.includes('Output') || message.includes('Error')) {
      console.log('[FFmpeg]', message)
    }
  })

  loading = ffmpeg.load({
    // unpkg CDN에서 WASM 로드 (SharedArrayBuffer 불필요)
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
  })

  try {
    await loading
    console.log('[FFmpeg] Loaded successfully')
  } catch (e) {
    console.error('[FFmpeg] Load failed:', e)
    ffmpeg = null
    loading = null
    throw e
  }

  return ffmpeg
}

/**
 * 지원되지 않는 오디오 파일을 WAV로 변환합니다.
 * 
 * @param blobUrl - 원본 오디오의 Blob URL
 * @param trackId - 캐시 키
 * @param fileName - 원본 파일명 (확장자 감지용)
 * @returns WAV Blob URL (재생 가능)
 */
export async function transcodeToWav(
  blobUrl: string,
  trackId: string,
  fileName?: string
): Promise<string> {
  // 캐시 확인
  const cached = transcodeCache.get(trackId)
  if (cached) return cached

  console.log('[Transcode] Starting transcode for:', fileName || trackId)
  const startTime = Date.now()

  const ff = await getFFmpeg()

  // 파일 확장자 결정
  const ext = fileName?.split('.').pop()?.toLowerCase() || 'm4a'
  const inputName = `input.${ext}`
  const outputName = 'output.wav'

  // Blob URL에서 파일 데이터 가져오기
  const inputData = await fetchFile(blobUrl)
  await ff.writeFile(inputName, inputData)

  // FFmpeg 변환: 원본 → WAV (PCM 16bit)
  // -y: 덮어쓰기, -i: 입력, -c:a pcm_s16le: 16bit PCM WAV
  await ff.exec(['-y', '-i', inputName, '-c:a', 'pcm_s16le', '-ar', '44100', outputName])

  // 출력 파일 읽기
  const outputData = await ff.readFile(outputName) as Uint8Array

  // 정리
  await ff.deleteFile(inputName).catch(() => {})
  await ff.deleteFile(outputName).catch(() => {})

  // Blob URL 생성
  const wavBlob = new Blob([outputData], { type: 'audio/wav' })
  const wavUrl = URL.createObjectURL(wavBlob)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Transcode] Done in ${elapsed}s, WAV size: ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB`)

  // 캐시 저장
  transcodeCache.set(trackId, wavUrl)

  return wavUrl
}

/**
 * 트랜스코딩 캐시를 정리합니다.
 */
export function clearTranscodeCache(keepIds?: string[]): void {
  if (!keepIds) {
    for (const url of transcodeCache.values()) {
      URL.revokeObjectURL(url)
    }
    transcodeCache.clear()
    return
  }

  const keepSet = new Set(keepIds)
  for (const [id, url] of transcodeCache) {
    if (!keepSet.has(id)) {
      URL.revokeObjectURL(url)
      transcodeCache.delete(id)
    }
  }
}

/**
 * 캐시된 트랜스코딩 결과가 있는지 확인합니다.
 */
export function getTranscodedUrl(trackId: string): string | null {
  return transcodeCache.get(trackId) ?? null
}
