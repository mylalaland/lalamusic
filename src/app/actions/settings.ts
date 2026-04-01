'use server'

import { createClient } from '@/lib/supabase/server'

// 1. [Scan Target] 실제 스캔할 폴더 저장
export async function saveScanSettings(folderId: string, folderName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('user_settings')
    .upsert({ 
      user_id: user.id,
      scan_folder_id: folderId,
      scan_folder_name: folderName,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('Save Scan Settings Error:', error)
    return { error: error.message, success: false }
  }
  return { success: true }
}

// 2. [Music Root] 탐색 시작점(최대 범위) 저장
export async function saveBaseSettings(folderId: string, folderName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 주의: DB에 base_folder_id, base_folder_name 컬럼이 있어야 합니다.
  const { error } = await supabase
    .from('user_settings')
    .upsert({ 
      user_id: user.id,
      base_folder_id: folderId,
      base_folder_name: folderName,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('Save Base Settings Error:', error)
    return { error: error.message, success: false }
  }
  return { success: true }
}

// [NEW] 스캔 확장자 설정 저장
export async function saveExtensionSettings(extensions: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('user_settings')
    .upsert({ 
      user_id: user.id,
      allowed_extensions: extensions,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

  if (error) {
      console.error('Save Extension Settings Error:', error)
      return { error: error.message, success: false }
  }
  return { success: true }
}

// 3. 설정 불러오기
export async function getScanSettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data
}

// 4. 설정 초기화
export async function resetScanSettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('user_settings')
    .delete()
    .eq('user_id', user.id)

  return { success: !error }
}

// 5. 라이브러리 초기화 (스캔된 곡 정보 삭제)
export async function resetMusicLibrary() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 1. 음악 파일 삭제
  const { error: musicError } = await supabase
    .from('music_files').delete().eq('user_id', user.id)
  
  // 2. 폴더 구조 삭제 (서버에 남은 다른 DB 데이터)
  const { error: folderError } = await supabase
    .from('folders').delete().eq('user_id', user.id)

  if (musicError || folderError) {
      console.error('Reset Library Error:', musicError, folderError)
      return { error: '일부 데이터를 삭제하지 못했습니다.' }
  }
  return { success: true }
}

// 6. 플레이리스트 초기화
export async function resetPlaylists() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 1. 내 플레이리스트 ID 조회
  const { data: playlists } = await supabase.from('playlists').select('id').eq('user_id', user.id)
  
  if (playlists && playlists.length > 0) {
      const ids = playlists.map(p => p.id)
      // 2. 플레이리스트 아이템 삭제
      await supabase.from('playlist_items').delete().in('playlist_id', ids)
  }

  // 3. 플레이리스트 본체 삭제
  const { error } = await supabase.from('playlists').delete().eq('user_id', user.id)

  return { success: !error }
}