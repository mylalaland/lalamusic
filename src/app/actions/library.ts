'use server'

import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { getValidGoogleToken } from '../../lib/google/token'

// -----------------------------------------------------------------------------
// 1. [Global] 전체 스캔 로직 (설정이 없을 때 사용)
// -----------------------------------------------------------------------------

// 전체 오디오 파일 청크 다운로드 (확장자 필터링 적용) 및 [NEW] 증분 동기화 지원
export async function syncLibraryChunk(pageToken?: string, folderId?: string, allowedExtensions: string[] = ['mp3', 'flac', 'm4a', 'wav', 'aac'], lastSyncTime?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // [FIX] 토큰 자동 갱신 유틸리티 사용
  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    // 1. 검색 쿼리: 오디오 파일 + 휴지통 아님 + (확장자 필터)
    const extQuery = allowedExtensions.map(ext => `name contains '.${ext}'`).join(' or ')
    
    let query = `mimeType contains 'audio' and trashed = false`
    
    // 확장자 필터가 있으면 괄호로 묶어서 추가
    if (allowedExtensions.length > 0) {
        query += ` and (${extQuery})`
    }
    
    // 폴더 지정이 있으면 추가
    if (folderId) {
        query += ` and '${folderId}' in parents`
    }

    // [NEW] 증분 동기화: 마지막 스캔 이후 변경/추가된 파일만 스캔 (토큰/시간 대폭 절약)
    if (lastSyncTime) {
        // Google Drive API requires RFC 3339 format, e.g., '2012-06-04T12:00:00-08:00'
        query += ` and modifiedTime > '${lastSyncTime}'`
    }

    // 2. 구글에 요청
    const response: any = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, size, parents, modifiedTime)',
      pageSize: 1000, 
      pageToken: pageToken, 
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    })

    const files = response.data.files || []
    const nextPageToken = response.data.nextPageToken 

    // 3. DB에 저장
    if (files.length > 0) {
      const records = files.map((file: any) => ({
        id: file.id,
        user_id: user.id,
        name: file.name,
        mime_type: file.mimeType,
        thumbnail_link: file.thumbnailLink || null,
        size: file.size || null,
        parent_folder: file.parents?.[0] || null,
      }))

      const { error } = await supabase
        .from('music_files')
        .upsert(records, { onConflict: 'id' })

      if (error) throw error
    }

    return { 
        count: files.length, 
        nextPageToken: nextPageToken || null 
    }

  } catch (error: any) {
    console.error('Sync Chunk Error:', error)
    return { error: error.message }
  }
}

// 전체 폴더 구조만 빠르게 스캔 (맵 그리기용)
export async function syncOnlyFolders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '로그인이 필요합니다.' }

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    let pageToken: string | undefined = undefined
    let totalFolders = 0

    do {
      const res: any = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'nextPageToken, files(id, name, parents)',
        pageSize: 1000,
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      })

      const folders = res.data.files || []
      pageToken = res.data.nextPageToken

      if (folders.length > 0) {
        const records = folders.map((f: any) => ({
          id: f.id,
          user_id: user.id,
          name: f.name,
          parent_id: f.parents?.[0] || 'root',
        }))
        await supabase.from('folders').upsert(records, { onConflict: 'id' })
        totalFolders += folders.length
      }
    } while (pageToken)

    return { count: totalFolders }
  } catch (error: any) {
    return { error: error.message }
  }
}

// -----------------------------------------------------------------------------
// 2. [Scoped] 부분 스캔 및 유틸리티 로직 (동기화용)
// -----------------------------------------------------------------------------

