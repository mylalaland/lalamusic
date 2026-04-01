import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// ⚠️ 핵심: 이 페이지를 캐싱하지 말고 매번 새로 실행하라는 강력한 명령입니다.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/connect'

  if (code) {
    const cookieStore = await cookies()

    // 공용 client 대신 여기서 직접 생성해서 쿠키 제어권을 확실하게 가져옵니다.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // [NEW] 로그인 성공 시 토큰을 DB에 별도 저장 (30분 끊김 방지)
      const { session } = data
      if (session && session.provider_token && session.user) {
        const expires_at = Date.now() + 3600 * 1000 // 1시간 후 만료

        await supabase.from('user_tokens').upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token, // access_type='offline' 필수
          expires_at: expires_at,
          updated_at: new Date().toISOString()
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    } else {
      // 에러가 났다면 원인을 알 수 있게 주소창에 표시합니다.
      console.error('Login Error:', error)
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }
  }

  // 코드가 없다면
  return NextResponse.redirect(`${origin}/?error=no_code`)
}