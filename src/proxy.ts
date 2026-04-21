import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest, userAgent } from 'next/server'

export default async function proxy(request: NextRequest) {
  // 1. 디바이스 판별 및 URL Rewrite 준비
  const { device } = userAgent(request)
  const isMobile = device.type === 'mobile' || device.type === 'tablet'
  
  const pathname = request.nextUrl.pathname
  const shouldRewrite = 
    pathname !== '/' && 
    !pathname.startsWith('/auth') && 
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/mobile') &&
    !pathname.startsWith('/desktop')

  let url = request.nextUrl.clone()
  if (shouldRewrite) {
    url.pathname = isMobile ? `/mobile${pathname}` : `/desktop${pathname}`
  }

  // 2. 응답 객체 생성 (Rewrite vs Next)
  let response = shouldRewrite 
    ? NextResponse.rewrite(url, { request: { headers: request.headers } })
    : NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = shouldRewrite 
            ? NextResponse.rewrite(url, { request: { headers: request.headers } })
            : NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  
  // 터미널 디버깅을 위한 로그 추가 (주요 경로만 출력)
  if (!pathname.startsWith('/_next') && !pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    console.log(`🟡 [PROXY] Path: ${pathname} | User: ${user ? '✅ LOGGED_IN' : '❌ NULL'}`)
  }

  if (!user && !pathname.startsWith('/auth') && pathname !== '/') {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    return NextResponse.redirect(loginUrl)
  }

  return response
}

// [추가] 정적 파일(이미지, CSS 등)에는 미들웨어가 실행되지 않도록 설정
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}