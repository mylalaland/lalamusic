import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getValidGoogleToken } from '../../../lib/google/token'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('id')
  const isDownload = searchParams.get('download') === 'true'
  const fileName = searchParams.get('name') || 'music.mp3'
  const hintMime = searchParams.get('mimeType') || ''

  if (!fileId) return new NextResponse('File ID required', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // [NEW] 사파리 호환성을 위한 Range 헤더 가져오기
  const range = req.headers.get('range')

  try {
    // [FIX] DB 기반 토큰 관리 유틸리티 사용 (자동 갱신 포함)
    const token = await getValidGoogleToken(user.id)

    // [변경] googleapis 대신 native fetch 사용 (스트리밍 호환성 향상)
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    
    const fetchHeaders: HeadersInit = {
      'Authorization': `Bearer ${token}`
    }
    if (range) {
      fetchHeaders['Range'] = range
    }

    const response = await fetch(driveUrl, {
      headers: fetchHeaders
    })

    const headers = new Headers(response.headers)
    
    // 오디오 헤더 및 MIME Type 강제 설정 (FLAC 버퍼링 방지 및 M4A 호환성)
    let contentType = hintMime || headers.get('Content-Type') || 'audio/mpeg'
    const lowerName = fileName.toLowerCase()
    
    if (lowerName.endsWith('.flac')) {
        contentType = 'audio/flac'
    } else if (lowerName.endsWith('.m4a') || lowerName.endsWith('.mp4')) {
        contentType = 'audio/mp4'
    } else if (contentType.includes('flac') || contentType.includes('x-flac')) {
        contentType = 'audio/flac'
    } else if (contentType.includes('m4a') || contentType.includes('mp4')) {
        contentType = 'audio/mp4'
    }

    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=3600')
    headers.set('Accept-Ranges', 'bytes')

    // 다운로드 요청 처리
    if (isDownload) {
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A')
      headers.set('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`)
    }

    // [FIX] Safari의 엄격한 M4A Range 요청 및 Vercel chunked encoding 방지를 위해
    // Response 객체를 직접 사용하고, 원본 Content-Length를 강제 유지합니다.
    return new Response(response.body, { 
      status: response.status,
      headers 
    })
  } catch (error) {
    console.error('Stream Error:', error)
    return new NextResponse('Error streaming file', { status: 500 })
  }
}