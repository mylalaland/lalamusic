'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * [REFACTORED] DB 업데이트만 수행하는 경량 Server Action
 * 
 * 기존 analyzeMusicMetadata는 Vercel 서버에서 Google Drive 전체 파일을 다운로드하여
 * 메타데이터를 파싱했으므로 대역폭 비용이 매우 컸습니다 (수십~수백 MB/곡).
 * 
 * 메타데이터 파싱은 이제 클라이언트 사이드에서 수행합니다 (clientMetadata.ts).
 * 이 Server Action은 파싱된 결과를 Supabase DB에 저장하는 역할만 합니다.
 * Vercel 트래픽: 텍스트 메타데이터만 전송 (~1 KB)
 */

interface MetadataUpdate {
  title?: string | null
  artist?: string | null
  album?: string | null
  genre?: string | null
  year?: string | null
  duration?: number
}

export async function updateTrackMetadataDB(fileId: string, metadata: MetadataUpdate) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: '로그인 필요' }

  try {
    const updates: Record<string, any> = {}
    if (metadata.title !== undefined) updates.title = metadata.title
    if (metadata.artist !== undefined) updates.artist = metadata.artist
    if (metadata.album !== undefined) updates.album = metadata.album
    if (metadata.genre !== undefined) updates.genre = metadata.genre
    if (metadata.year !== undefined) updates.year = metadata.year
    if (metadata.duration !== undefined) updates.duration = metadata.duration

    const { error } = await supabase
      .from('music_files')
      .update(updates)
      .eq('id', fileId)

    if (error) {
      console.warn(`DB update skipped for ${fileId}:`, error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error(`DB Update Error (${fileId}):`, error.message)
    return { error: error.message }
  }
}

/**
 * @deprecated 이 함수는 Vercel에서 전체 오디오 파일을 다운로드하므로 사용하지 마세요.
 * 대신 clientMetadata.ts의 parseMetadataFromCache()를 사용하세요.
 */
export async function analyzeMusicMetadata(fileId: string) {
  console.warn('[DEPRECATED] analyzeMusicMetadata called — use client-side parsing instead')
  return { error: 'Deprecated: Use client-side metadata parsing' }
}