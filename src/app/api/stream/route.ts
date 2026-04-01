import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getValidGoogleToken } from '../../../lib/google/token'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('id')
  // [NEW] 다운로드 모드 확인
  const isDownload = searchParams.get('download') === 'true'
  const fileName = searchParams.get('name') || 'music.mp3' // 다운로드 시 저장될 파일명

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

    // 오디오 헤더 설정
    const headers = new Headers()
    headers.set('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg')
    headers.set('Cache-Control', 'public, max-age=3600')
    headers.set('Accept-Ranges', 'bytes') // [중요] 이어받기 지원 명시

    // [NEW] 다운로드 요청인 경우 강제로 파일 저장 대화상자 띄우기
    if (isDownload) {
      // 파일명 인코딩 (한글 깨짐 방지)
      const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A')
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    }

    const contentLength = response.headers.get('Content-Length')
    if (contentLength) headers.set('Content-Length', contentLength)

    const contentRange = response.headers.get('Content-Range')
    if (contentRange) headers.set('Content-Range', contentRange)

    // [수정] 상태 코드(200 또는 206)와 함께 반환
    return new NextResponse(response.body, { 
      status: response.status,
      headers 
    })
  } catch (error) {
    console.error('Stream Error:', error)
    return new NextResponse('Error streaming file', { status: 500 })
  }
}