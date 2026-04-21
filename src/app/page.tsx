'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.readonly',
          redirectTo: `${location.origin}/auth/callback?next=/connect`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('OAuth Error:', error)
        alert(`로그인 오류: ${error.message}`)
        setLoading(false)
      }
      // 성공 지점이면 자동으로 리다이렉트되므로 setLoading(false)는 필요없지만, 안전을 위해 놔둘 수도 있습니다.
    } catch (err: any) {
      console.error('Unhandled Login Error:', err)
      alert(`예기치 않은 오류: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Lala Music
          </h1>
          <p className="text-gray-400">나만의 구글 드라이브 뮤직 플레이어</p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white text-black font-bold py-4 px-6 rounded-xl hover:bg-gray-200 transition active:scale-95 flex items-center justify-center gap-3"
        >
          {loading ? (
            <span className="animate-spin text-xl">⏳</span>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Google 계정으로 로그인
        </button>
        {/* [DIAGNOSTIC] 환경 변수 로드 상태 표시 */}
        <div className="pt-8 text-[10px] space-y-1 opacity-20 hover:opacity-100 transition-opacity">
          <p>System Status Diagnostics</p>
          <div className="flex justify-center gap-4">
            <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? "text-green-500" : "text-red-500"}>
              URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING'}
            </span>
            <span className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "text-green-500" : "text-red-500"}>
              KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'OK' : 'MISSING'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}