// ✅ 특정 폴더 하위의 모든 폴더 ID 찾기 (구글 드라이브 BFS 탐색 + DB 저장)
// *주의: 이 함수는 '스캔(Sync)' 할 때만 사용합니다. 삭제할 때는 사용하지 마세요.*
export async function getDescendantFolderIds(rootFolderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    const validIds = new Set<string>()
    validIds.add(rootFolderId)
    
    // 루트 폴더 정보 저장 (이름 등 확보)
    if (rootFolderId !== 'root') {
       try {
         const rootInfo = await drive.files.get({ fileId: rootFolderId, fields: 'id, name, parents' });
         await supabase.from('folders').upsert({
           id: rootInfo.data.id!,
           user_id: user.id,
           name: rootInfo.data.name || 'Unknown',
           parent_id: rootInfo.data.parents?.[0] || 'root',
         }, { onConflict: 'id' })
       } catch (e) { console.log('Root folder info fetch failed', e) }
    }

    const queue = [rootFolderId]

    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId) continue

      let pageToken: string | undefined = undefined

      do {
        // 하위 폴더 검색
        const res: any = await drive.files.list({
          q: `'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'nextPageToken, files(id, name, parents)',
          pageSize: 1000,
          pageToken: pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        })
        
        const folders = res.data.files || []
        
        if (folders.length > 0) {
            // DB 저장
            const folderRecords = folders.map((f: any) => ({
                id: f.id,
                user_id: user.id,
                name: f.name,
                parent_id: f.parents?.[0] || currentId,
            }))
            await supabase.from('folders').upsert(folderRecords, { onConflict: 'id' })

            // 큐에 추가
            for (const folder of folders) {
                if (!validIds.has(folder.id)) {
                    validIds.add(folder.id)
                    queue.push(folder.id)
                }
            }
        }
        pageToken = res.data.nextPageToken
      } while (pageToken)
    }

    return Array.from(validIds)

  } catch (error) {
    console.error('Folder Tree Error:', error)
    return [rootFolderId]
  }
}

// ✅ 특정 폴더 안의 파일만 스캔 (확장자 필터 적용)
export async function syncFilesInFolder(folderId: string, allowedExtensions: string[] = ['mp3', 'flac', 'm4a', 'wav', 'aac']) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '로그인 필요' }

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  let totalCount = 0
  let pageToken: string | undefined = undefined

  // 확장자 쿼리 생성
  const extQuery = allowedExtensions.map(ext => `name contains '.${ext}'`).join(' or ')
  let query = `'${folderId}' in parents and mimeType contains 'audio' and trashed = false`
  if (allowedExtensions.length > 0) {
      query += ` and (${extQuery})`
  }

  try {
    do {
      const response: any = await drive.files.list({
        q: query,
        fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, size, parents)',
        pageSize: 1000,
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      })

      const files = response.data.files || []
      pageToken = response.data.nextPageToken

      if (files.length > 0) {
        const records = files.map((file: any) => ({
          id: file.id,
          user_id: user.id,
          name: file.name,
          mime_type: file.mimeType,
          thumbnail_link: file.thumbnailLink || null,
          size: file.size || null,
          parent_folder: file.parents?.[0] || folderId,
        }))

        await supabase.from('music_files').upsert(records, { onConflict: 'id' })
        totalCount += files.length
      }
    } while (pageToken)

    return { count: totalCount }
  } catch (error: any) {
    return { error: error.message }
  }
}

// -----------------------------------------------------------------------------
// 3. 라이브러리 조회 및 삭제
// -----------------------------------------------------------------------------

// [검색 고도화] 제목, 가수, 앨범, 파일명 통합 검색
export async function getLibraryTracks(query: string = '', limit: number = 50, offset: number = 0) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let dbQuery = supabase
    .from('music_files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,title.ilike.%${query}%,artist.ilike.%${query}%,album.ilike.%${query}%`)
  }

  const { data, error } = await dbQuery
  if (error) {
      console.error('getLibraryTracks Error:', error)
      return []
  }
  return data
}

// 전체 개수 가져오기
export async function getLibraryCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('music_files')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (error) return 0
  return count || 0
}

// 라이브러리 전체 초기화 (음악 + 폴더 데이터 삭제)
export async function resetLibrary() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  await supabase.from('music_files').delete().eq('user_id', user.id)
  await supabase.from('folders').delete().eq('user_id', user.id)
  return { success: true }
}

