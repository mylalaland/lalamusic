'use server'

import { createClient } from '@/lib/supabase/server'

// ====================================================================
// 유틸: AI 프로바이더별 텍스트 생성
// ====================================================================
async function generateAIResponse(
  prompt: string, 
  apiKey: string, 
  provider: string = 'gemini', 
  model?: string
): Promise<string> {
  if (provider === 'gemini') {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash' })
      const result = await geminiModel.generateContent(prompt)
      return result.response.text()
    } catch (e: any) {
      console.error('[Gemini API Core Error]:', e)
      const rawMsg = e.message || String(e)
      if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('key is invalid') || rawMsg.includes('API key not valid') || rawMsg.includes('400')) {
        throw new Error('API Key가 올바르지 않습니다. 공백이나 잘못된 문자가 포함되지 않았는지 다시 확인해주세요.')
      }
      if (rawMsg.includes('Quota exceeded') || rawMsg.includes('quota') || rawMsg.includes('429')) {
        throw new Error('API 호출 할당량을 초과했습니다. 무료 등급 한도에 도달했거나 너무 자주 호출한 것 같습니다.')
      }
      if (rawMsg.includes('not found') || rawMsg.includes('not supported') || rawMsg.includes('404')) {
        throw new Error(`요청한 모델(${model || 'gemini-2.0-flash'})을 찾을 수 없거나 현재 API Key 등급에서 사용할 수 없는 모델입니다.`)
      }
      throw new Error(`구글 API 오류 상세: ${rawMsg}`)
    }
  } 
  
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `OpenAI API error: ${res.status}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }
  
  if (provider === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Claude API error: ${res.status}`)
    }
    const data = await res.json()
    return data.content?.[0]?.text || ''
  }

  throw new Error(`지원하지 않는 AI 프로바이더: ${provider}`)
}

// ====================================================================
// 사용 가능한 모델 조회
// ====================================================================
export async function fetchAvailableModels(
  apiKey: string,
  provider: string = 'gemini'
): Promise<{ id: string, label: string }[]> {
  if (!apiKey) return []

  try {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
      )
      if (!res.ok) throw new Error(`API Error: ${res.status}`)
      const data = await res.json()
      const models = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          label: m.displayName || m.name.replace('models/', '')
        }))
        .sort((a: any, b: any) => {
          // 최신 모델 먼저 (flash, pro 순)
          const score = (id: string) => {
            if (id.includes('3.5') && id.includes('flash')) return -2
            if (id.includes('3.5') && id.includes('pro')) return -1
            if (id.includes('2.5') && id.includes('flash')) return 0
            if (id.includes('2.5') && id.includes('pro')) return 1
            if (id.includes('2.0') && id.includes('flash')) return 2
            if (id.includes('1.5') && id.includes('flash')) return 3
            if (id.includes('1.5') && id.includes('pro')) return 4
            return 10
          }
          return score(a.id) - score(b.id)
        })
      return models
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error(`API Error: ${res.status}`)
      const data = await res.json()
      const models = (data.data || [])
        .filter((m: any) => m.id.startsWith('gpt-'))
        .map((m: any) => ({ id: m.id, label: m.id }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id))
      return models
    }

    if (provider === 'claude') {
      // Anthropic doesn't have a public list models API
      return [
        { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
        { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      ]
    }
    return []
  } catch (e: any) {
    console.error('fetchAvailableModels Error:', e)
    return []
  }
}

// ====================================================================
// API 키 연결 테스트
// ====================================================================
export async function testAIConnection(
  apiKey: string, 
  provider: string = 'gemini', 
  model?: string
): Promise<{ success: boolean, message: string, model: string }> {
  if (!apiKey) return { success: false, message: 'API Key가 비어있습니다.', model: model || '' }
  
  try {
    const response = await generateAIResponse(
      'Reply with exactly one word: "OK"', 
      apiKey, provider, model
    )
    if (response && response.trim().length > 0) {
      return { success: true, message: `연결 성공! 응답: "${response.trim().slice(0, 50)}"`, model: model || '' }
    }
    return { success: false, message: '응답이 비어있습니다.', model: model || '' }
  } catch (e: any) {
    return { success: false, message: e.message || '연결 실패', model: model || '' }
  }
}

