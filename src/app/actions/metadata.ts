'use server'

import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { parseStream } from 'music-metadata'
import { getValidGoogleToken } from '../../lib/google/token'

export async function analyzeMusicMetadata(fileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: '로그인 필요' }

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    )

    // @ts-ignore
    const metadata = await parseStream(response.data, {
      mimeType: response.headers['content-type'],
      size: parseInt(response.headers['content-length'] || '0'),
    })

    // 1. 앨범 아트
    let coverArt = null
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0]
      const base64String = Buffer.from(pic.data).toString('base64')
      coverArt = `data:${pic.format};base64,${base64String}`
    }

    // 2. 가사 추출 (타임스탬프 포함)
    let lyrics = null
    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
        let rawLyrics = ''
        if (typeof metadata.common.lyrics[0] === 'string') {
            rawLyrics = metadata.common.lyrics.join('\n')
        } else {
            // @ts-ignore
            rawLyrics = metadata.common.lyrics.map((l: any) => l.text).join('\n')
        }

        lyrics = rawLyrics.trim()
    }

    // 3. 제목
    const title = metadata.common.title || null

    const updates = {
      title: title,
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      genre: metadata.common.genre ? metadata.common.genre.join(', ') : null,
      year: metadata.common.year?.toString() || null,
      duration: metadata.format.duration ? Math.round(metadata.format.duration) : 0,
      // Note: lyrics and cover_art are intentionally omitted to avoid bloating Supabase
    }

    // DB 업데이트 시도 (실패해도 메타데이터는 반환)
    try {
      const { error } = await supabase
        .from('music_files')
        .update(updates)
        .eq('id', fileId)
      if (error) console.warn(`DB update skipped for ${fileId}:`, error.message)
    } catch (dbErr: any) {
      console.warn(`DB update failed for ${fileId}:`, dbErr.message)
    }

    return { 
        success: true, 
        data: updates, 
        heavyMetadata: {
            lyrics: lyrics,
            cover_art: coverArt
        } 
    }

  } catch (error: any) {
    console.error(`Metadata Error (${fileId}):`, error.message)
    return { error: error.message }
  }
}