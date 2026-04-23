import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest, userAgent } from 'next/server'

/**
 * Next.js 16 Proxy (Middleware)
 * handles device-based routing and Supabase session management.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const { device } = userAgent(request)
  const isMobile = device.type === 'mobile' || device.type === 'tablet'

  // 1. 기본 응답 생성
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  // 2. Supabase 클라이언트 초기화 (세션 갱신 용도)
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // 3. 사용자 인증 정보 확인
  const { data: { user } } = await supabase.auth.getUser()

  // [DIAGNOSTIC] 로그 (Vercel 로그에서 확인 가능)
  console.log(`[PROXY] Path: ${pathname} | User: ${user ? user.email : 'None'} | Device: ${isMobile ? 'Mobile' : 'Desktop'}`)

  // 4. 리다이렉션 로직
  
  // A. 로그인 안 된 상태로 보호된 페이지 접근 시 루트(/)로 보냄
  const isAuthPage = pathname.startsWith('/auth')
  const isPublicPage = pathname === '/' || isAuthPage
  
  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // B. 로그인 된 상태로 루트(/)나 로그인 페이지(/auth) 접근 시 메인 앱으로 보냄
  if (user && (pathname === '/' || isAuthPage)) {
    const url = request.nextUrl.clone()
    url.pathname = isMobile ? '/mobile/connect' : '/desktop/connect'
    return NextResponse.redirect(url)
  }

  // C. 일반적인 경로 접근 시 기기별 경로로 Rewrite (URL은 그대로 유지)
  const isAppPath = !isPublicPage && !pathname.startsWith('/api') && !pathname.startsWith('/_next')
  const isMobilePath = pathname.startsWith('/mobile')
  const isDesktopPath = pathname.startsWith('/desktop')

  if (isAppPath && !isMobilePath && !isDesktopPath) {
    const url = request.nextUrl.clone()
    url.pathname = isMobile ? `/mobile${pathname}` : `/desktop${pathname}`
    return NextResponse.rewrite(url)
  }

  return response
}

// 미들웨어 실행 범위 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}