import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// ⚠️ 핵심: 이 페이지를 캐싱하지 말고 매번 새로 실행하라는 강력한 명령입니다.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    console.log('🔵 [AUTH CALLBACK] Code received! Exchanging for session...')
    const cookieStore = await cookies()

    // 공용 client 대신 여기서 직접 생성해서 쿠키 제어권을 확실하게 가져옵니다.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set({ name, value, ...options })
              )
            } catch (error) {}
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('🔵 [AUTH CALLBACK] Exchange Result:', { 
      success: !error, 
      error: error?.message, 
      user: data?.session?.user?.id,
      hasProviderToken: !!data?.session?.provider_token,
      hasRefreshToken: !!data?.session?.provider_refresh_token
    })

    if (!error) {
      // [NEW] 로그인 성공 시 토큰을 DB에 별도 저장 (30분 끊김 방지)
      const { session } = data
      if (session && session.provider_token && session.user) {
        const expires_at = Date.now() + (session.expires_in || 3600) * 1000 // 실제 만료시간 반영

        console.log('🔵 [AUTH CALLBACK] Attempting to upsert tokens to user_tokens table...')
        const { error: upsertError } = await supabase.from('user_tokens').upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token, // access_type='offline' 필수
          expires_at: expires_at,
          updated_at: new Date().toISOString()
        })

        if (upsertError) {
          console.error('🔴 [AUTH CALLBACK] Token Upsert Failed:', upsertError)
          // 에러가 나면 사용자에게 알리기 위해 리다이렉트
          return NextResponse.redirect(`${origin}/?error=token_save_failed&reason=${encodeURIComponent(upsertError.message)}`)
        } else {
          console.log('🟢 [AUTH CALLBACK] Tokens saved successfully!')
        }
      } else {
        console.warn('🟡 [AUTH CALLBACK] No provider_token found in session. Google Drive access may fail.')
      }

      return NextResponse.redirect(`${origin}${next}`)
    } else {
      // 에러가 났다면 원인을 알 수 있게 주소창에 표시합니다.
      console.error('🔴 [AUTH CALLBACK] Login Error:', error, 'CAUSE:', (error as any).cause || (error as any).stack)
      return NextResponse.redirect(`${origin}/?error=auth_failed&reason=${encodeURIComponent(error.message)}`)
    }
  }

  console.log('🔴 [AUTH CALLBACK] No code provided. Redirecting back to start.')

  // 코드가 없다면
  return NextResponse.redirect(`${origin}/?error=no_code`)
}