// ✅ [FIXED] 폴더와 그 하위 모든 데이터(폴더, 파일) DB에서 삭제
// (구글 드라이브를 건드리지 않고, 오직 DB 테이블만 조회해서 지웁니다)
export async function deleteFolderAndChildren(targetFolderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  try {
    // 1. 내 모든 폴더 가져오기 (DB에서)
    const { data: allFolders, error: fetchError } = await supabase
      .from('folders')
      .select('id, parent_id')
      .eq('user_id', user.id)

    if (fetchError || !allFolders) return { error: '폴더 목록 조회 실패' }

    // 2. BFS로 하위 폴더 ID 모두 찾기
    const idsToDelete = new Set<string>()
    const queue = [targetFolderId]
    idsToDelete.add(targetFolderId)

    while (queue.length > 0) {
      const currentId = queue.shift()
      const children = allFolders.filter(f => f.parent_id === currentId)
      for (const child of children) {
        if (!idsToDelete.has(child.id)) {
          idsToDelete.add(child.id)
          queue.push(child.id)
        }
      }
    }

    const targetIds = Array.from(idsToDelete)
    console.log(`삭제 대상 폴더 개수: ${targetIds.length}`)

    // 3. 해당 폴더들에 속한 파일들 삭제
    const { error: fileError } = await supabase
      .from('music_files')
      .delete()
      .in('parent_folder', targetIds)

    if (fileError) console.error('File delete error:', fileError)

    // 4. 폴더들 삭제
    const { error: folderError } = await supabase
      .from('folders')
      .delete()
      .in('id', targetIds)

    if (folderError) return { error: folderError.message }

    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function getLibraryGroups(field: 'album' | 'artist' | 'genre') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch only the needed fields to minimize payload
  const { data, error } = await supabase
    .from('music_files')
    .select(`${field}, thumbnail_link, cover_art`)
    .eq('user_id', user.id)
    // Removed order to speed up and limit to 50000 to avoid memory crash
    .limit(50000)

  if (error || !data) return []

  const map = new Map<string, any>()
  data.forEach((t: any) => {
    const key = t[field] || `Unknown`
    if (!map.has(key)) {
      map.set(key, { name: key, count: 1, cover: t.thumbnail_link || t.cover_art })
    } else {
      map.get(key).count++
      if (!map.get(key).cover && (t.thumbnail_link || t.cover_art)) {
         map.get(key).cover = t.thumbnail_link || t.cover_art;
      }
    }
  })

  return Array.from(map.values())
}

// [Settings 페이지용] 구글 드라이브 폴더 목록 가져오기 (API 직접 호출)
export async function getDriveFolders(folderId: string = 'root') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    const q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const res = await drive.files.list({
      q,
      fields: 'files(id, name)',
      pageSize: 1000,
      orderBy: 'name'
    })
    return res.data.files || []
  } catch (e) {
    return []
  }
}

// [NEW] 공유 문서함 폴더 목록 가져오기
export async function getSharedFolders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    const res = await drive.files.list({
      q: "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      pageSize: 1000,
      orderBy: 'name'
    })
    return res.data.files || []
  } catch (e) {
    return []
  }
}

// -----------------------------------------------------------------------------
// 4. [Folder Map] 시각화 및 재생 기능
// -----------------------------------------------------------------------------

// DB에 저장된 폴더 구조 가져오기 (트리 그리기용)
export async function getScannedFolders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) return []
  return data
}

// 특정 폴더 ID 목록에 해당하는 노래들 가져오기 (폴더 재생용)
export async function getTracksByFolderIds(folderIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('music_files')
    .select('*')
    .eq('user_id', user.id)
    .in('parent_folder', folderIds)
    .order('name', { ascending: true }) 

  if (error) {
    console.error('getTracksByFolderIds Error:', error)
    return []
  }
  return data || []
}

