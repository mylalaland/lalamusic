import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // 1. 클라이언트가 요청한 오디오 URL (또는 DB에서 조회한 ID)
  const audioUrl = request.nextUrl.searchParams.get('url');

  if (!audioUrl) {
    return new NextResponse('Audio URL is required', { status: 400 });
  }

  // 2. 사파리 호환성을 위한 핵심: Range 헤더 가져오기
  const range = request.headers.get('range');

  // 3. 원본 서버(Google Drive 등)에 요청할 때 Range 헤더 포함
  const fetchHeaders: HeadersInit = {};
  if (range) {
    fetchHeaders['Range'] = range;
  }

  try {
    // 원본 소스에서 스트림 가져오기
    const response = await fetch(audioUrl, {
      headers: fetchHeaders,
    });

    // 4. 원본 서버의 응답 헤더를 클라이언트에게 전달
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
    responseHeaders.set('Accept-Ranges', 'bytes'); // 중요: 범위 요청 지원 알림

    const contentLength = response.headers.get('Content-Length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = response.headers.get('Content-Range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    // 5. 스트림 응답 반환 (206 또는 200)
    return new NextResponse(response.body, {
      status: response.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Streaming error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}