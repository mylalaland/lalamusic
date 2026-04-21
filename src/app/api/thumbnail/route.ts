import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Drive thumbnailLink 프록시
 * 
 * Google Drive의 thumbnailLink (lh3.googleusercontent.com)는
 * CORS 정책으로 인해 브라우저에서 직접 로드할 수 없습니다.
 * 이 API는 서버 사이드에서 이미지를 가져와 클라이언트에 전달합니다.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  // 보안: Google 도메인만 허용
  try {
    const parsed = new URL(url)
    const allowedHosts = ['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'drive.google.com']
    if (!allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.googleusercontent.com'))) {
      return new NextResponse('Domain not allowed', { status: 403 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      return new NextResponse('Upstream error', { status: response.status })
    }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable', // 24시간 캐시
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (err) {
    console.error('Thumbnail proxy error:', err)
    return new NextResponse('Proxy error', { status: 500 })
  }
}
