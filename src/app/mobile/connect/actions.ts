'use server'

import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

export async function getDriveFiles(folderId: string = 'root') {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.provider_token) {
    return { error: '로그인이 필요합니다.' }
  }

  // [수정] 토큰 갱신을 위해 Client ID/Secret을 포함하여 초기화
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  
  // [수정] refresh_token이 있다면 함께 설정하여 만료 시 자동 갱신되도록 함
  auth.setCredentials({ 
    access_token: session.provider_token,
    refresh_token: session.provider_refresh_token 
  })
  
  const drive = google.drive({ version: 'v3', auth })

  try {
    let folderName = 'Google Drive'
    if (folderId !== 'root') {
      const folderInfo = await drive.files.get({ fileId: folderId, fields: 'name' })
      folderName = folderInfo.data.name || 'Unknown'
    }

    console.log(`🔍 검색 시작: ${folderId} (공유 드라이브 포함)`)

    // 1. 먼저 요청한 폴더(내 드라이브 등)를 검색
    let query = `'${folderId}' in parents and trashed = false`
    
    let response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, thumbnailLink)',
      orderBy: 'folder, name', 
      pageSize: 1000,
      supportsAllDrives: true, // [추가] 공유 드라이브 지원
      includeItemsFromAllDrives: true, // [추가] 공유 드라이브 아이템 포함
    } as any)

    let files = response.data.files || []
    console.log(`1차 검색 결과: ${files.length}개`)

    // 2. [비상대책] 만약 'root'를 검색했는데 텅 비었다면? -> "공유 문서함"을 검색해본다!
    if (files.length === 0 && folderId === 'root') {
      console.log('⚠️ 내 드라이브가 비어있음 -> 공유 문서함(Shared with me) 검색 시도')
      
      response = await drive.files.list({
        q: "sharedWithMe = true and trashed = false", // [변경] 공유된 파일만 검색
        fields: 'files(id, name, mimeType, size, thumbnailLink)',
        orderBy: 'folder, name', 
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      } as any)
      
      files = response.data.files || []
      console.log(`2차 공유 문서함 검색 결과: ${files.length}개`)
      
      if (files.length > 0) {
        folderName = "공유 문서함 (Shared with Me)"
      }
    }

    return { 
      files: files,
      currentFolder: { id: folderId, name: folderName }
    }
    
  } catch (error: any) {
    console.error('❌ Drive API Error:', error)
    return { error: '파일을 불러오지 못했습니다: ' + error.message }
  }
}