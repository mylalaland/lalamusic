/**
 * Client-side Metadata Parser
 * 
 * 기존 analyzeMusicMetadata Server Action은 Vercel 서버에서 Google Drive 전체 파일을
 * 다운로드하여 메타데이터를 파싱했으므로 대역폭 비용이 매우 컸습니다.
 * 
 * 이 모듈은 audioPreloader가 이미 다운로드한 Blob에서 직접 메타데이터를 파싱하여
 * Vercel 트래픽을 0으로 만듭니다.
 */

import { parseBlob } from 'music-metadata-browser'
import { getCachedBlob } from './audioPreloader'

export interface ParsedMetadata {
  title: string | null
  artist: string
  album: string
  genre: string | null
  year: string | null
  duration: number
  coverArt: string | null   // base64 data URI
  lyrics: string | null
}

/**
 * 캐시된 Blob에서 메타데이터를 파싱합니다.
 * audioPreloader가 이미 다운로드한 Blob을 재사용하므로 추가 네트워크 트래픽 없음.
 * 
 * @param trackId - 트랙 ID (audioPreloader 캐시 키)
 * @returns ParsedMetadata 또는 null (캐시 미스/파싱 실패 시)
 */
export async function parseMetadataFromCache(trackId: string): Promise<ParsedMetadata | null> {
  const blob = getCachedBlob(trackId)
  if (!blob) {
    console.warn('[ClientMeta] No cached blob for track:', trackId.slice(0, 8))
    return null
  }

  return parseMetadataFromBlob(blob)
}

/**
 * Blob이 캐시될 때까지 대기한 후 메타데이터를 파싱합니다.
 * preloadTrack이 완료되기 전에 호출해도 안전합니다.
 * 
 * @param trackId - 트랙 ID (audioPreloader 캐시 키)
 * @param maxWaitMs - 최대 대기 시간 (기본 30초)
 * @param signal - 취소용 AbortSignal
 * @returns ParsedMetadata 또는 null (타임아웃/파싱 실패 시)
 */
export async function waitForBlobAndParse(
  trackId: string,
  maxWaitMs: number = 30000,
  signal?: { cancelled: boolean }
): Promise<ParsedMetadata | null> {
  const startTime = Date.now()
  let delay = 500 // 첫 폴링 0.5초 후

  while (Date.now() - startTime < maxWaitMs) {
    if (signal?.cancelled) return null

    const blob = getCachedBlob(trackId)
    if (blob) {
      return parseMetadataFromBlob(blob)
    }

    // 대기 (점진적 증가: 500ms → 1s → 2s → 3s max)
    await new Promise(r => setTimeout(r, delay))
    delay = Math.min(delay * 1.5, 3000)
  }

  console.warn('[ClientMeta] Timed out waiting for blob:', trackId.slice(0, 8))
  return null
}

/**
 * Blob에서 직접 메타데이터를 파싱합니다.
 */
export async function parseMetadataFromBlob(blob: Blob): Promise<ParsedMetadata | null> {
  try {
    const metadata = await parseBlob(blob)

    // 커버 아트 추출
    let coverArt: string | null = null
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0]
      // Uint8Array → base64 변환 (브라우저 환경)
      const base64String = uint8ArrayToBase64(pic.data)
      coverArt = `data:${pic.format};base64,${base64String}`
    }

    // 가사 추출
    let lyrics: string | null = null
    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
      if (typeof metadata.common.lyrics[0] === 'string') {
        lyrics = (metadata.common.lyrics as unknown as string[]).join('\n').trim()
      } else {
        lyrics = (metadata.common.lyrics as any[]).map((l: any) => l.text).join('\n').trim()
      }
    }

    return {
      title: metadata.common.title || null,
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      genre: metadata.common.genre ? metadata.common.genre.join(', ') : null,
      year: metadata.common.year?.toString() || null,
      duration: metadata.format.duration ? Math.round(metadata.format.duration) : 0,
      coverArt,
      lyrics,
    }
  } catch (e) {
    console.error('[ClientMeta] Parse failed:', e)
    return null
  }
}

/**
 * Uint8Array → base64 문자열 변환 (브라우저 환경)
 * Buffer.from()은 Node.js 전용이므로 브라우저에서는 이 함수 사용
 */
function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = ''
  const len = uint8.byteLength
  // 청크 단위로 처리 (stack overflow 방지)
  const chunkSize = 8192
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}
