'use server'

import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ✅ 1. 화면에 있는 리스트 중에서 골라주기 (Connect 탭용)
export async function recommendMusic(userQuery: string, musicList: any[], apiKey?: string, provider: string = 'gemini') {
  if (!apiKey) return { error: 'API Key가 없습니다. 설정에서 API Key를 등록해주세요.' }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // ⚠️ 수정됨: 1.5-flash-latest로 통일
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

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

// ✅ 2. DB에 있는 전체 노래 중에서 골라주기 (토큰 최적화 버전)
export async function searchLibraryWithAI(userQuery: string, apiKey?: string, provider: string = 'gemini') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  if (!apiKey) throw new Error('API Key가 없습니다. 설정에서 API Key를 등록해주세요.')

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

    // [STEP 1] 검색어에서 핵심 키워드만 추출 (DB 검색용) - 매우 적은 토큰 소모
    const keywordPrompt = `
      User wants music: "${userQuery}"
      Extract 1 to 3 search keywords (artist names, moods, genres, or title words) to find audio files in a database.
      Output ONLY comma-separated keywords, no extra text.
      Example: "아이유 발라드 틀어줘" -> "아이유, 발라드"
    `
    const keywordRes = await model.generateContent(keywordPrompt)
    const keywords = keywordRes.response.text().split(',').map(k => k.trim()).filter(Boolean)

    if (keywords.length === 0) keywords.push(userQuery)

    // [STEP 2] 키워드를 바탕으로 DB에서 최대 100개 후보 추출
    // (1만 개 전체를 AI에게 보내면 토큰 낭비가 심하므로 필터링)
    let queryBuilder = supabase
      .from('music_files')
      .select('id, name')
      .eq('user_id', user.id)

    // 키워드 중 하나라도 포함된 것 우선 검색
    const orCondition = keywords.map(k => `name.ilike.%${k}%`).join(',')
    if (orCondition) {
        queryBuilder = queryBuilder.or(orCondition)
    }

    // 만약 키워드로 찾은 게 너무 적다면 최신순으로 100개 가져옴 (다양성 확보)
    const { data: candidates, error } = await queryBuilder.limit(100)
    
    let finalCandidates = candidates || []
    
    // 키워드로 찾은 결과가 10개 미만이면, 그냥 전체 중 100개를 랜덤/최신순으로 섞음
    if (finalCandidates.length < 10) {
        const { data: randomFallback } = await supabase
            .from('music_files')
            .select('id, name')
            .eq('user_id', user.id)
            .limit(100)
        finalCandidates = randomFallback || []
    }

    if (finalCandidates.length === 0) return []

    // [STEP 3] 추려진 100개 후보만 AI에게 넘겨 최종 선택 (토큰 대폭 절약)
    const result = await recommendMusic(userQuery, finalCandidates, apiKey, provider)

    if (result.error || !result.songs || result.songs.length === 0) return []

    const selectedIds = result.songs.map((s: any) => s.id)
    
    const { data: fullTracks } = await supabase
      .from('music_files')
      .select('*')
      .in('id', selectedIds)

    return fullTracks || []
  } catch (e: any) {
    console.error("AI Optimize Error:", e)
    throw new Error(e.message || 'AI 처리 중 오류가 발생했습니다.')
  }
}

// ✅ 3. 지정된 드라이브 폴더 내에서 AI 키워드 기반으로 검색
export async function searchDriveWithAI(folderId: string, userQuery: string, apiKey?: string, provider: string = 'gemini') {
  if (!apiKey) throw new Error('API Key가 없습니다.')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

    const keywordPrompt = `
      User wants music: "${userQuery}"
      Extract exactly 1 main search keyword (e.g., artist name, genre) to use in a Google Drive 'name contains' search.
      Output ONLY the keyword, no extra text.
      Example: "아이유 발라드 틀어줘" -> "아이유"
    `
    const keywordRes = await model.generateContent(keywordPrompt)
    let keyword = keywordRes.response.text().trim()
    if (!keyword) keyword = userQuery

    // Google Drive API 호출
    const { getDriveContents } = await import('./library')
    const { files } = await getDriveContents(folderId, [], keyword, 'name', 'files')
    
    // AI 검색 결과로 가공
    return files.map((f: any) => ({
      id: f.id, title: f.name, artist: 'Google Drive',
      thumbnail_link: f.thumbnailLink, drive_file_id: f.id, mime_type: f.mimeType,
      duration: f.videoMediaMetadata?.durationMillis ? f.videoMediaMetadata.durationMillis / 1000 : undefined
    }))
  } catch (e: any) {
    console.error("❌ searchDriveWithAI Error:", e)
    throw new Error(e.message || 'AI 검색 중 오류가 발생했습니다.')
  }
}