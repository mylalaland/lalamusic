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

  // [FIX] Safari/iOS compatibility: capture Range header for byte-range requests
  const range = req.headers.get('range')

  try {
    // [FIX] DB 기반 토큰 관리 유틸리티 사용 (자동 갱신 포함)
    const token = await getValidGoogleToken(user.id)

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

    if (!response.ok && response.status !== 206) {
      console.error('Google Drive fetch failed:', response.status, response.statusText)
      return new NextResponse('Failed to fetch from Google Drive', { status: response.status })
    }

    const headers = new Headers()
    
    // [FIX] 파일명 기반 MIME 판별 최우선 (Google Drive가 octet-stream으로 내려주는 경우 대비)
    const lowerName = fileName.toLowerCase()
    let contentType = ''
    
    // 1. 파일명 확장자로 먼저 판별 (가장 신뢰할 수 있음)
    if (lowerName.endsWith('.m4a') || lowerName.endsWith('.mp4')) {
        contentType = 'audio/mp4'
    } else if (lowerName.endsWith('.flac')) {
        contentType = 'audio/flac'
    } else if (lowerName.endsWith('.mp3')) {
        contentType = 'audio/mpeg'
    } else if (lowerName.endsWith('.wav')) {
        contentType = 'audio/wav'
    } else if (lowerName.endsWith('.ogg')) {
        contentType = 'audio/ogg'
    } else if (lowerName.endsWith('.aac')) {
        contentType = 'audio/aac'
    } else if (lowerName.endsWith('.wma')) {
        contentType = 'audio/x-ms-wma'
    } else if (lowerName.endsWith('.opus')) {
        contentType = 'audio/opus'
    } else {
        // 2. hint MIME → 응답 헤더 → fallback 순서
        const rawType = hintMime || response.headers.get('Content-Type') || 'audio/mpeg'
        
        // octet-stream은 무시하고 audio/mpeg fallback
        if (rawType.includes('octet-stream')) {
            contentType = 'audio/mpeg'
        } else if (rawType.includes('m4a') || rawType.includes('mp4')) {
            contentType = 'audio/mp4'
        } else if (rawType.includes('flac') || rawType.includes('x-flac')) {
            contentType = 'audio/flac'
        } else {
            contentType = rawType
        }
    }

    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=3600')
    headers.set('Accept-Ranges', 'bytes')
    
    // [FIX] CORS headers for iOS WebKit cross-origin audio
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Range')
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

    // [FIX] Content-Length 보존 (iOS Safari M4A 재생에 필수)
    // Google Drive API의 Content-Length를 유지하되, Transfer-Encoding: chunked 방지
    const contentLength = response.headers.get('Content-Length')
    if (contentLength) {
        headers.set('Content-Length', contentLength)
        headers.delete('Transfer-Encoding')
    }

    // [FIX] Range 응답 시 Content-Range 헤더 보존 (iOS Safari 206 필수)
    const contentRange = response.headers.get('Content-Range')
    if (contentRange) {
        headers.set('Content-Range', contentRange)
    }

    // 다운로드 요청 처리
    if (isDownload) {
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A')
      headers.set('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`)
    }

    // [FIX] Safari의 엄격한 M4A Range 요청 및 Vercel chunked encoding 방지를 위해
    // Response 객체를 직접 사용하고, 원본 Content-Length를 강제 유지합니다.
    return new Response(response.body, { 
      status: response.status, // 200 or 206
      headers 
    })
  } catch (error) {
    console.error('Stream Error:', error)
    return new NextResponse('Error streaming file', { status: 500 })
  }
}

// [FIX] iOS Safari sends OPTIONS preflight for Range requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400',
    }
  })
}