import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getValidGoogleToken } from '../../../lib/google/token'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('id')

  if (!fileId) return new NextResponse('File ID required', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    // [FIX] DB 기반 토큰 관리 유틸리티 사용 (자동 갱신 포함)
    const token = await getValidGoogleToken(user.id)

    // [CRITICAL FIX] Vercel 대역폭 제한 회피를 위한 직접 리다이렉트 (302 Found)
    // 서버에서 파일을 다운로드하여 중계(Proxy)하면 10GB Fast Origin Transfer 한도가 금방 고갈됩니다.
    // access_token을 쿼리 파라미터로 붙여 클라이언트(브라우저/audio 태그)가 Google 서버에서 직접 스트리밍/다운로드하게 합니다.
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${token}`

    return NextResponse.redirect(driveUrl, 302)

  } catch (error) {
    console.error('Stream API Error:', error)
    return new NextResponse('Internal server error', { status: 500 })
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