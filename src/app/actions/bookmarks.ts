'use server'

import { createClient } from '@/lib/supabase/server'

export async function addBookmark(track: any, position: number, title?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 1. Ensure track exists in music_files to prevent foreign key error
  const { error: upsertError } = await supabase
    .from('music_files')
    .upsert({
      id: track.id,
      user_id: user.id,
      name: track.name || track.title || 'Unknown',
      mime_type: track.mimeType || 'audio/mpeg',
      thumbnail_link: track.thumbnailLink || track.cover_art || null
    }, { onConflict: 'id', ignoreDuplicates: true })

  if (upsertError) {
    console.error('music_files upsert error for bookmark:', upsertError)
    // We can continue, but it might fail the next step if FK constraint is strictly enforced and upsert failed
  }

  // 2. Insert bookmark
  const { error } = await supabase
    .from('bookmarks')
    .insert({
      user_id: user.id,
      file_id: track.id,
      position,
      title: title || 'Bookmark'
    })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getBookmarks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      id,
      position,
      title,
      created_at,
      music_files (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getBookmarks error:', error)
    return []
  }
  
  // Transform data format slightly for easier client consumption
  return data.map((b: any) => ({
      bookmark_id: b.id,
      position: b.position,
      bookmark_title: b.title,
      created_at: b.created_at,
      track: b.music_files
  }))
}

export async function removeBookmark(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('bookmarks').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
