import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getValidGoogleToken } from '../../../lib/google/token'

/**
 * /api/stream-redirect
 * 
 * iOS 잠금화면 백그라운드 재생을 위한 리다이렉트 엔드포인트.
 * 
 * <audio> 태그는 커스텀 헤더(Authorization)를 설정할 수 없으므로,
 * 이 엔드포인트가 Google Drive URL로 302 리다이렉트합니다.
 * 
 * 흐름:
 * 1. <audio>.src = "/api/stream-redirect?id=xxx" 
 * 2. 서버: Google 토큰 확인 → 302 → Google Drive URL (access_token 포함)
 * 3. iOS 네이티브 미디어 엔진이 Google Drive에서 직접 스트리밍
 * 
 * Vercel 트래픽: 리다이렉트 응답 ~500바이트만 (오디오 데이터 안 거침)
 */
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
    const token = await getValidGoogleToken(user.id)
    const redirectUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${token}`

    // 302 리다이렉트 — 오디오 데이터는 Google Drive에서 직접 전송
    // iOS Safari의 <audio> 태그가 302를 따라가서 Google Drive에서 스트리밍
    return NextResponse.redirect(redirectUrl, 302)
  } catch (error) {
    console.error('Stream Redirect Error:', error)
    return new NextResponse('Failed to get token', { status: 500 })
  }
}
