import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
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
    }
  )

  // 중요: 여기서 getUser를 호출해야 세션이 갱신됩니다.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. 로그인 안 된 상태로 보호된 페이지(/library, /connect 등)에 가려고 하면?
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 2. 로그인 된 상태에서 루트(/)에 접속하면 메인 앱으로 리다이렉트
  if (user && request.nextUrl.pathname === '/') {
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent)
    
    const url = request.nextUrl.clone()
    url.pathname = isMobile ? '/mobile/connect' : '/desktop/connect'
    return NextResponse.redirect(url)
  }

  // 3. /connect, /library 등의 경로가 /mobile/이나 /desktop/ 없이 들어오면 리다이렉트 (하위 호환성)
  const legacyPaths = ['/connect', '/library', '/lists', '/files', '/settings', '/favorites', '/recents']
  if (legacyPaths.includes(request.nextUrl.pathname)) {
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent)
    
    const url = request.nextUrl.clone()
    url.pathname = (isMobile ? '/mobile' : '/desktop') + request.nextUrl.pathname
    return NextResponse.redirect(url)
  }

  return response
}