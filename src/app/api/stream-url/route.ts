import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getValidGoogleToken } from '../../../lib/google/token'

/**
 * /api/stream-url
 * 
 * Google Drive 직접 스트리밍 URL을 반환합니다.
 * 기존 /api/stream은 오디오를 Vercel 서버를 거쳐 전달했지만,
 * 이 엔드포인트는 클라이언트가 Google Drive에서 직접 다운로드할 수 있도록
 * URL + Access Token만 반환합니다. (Vercel 트래픽 절감)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('id')

  if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = await getValidGoogleToken(user.id)

    return NextResponse.json({
      url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      token,
    })
  } catch (error) {
    console.error('Stream URL Error:', error)
    return NextResponse.json({ error: 'Failed to get token' }, { status: 500 })
  }
}
