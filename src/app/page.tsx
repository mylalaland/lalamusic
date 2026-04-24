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
          redirectTo: `${location.origin}/auth/callback?next=/`,
          // Removed queryParams to prevent forcing consent prompt every time
        },
      })

      if (error) {
        console.error('OAuth Error:', error)
        alert(`로그인 오류: ${error.message}`)
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Unhandled Login Error:', err)
      alert(`예기치 않은 오류: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen analog-surface p-4">
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
      
      <div className="text-center space-y-10 max-w-md w-full relative z-10 bg-[var(--bg-container)] p-10 rounded-xl border border-[var(--border-strong)] shadow-[var(--shadow-floating)]">
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-[var(--bg-container-high)] border border-[var(--border-strong)] shadow-inner">
            <span className="font-['Work_Sans'] text-4xl font-bold text-[var(--primary)] italic">S</span>
          </div>
          <div>
            <h1 className="font-['Noto_Serif'] text-4xl font-bold text-[var(--text-main)] mb-2 tracking-tight">
              Lala Music
            </h1>
            <p className="font-['Work_Sans'] text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase">
              Precision Audio Player
            </p>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[var(--primary)] text-[var(--on-primary)] font-['Work_Sans'] font-bold text-sm tracking-widest uppercase py-4 px-6 rounded-md hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-3 shadow-[var(--shadow-ambient)]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-[var(--on-primary)] border-t-transparent animate-spin rounded-full" />
              AUTHENTICATING...
            </span>
          ) : (
            <>
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
              Sign in with Google
            </>
          )}
        </button>

        {/* [DIAGNOSTIC] 환경 변수 로드 상태 표시 */}
        <div className="pt-6 border-t border-[var(--border-light)] mt-8">
          <p className="font-['Work_Sans'] text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-2">System Diagnostics</p>
          <div className="flex justify-center gap-4 text-[10px] font-['Work_Sans'] font-medium">
            <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? "text-[var(--primary)]" : "text-red-500"}>
              URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING'}
            </span>
            <span className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "text-[var(--primary)]" : "text-red-500"}>
              KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'OK' : 'MISSING'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}