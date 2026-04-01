'use server'

import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ✅ 1. 화면에 있는 리스트 중에서 골라주기 (Connect 탭용)
export async function recommendMusic(userQuery: string, musicList: any[]) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API Key가 없습니다.' }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // ⚠️ 수정됨: 1.5-flash 대신 가장 호환성 높은 'gemini-pro' 사용
    // (이전 코드에서 사용하던 안정적인 버전입니다)
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })

    // 데이터 절약: 이름만 추려서 보냄
    const songsText = musicList.map((file, index) => `${index}:${file.name}`).join('\n')

    const prompt = `
      You are a Music DJ. User query: "${userQuery}"
      
      Here is the candidate list (Index:Title):
      ${songsText}
      
      Task: Select songs that best match the query.
      Output: JSON array of indices ONLY. e.g. [0, 5, 12]
      Do not output any other text.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text()

    // JSON 파싱 (마크다운 제거)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    
    if (firstBracket === -1) throw new Error("AI 응답 형식을 파싱할 수 없습니다.")
    
    const jsonString = text.substring(firstBracket, lastBracket + 1)
    const indices = JSON.parse(jsonString)

    // 선택된 인덱스를 다시 노래 객체로 변환
    const selectedSongs = indices.map((idx: number) => musicList[idx]).filter((item: any) => item !== undefined)

    return { songs: selectedSongs }

  } catch (error: any) {
    console.error("❌ AI Error:", error)
    return { error: error.message || 'AI 처리 중 오류가 발생했습니다.' }
  }
}

// ✅ 2. DB에 있는 전체 노래 중에서 골라주기 (Library 탭용)
export async function searchLibraryWithAI(userQuery: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // DB에서 후보군 가져오기 (최대 1만 곡)
  const { data: candidates, error } = await supabase
    .from('music_files')
    .select('id, name')
    .eq('user_id', user.id)
    .limit(10000) 

  if (error || !candidates || candidates.length === 0) return []

  // 위 함수 재사용
  const result = await recommendMusic(userQuery, candidates)

  if (result.error || !result.songs || result.songs.length === 0) return []

  // 선택된 노래들의 상세 정보(썸네일 등)를 DB에서 다시 조회
  const selectedIds = result.songs.map((s: any) => s.id)
  
  const { data: fullTracks } = await supabase
    .from('music_files')
    .select('*')
    .in('id', selectedIds)

  return fullTracks || []
}