// [Connect 탭용] 특정 폴더 내부의 '폴더'와 '오디오 파일'을 모두 가져오기 (검색/정렬/필터 지원)
export async function getDriveContents(
  folderId: string = 'root', 
  allowedExtensions: string[] = [], 
  searchQuery: string = '',
  sortBy: string = 'name', // 'name', 'modifiedTime desc', 'size desc'
  filterBy: string = 'all' // 'all', 'folders', 'files'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { folders: [], files: [] }

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    let targetFolderId = folderId
    
    // [보안] root 인 경우 자동으로 root 하위의 'music' 폴더만 찾아서 연결
    if (targetFolderId === 'root' && !searchQuery) {
        const musicFolderRes = await drive.files.list({
             q: `name = 'music' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
             fields: 'files(id)',
             pageSize: 1
        })
        if (musicFolderRes.data.files && musicFolderRes.data.files.length > 0) {
             targetFolderId = musicFolderRes.data.files[0].id as string
        } else {
             // music 폴더가 없으면 에러 혹은 빈 결과 반환
             return { folders: [], files: [] }
        }
    }

    let q = `trashed = false`
    
    // 검색어가 있으면 전체 드라이브를 대상으로 검색 (단, 대상은 현재 폴더 이하를 보장하기 어려우므로 전체 검색)
    if (searchQuery) {
      // 띄어쓰기 등 처리
      const safeQuery = searchQuery.replace(/'/g, "\\'")
      q += ` and name contains '${safeQuery}'`
    } else {
      q += ` and '${targetFolderId}' in parents`
    }
    
    // 허용 확장자 필터
    let typeQuery = ''
    if (allowedExtensions.length > 0) {
        const extQuery = allowedExtensions.map(ext => `name contains '.${ext}'`).join(' or ')
        typeQuery = `(mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio' or (${extQuery}))`
    } else {
        typeQuery = `(mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio' or name contains '.mp3' or name contains '.flac' or name contains '.m4a' or name contains '.wav')`
    }

    // 파일/폴더 전용 필터뷰
    if (filterBy === 'folders') {
        q += ` and mimeType = 'application/vnd.google-apps.folder'`
    } else if (filterBy === 'files') {
        q += ` and mimeType != 'application/vnd.google-apps.folder' and ${typeQuery}`
    } else {
        q += ` and ${typeQuery}`
    }
    
    // 정렬 논리
    let orderBy = 'folder, name' // default
    if (sortBy === 'name_asc') orderBy = 'folder, name'
    if (sortBy === 'name_desc') orderBy = 'folder, name desc'
    if (sortBy === 'modified_asc') orderBy = 'folder, modifiedTime'
    if (sortBy === 'modified_desc') orderBy = 'folder, modifiedTime desc'
    if (sortBy === 'size_asc') orderBy = 'folder, quotaBytesUsed'
    if (sortBy === 'size_desc') orderBy = 'folder, quotaBytesUsed desc'
    
    // fallbacks for backward compatibility
    if (sortBy === 'name') orderBy = 'folder, name'
    if (sortBy === 'modified') orderBy = 'folder, modifiedTime desc'
    if (sortBy === 'size') orderBy = 'folder, quotaBytesUsed desc'
    
    const res = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, thumbnailLink, size, videoMediaMetadata, modifiedTime)',
      pageSize: 1000,
      orderBy: orderBy
    })

    const allFiles = res.data.files || []
    
    // 폴더와 파일을 분리해서 반환
    const folders = allFiles.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder')
    const files = allFiles.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder')

    return { folders, files }
  } catch (e: any) {
    console.error('getDriveContents Error:', e)
    // 사용자에게 에러 전파 (Connect 페이지에서 에러 UI 표시)
    const message = e?.message || ''
    if (message.includes('invalid_grant') || message.includes('Token') || message.includes('401')) {
      throw new Error('Google 토큰이 만료되었습니다. 다시 로그인해 주세요.')
    }
    throw new Error(`드라이브 탐색 중 오류: ${message || '알 수 없는 오류'}`)
  }
}

// [Connect 탭용] 폴더 목록들 바로 아래에 있는 오디오 파일 최대 200개 랜덤으로 가져오기
export async function getRandomAudioFilesFromFolders(folderIds: string[], allowedExtensions: string[] = [], limit: number = 200) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || folderIds.length === 0) return []

  const accessToken = await getValidGoogleToken(user.id)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  try {
    const parentQuery = folderIds.map(id => `'${id}' in parents`).join(' or ')
    let q = `(${parentQuery}) and trashed = false`
    
    if (allowedExtensions.length > 0) {
        const extQuery = allowedExtensions.map(ext => `name contains '.${ext}'`).join(' or ')
        q += ` and (mimeType contains 'audio' or (${extQuery}))`
    } else {
        q += ` and (mimeType contains 'audio' or name contains '.mp3' or name contains '.flac' or name contains '.m4a' or name contains '.wav')`
    }
    
    // API LIMIT: We don't want to query infinitely, just grab a large chunk and shuffle.
    const res = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, thumbnailLink, size)',
      pageSize: 1000,
    })

    let files = res.data.files || []
    
    // 섞은 뒤 limit만큼 자르기
    files.sort(() => Math.random() - 0.5)
    return files.slice(0, limit)
  } catch (e) {
    console.error(e)
    return []
  }
}