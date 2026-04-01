'use server'

import { createClient } from '@/lib/supabase/server'

// 1. 플레이리스트 생성
export async function createPlaylist(name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('playlists')
    .insert({ name, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// 2. 내 플레이리스트 목록 가져오기
export async function getPlaylists() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

// 3. 플레이리스트에 곡 추가
export async function addTrackToPlaylist(playlistId: string, fileId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      file_id: fileId
    })

  if (error) return { error: error.message }
  return { success: true }
}

// 4. 플레이리스트 수록곡 가져오기
export async function getPlaylistTracks(playlistId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('playlist_items')
    .select(`
      file_id,
      music_files (*)
    `)
    .eq('playlist_id', playlistId)
    .order('added_at', { ascending: true })

  if (error) return []
  // music_files 정보만 추출해서 반환 (삭제된 곡 제외)
  return data.map((item: any) => item.music_files).filter((track: any) => track !== null)
}

// 5. 플레이리스트 삭제
export async function deletePlaylist(playlistId: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
    
    if (error) return { error: error.message }
    return { success: true }
}

// 6. 플레이리스트에서 특정 곡 제거
export async function removeTrackFromPlaylist(playlistId: string, fileId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .match({ playlist_id: playlistId, file_id: fileId })

  if (error) return { error: error.message }
  return { success: true }
}