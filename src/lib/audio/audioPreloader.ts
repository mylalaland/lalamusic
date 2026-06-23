/**
 * Audio Preloader — Google Drive 직접 다운로드 + Blob 캐시
 * 
 * 기존 /api/stream 프록시 대신, 클라이언트에서 직접 Google Drive로 fetch하여
 * Vercel 트래픽을 절감합니다.
 * 
 * 기능:
 * - 현재 곡: fetch → Blob URL 생성 → 재생
 * - 다음 곡: 백그라운드 프리패치
 * - 이전 곡: 캐시 유지 (즉시 되돌아가기)
 * - 최대 3곡 캐시 (prev + current + next)
 */

interface CacheEntry {
  blobUrl: string
  blob: Blob
}

// 싱글턴 캐시
const cache = new Map<string, CacheEntry>()
const loadingPromises = new Map<string, Promise<string>>()

/**
 * 트랙을 프리로드합니다.
 * 이미 캐시되어 있으면 캐시된 URL을 즉시 반환합니다.
 * 아니면 Google Drive에서 직접 다운로드하여 Blob URL을 생성합니다.
 */
export async function preloadTrack(
  trackId: string,
  fileId: string,
  options?: {
    onProgress?: (percent: number) => void
    signal?: AbortSignal
  }
): Promise<string> {
  // 1. 캐시 확인
  const cached = cache.get(trackId)
  if (cached) return cached.blobUrl

  // 2. 이미 로딩 중이면 기다리기
  const existing = loadingPromises.get(trackId)
  if (existing) return existing

  // 3. 새로 로딩
  const promise = fetchAndCache(trackId, fileId, options)
  loadingPromises.set(trackId, promise)

  try {
    return await promise
  } finally {
    loadingPromises.delete(trackId)
  }
}

async function fetchAndCache(
  trackId: string,
  fileId: string,
  options?: {
    onProgress?: (percent: number) => void
    signal?: AbortSignal
  }
): Promise<string> {
  // 1. 서버에서 토큰 + URL 받기 (Vercel 트래픽: ~200 bytes)
  const tokenRes = await fetch(`/api/stream-url?id=${fileId}`, {
    signal: options?.signal
  })
  
  if (!tokenRes.ok) {
    throw new Error(`Failed to get stream URL: ${tokenRes.status}`)
  }
  
  const { url, token } = await tokenRes.json()

  // 2. Google Drive에서 직접 다운로드 (Vercel 경유 안 함!)
  const audioRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: options?.signal
  })

  if (!audioRes.ok) {
    throw new Error(`Google Drive fetch failed: ${audioRes.status}`)
  }

  // 3. 진행률 추적하며 다운로드
  const contentLength = parseInt(audioRes.headers.get('Content-Length') || '0')
  
  // Google Drive가 octet-stream을 반환하는 경우 대비 MIME 보정
  const rawType = audioRes.headers.get('Content-Type') || 'audio/mpeg'
  const resolvedType = resolveMimeType(rawType)

  if (contentLength && options?.onProgress && audioRes.body) {
    // ReadableStream으로 진행률 추적
    const reader = audioRes.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      options.onProgress(Math.min(received / contentLength, 1))
    }

    const blob = new Blob(chunks as BlobPart[], { type: resolvedType })
    const blobUrl = URL.createObjectURL(blob)
    cache.set(trackId, { blobUrl, blob })
    return blobUrl
  } else {
    // 진행률 불필요 시 간단히 blob으로
    const rawBlob = await audioRes.blob()
    // blob type이 octet-stream이면 보정
    const blob = rawBlob.type.includes('octet-stream') 
      ? new Blob([rawBlob], { type: resolvedType })
      : rawBlob
    const blobUrl = URL.createObjectURL(blob)
    cache.set(trackId, { blobUrl, blob })
    options?.onProgress?.(1)
    return blobUrl
  }
}

/** Google Drive가 octet-stream을 반환하는 경우 audio MIME으로 보정 */
function resolveMimeType(raw: string): string {
  if (!raw || raw.includes('octet-stream')) return 'audio/mpeg'
  return raw
}

/**
 * 캐시된 Blob URL을 반환합니다. 없으면 null.
 */
export function getCachedUrl(trackId: string): string | null {
  return cache.get(trackId)?.blobUrl ?? null
}

/**
 * 특정 트랙이 캐시에 있는지 확인합니다.
 */
export function isCached(trackId: string): boolean {
  return cache.has(trackId)
}

/**
 * 특정 트랙이 현재 로딩 중인지 확인합니다.
 */
export function isLoading(trackId: string): boolean {
  return loadingPromises.has(trackId)
}

/**
 * 지정된 ID 목록을 제외하고 나머지 캐시를 해제합니다.
 * 보통 [prevTrackId, currentTrackId, nextTrackId]를 keepIds로 전달합니다.
 */
export function releaseAllExcept(keepIds: string[]): void {
  const keepSet = new Set(keepIds)
  for (const [id, entry] of cache) {
    if (!keepSet.has(id)) {
      URL.revokeObjectURL(entry.blobUrl)
      cache.delete(id)
    }
  }
}

/**
 * 특정 트랙 캐시를 해제합니다.
 */
export function releaseTrack(trackId: string): void {
  const entry = cache.get(trackId)
  if (entry) {
    URL.revokeObjectURL(entry.blobUrl)
    cache.delete(trackId)
  }
}

/**
 * 모든 캐시를 해제합니다.
 */
export function clearAllCache(): void {
  for (const [, entry] of cache) {
    URL.revokeObjectURL(entry.blobUrl)
  }
  cache.clear()
  loadingPromises.clear()
}

/**
 * 진행 중인 로딩을 취소할 수 있는 AbortController 기반 프리로드.
 * 다음 곡 프리패치에 사용합니다.
 */
export function preloadTrackWithAbort(
  trackId: string,
  fileId: string,
  onProgress?: (percent: number) => void
): { promise: Promise<string>; abort: () => void } {
  const controller = new AbortController()
  
  const promise = preloadTrack(trackId, fileId, {
    onProgress,
    signal: controller.signal
  })

  return {
    promise,
    abort: () => controller.abort()
  }
}
