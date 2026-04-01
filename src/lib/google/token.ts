import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

export async function getValidGoogleToken(userId: string) {
  const supabase = await createClient()

  // 1. DB에서 저장된 토큰 조회
  const { data: tokenData, error } = await supabase
    .from('user_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenData) {
    console.error('Token fetch error:', error)
    throw new Error('Google Drive 연동이 필요합니다. 다시 로그인해주세요.')
  }

  const now = Date.now()
  // 만료 시간 5분 전이면 갱신 시도
  if (tokenData.expires_at && tokenData.expires_at > now + 5 * 60 * 1000) {
    return tokenData.access_token
  }

  // 2. 토큰 만료 시 Refresh Token으로 갱신
  if (!tokenData.refresh_token) {
    throw new Error('Refresh Token이 없습니다. 로그아웃 후 다시 로그인해주세요.')
  }

  console.log('🔄 Refreshing Google Access Token...')
  
  try {
    // Google Token Endpoint 직접 호출
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!, 
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error_description || 'Token refresh failed')
    }

    const newAccessToken = data.access_token
    const newExpiresAt = Date.now() + (data.expires_in * 1000)

    // 3. 갱신된 토큰 DB 저장
    await supabase.from('user_tokens').upsert({
      user_id: userId,
      access_token: newAccessToken,
      refresh_token: tokenData.refresh_token, // 기존 리프레시 토큰 유지
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    })

    return newAccessToken

  } catch (e) {
    console.error('Token Refresh Error:', e)
    throw e
  }
}