// ====================================================================
// 1. 화면에 있는 리스트 중에서 골라주기 (Connect 탭용)
// ====================================================================
export async function recommendMusic(
  userQuery: string, 
  musicList: any[], 
  apiKey?: string, 
  provider: string = 'gemini',
  model?: string
) {
  if (!apiKey) return { error: 'API Key가 없습니다. 설정에서 API Key를 등록해주세요.', songs: [] }

  try {
    const songsText = musicList.map((file, index) => `${index}:${file.name}`).join('\n')

    const prompt = `
      You are a Music DJ. User query: "${userQuery}"
      
      Here is the candidate list (Index:Title):
      ${songsText}
      
      Task: Select songs that best match the query. Be generous - select at least 5-10 songs if available.
      Output: JSON array of indices ONLY. e.g. [0, 5, 12]
      Do not output any other text.
    `

    const text = await generateAIResponse(prompt, apiKey, provider, model)

    // JSON 파싱 (마크다운 제거)
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const firstBracket = cleaned.indexOf('[')
    const lastBracket = cleaned.lastIndexOf(']')
    
    if (firstBracket === -1) {
      console.error('AI response:', text)
      return { error: 'AI 응답을 파싱할 수 없습니다.', songs: [] }
    }
    
    const jsonString = cleaned.substring(firstBracket, lastBracket + 1)
    const indices = JSON.parse(jsonString)

    const selectedSongs = indices
      .map((idx: number) => musicList[idx])
      .filter((item: any) => item !== undefined)

    if (selectedSongs.length === 0) {
      return { error: 'AI가 선택한 곡을 매칭할 수 없습니다.', songs: [] }
    }

    return { songs: selectedSongs }

  } catch (error: any) {
    console.error("❌ AI Error:", error)
    return { error: error.message || 'AI 처리 중 오류가 발생했습니다.', songs: [] }
  }
}

// ====================================================================
// 2. DB에 있는 전체 노래 중에서 골라주기
// ====================================================================
export async function searchLibraryWithAI(
  userQuery: string, 
  apiKey?: string, 
  provider: string = 'gemini',
  model?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  if (!apiKey) throw new Error('API Key가 없습니다. 설정에서 API Key를 등록해주세요.')

  try {
    const keywordPrompt = `
      User wants music: "${userQuery}"
      Extract 1 to 3 search keywords (artist names, moods, genres, or title words) to find audio files in a database.
      Output ONLY comma-separated keywords, no extra text.
      Example: "아이유 발라드 틀어줘" -> "아이유, 발라드"
    `
    const keywordText = await generateAIResponse(keywordPrompt, apiKey, provider, model)
    const keywords = keywordText.split(',').map(k => k.trim()).filter(Boolean)
    if (keywords.length === 0) keywords.push(userQuery)

    let queryBuilder = supabase
      .from('music_files')
      .select('id, name')
      .eq('user_id', user.id)

    const orCondition = keywords.map(k => `name.ilike.%${k}%`).join(',')
    if (orCondition) queryBuilder = queryBuilder.or(orCondition)

    const { data: candidates } = await queryBuilder.limit(100)
    let finalCandidates = candidates || []
    
    if (finalCandidates.length < 10) {
      const { data: randomFallback } = await supabase
        .from('music_files')
        .select('id, name')
        .eq('user_id', user.id)
        .limit(100)
      finalCandidates = randomFallback || []
    }

    if (finalCandidates.length === 0) return []

    const result = await recommendMusic(userQuery, finalCandidates, apiKey, provider, model)
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

// ====================================================================
// 3. 드라이브 폴더 내 AI 키워드 검색 (하위 폴더 재귀)
// ====================================================================
export async function searchDriveWithAI(
  folderId: string, 
  userQuery: string, 
  apiKey?: string, 
  provider: string = 'gemini',
  model?: string
) {
  if (!apiKey) throw new Error('API Key가 없습니다.')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  try {
    const keywordPrompt = `
      User wants music: "${userQuery}"
      Extract exactly 1 main search keyword (e.g., artist name, genre) to use in a Google Drive 'name contains' search.
      Output ONLY the keyword, no extra text.
      Example: "아이유 발라드 틀어줘" -> "아이유"
    `
    const keyword = (await generateAIResponse(keywordPrompt, apiKey, provider, model)).trim() || userQuery

    const { getDriveContents } = await import('./library')
    const { files } = await getDriveContents(folderId, [], keyword, 'name', 'files')
    
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