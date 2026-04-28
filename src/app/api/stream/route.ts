import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getValidGoogleToken } from '../../../lib/google/token'
import { spawn } from 'child_process'

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

  // Safari compatibility: capture Range header
  const range = req.headers.get('range')

  try {
    const token = await getValidGoogleToken(user.id)
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const fetchHeaders: HeadersInit = {
      'Authorization': `Bearer ${token}`
    }
    if (range) {
      fetchHeaders['Range'] = range
    }

    const response = await fetch(driveUrl, { headers: fetchHeaders })
    const headers = new Headers(response.headers)

    // Determine MIME based on file extension first
    const lowerName = fileName.toLowerCase()
    let contentType = ''
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
    } else {
      const rawType = hintMime || headers.get('Content-Type') || 'audio/mpeg'
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

    // If FLAC, transcode to MP3 on-the-fly for browsers lacking native support (e.g., iOS Safari)
    let bodyStream: ReadableStream<Uint8Array> | null = null
    if (contentType === 'audio/flac') {
      // Spawn ffmpeg process: input from pipe, output mp3 to stdout
      const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'mp3', '-ab', '192k', '-ac', '2', 'pipe:1'])
      // Pipe the original response body into ffmpeg stdin
      response.body?.pipeTo(new WritableStream({
        write(chunk) {
          ffmpeg.stdin?.write(chunk)
        },
        close() {
          ffmpeg.stdin?.end()
        }
      }))
      // Convert ffmpeg stdout to a ReadableStream for NextResponse
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      ffmpeg.stdout?.on('data', (chunk: Buffer) => {
        writer.write(new Uint8Array(chunk))
      })
      ffmpeg.stdout?.on('end', () => {
        writer.close()
      })
      bodyStream = readable
      contentType = 'audio/mpeg' // Transcoded to MP3
    } else {
      bodyStream = response.body as ReadableStream<Uint8Array>
    }

    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=3600')
    headers.set('Accept-Ranges', 'bytes')

    const contentLength = response.headers.get('Content-Length')
    if (contentLength && contentType !== 'audio/mpeg') {
      headers.set('Content-Length', contentLength)
      headers.delete('Transfer-Encoding')
    }

    if (isDownload) {
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A')
      headers.set('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`)
    }

    return new Response(bodyStream, { status: response.status, headers })
  } catch (error) {
    console.error('Stream Error:', error)
    return new NextResponse('Error streaming file', { status: 500 })
  }
}

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
    } else {
        // 2. hint MIME → 응답 헤더 → fallback 순서
        const rawType = hintMime || headers.get('Content-Type') || 'audio/mpeg'
        
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
    
    // [FIX] Content-Length 보존 (Windows Chrome M4A 재생에 필수)
    // Google Drive API의 Content-Length를 유지하되, Transfer-Encoding: chunked 방지
    const contentLength = response.headers.get('Content-Length')
    if (contentLength) {
        headers.set('Content-Length', contentLength)
        headers.delete('Transfer-Encoding')
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
      status: response.status,
      headers 
    })
  } catch (error) {
    console.error('Stream Error:', error)
    return new NextResponse('Error streaming file', { status: 500 })
  }
}