import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const supabase = await createClient()
    // music_files 테이블은 Google Drive file ID를 'id' 컬럼에 저장
    const { data, error } = await supabase
      .from('music_files')
      .select('title, artist, album, genre, duration, cover_art, thumbnail_link, lyrics')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ duration: null, cover_art: null }, { status: 200 })
    }

    return NextResponse.json({
      title: data.title,
      artist: data.artist,
      album: data.album,
      genre: data.genre,
      duration: data.duration,
      cover_art: data.cover_art || data.thumbnail_link,
      thumbnail_link: data.thumbnail_link,
      lyrics: data.lyrics,
    })
  } catch (err) {
    return NextResponse.json({ duration: null, cover_art: null }, { status: 200 })
  }
}
