import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest, userAgent } from 'next/server'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 1. 디바이스 판별 및 URL Rewrite 준비
  const { device } = userAgent(request)
  const isMobile = device.type === 'mobile' || device.type === 'tablet'
  
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

  // 환경 변수 체크 - 누락될 경우 엣지 함수가 종료되지 않도록 예외 처리
  if (!supabaseUrl || !supabaseKey) {
    console.warn('🔴 [PROXY ERROR] Environment variables for Supabase are missing!')
    return response
  }

  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                request.cookies.set({ name, value, ...options })
              )
              response = shouldRewrite 
                ? NextResponse.rewrite(url, { request: { headers: request.headers } })
                : NextResponse.next({ request: { headers: request.headers } })
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set({ name, value, ...options })
              )
            } catch (error) {
              console.error('🟡 [PROXY] Cookie setAll error:', error)
            }
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    
    console.log(`🟡 [PROXY] Path: ${pathname} | User: ${user ? '✅ LOGGED_IN' : '❌ NULL'}`)

    if (!user && !pathname.startsWith('/auth') && pathname !== '/') {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/'
      return NextResponse.redirect(loginUrl)
    }
  } catch (e) {
    console.error('🔴 [PROXY FATAL ERROR]', e)
  }

  return response
}

// 정적 파일 및 이미지 등에는 미들웨어가 실행되지 않도록 설정
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}