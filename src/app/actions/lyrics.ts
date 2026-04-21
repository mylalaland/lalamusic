'use server'

// 0. 가사 검색 정확도를 높이기 위한 정규화 필터 (이물질 제거)
function normalizeText(text: string) {
  if (!text) return ''
  return text
    .replace(/\[.*?\]/g, '')     // [MV], [Official Audio] 등 제거
    .replace(/\(feat\..*?\)/ig, '') // (feat. ...) 제거
    .replace(/\(.*?\)/g, '')     // 괄호 내용 보수적으로 제거 (옵션)
    .replace(/\{.*?\}/g, '')     // 중괄호 내용 제거
    .replace(/(- )?(official|audio|video|mv|lyric|lyrics|가사).*/ig, '') // 꼬리표 제거
    .replace(/\.(mp3|flac|m4a|wav|aac|ogg)$/i, '') // 확장자 제거
    .trim()
}

// LRC 타임스탬프 포함 여부 판별
function isSyncedLyrics(lyrics: string): boolean {
  return /\[\d{1,3}:\d{2}/.test(lyrics)
}

// 1. LRCLIB (해외 곡, 팝송에 강력함 - 무료/오픈소스)
// [CHANGED] syncedLyrics와 plainLyrics를 분리 반환
async function getLrcLibLyrics(artist: string, title: string, duration?: number): Promise<{ synced: string | null, plain: string | null }> {
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    })
    if (duration) params.append('duration', duration.toString())

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'SlowiMusic/1.0' }
    })

    if (!res.ok) return { synced: null, plain: null }

    const data = await res.json()
    return {
      synced: data.syncedLyrics || null,
      plain: data.plainLyrics || null
    }
  } catch (e) {
    console.error('LRCLIB Error:', e)
    return { synced: null, plain: null }
  }
}

// 2. 알송 (한국 노래, K-POP에 강력함)
// [CHANGED] 반환된 가사의 LRC 포맷 여부를 판별하여 분리
async function getAlsongLyrics(artist: string, title: string): Promise<{ synced: string | null, plain: string | null }> {
  try {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:als="ALSongWebServer">
 <soap:Body>
  <als:GetResembleLyric2>
   <als:stQuery>
    <als:strTitle>${escapeXml(title)}</als:strTitle>
    <als:strArtistName>${escapeXml(artist)}</als:strArtistName>
    <als:nCurPage>0</als:nCurPage>
   </als:stQuery>
  </als:GetResembleLyric2>
 </soap:Body>
</soap:Envelope>`

    const res = await fetch('http://lyrics.alsong.co.kr/alsongwebservice/service1.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=UTF-8',
        'User-Agent': 'Android' 
      },
      body: soapBody
    })

    const text = await res.text()
    const lyricMatch = text.match(/<strLyric>(.*?)<\/strLyric>/s)
    
    if (lyricMatch && lyricMatch[1]) {
      const lyrics = lyricMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<br>/gi, '\n')

      // 알송 가사가 LRC 형식([mm:ss.xx])인지 판별
      if (isSyncedLyrics(lyrics)) {
        return { synced: lyrics, plain: null }
      } else {
        return { synced: null, plain: lyrics }
      }
    }
    return { synced: null, plain: null }
  } catch (e) {
    console.error('Alsong Error:', e)
    return { synced: null, plain: null }
  }
}

// XML 특수문자 처리
function escapeXml(unsafe: string) {
  if (!unsafe) return ""
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
    }
    return c
  })
}

// 3. [CHANGED] 통합 검색 함수 — 싱크/일반 가사를 분리하여 반환
export async function getExternalLyrics(
  artist: string, 
  title: string, 
  duration?: number, 
  sources: string[] = ['Alsong', 'LRCLIB']
): Promise<{
  success: boolean,
  syncedLyrics: string | null,
  plainLyrics: string | null,
  source: string | null,
  error?: string
}> {
  // 텍스트 정규화
  let searchArtist = normalizeText(artist)
  let searchTitle = normalizeText(title)

  // 구글 드라이브 파일이라 가수 정보가 없고 "가수 - 제목" 형태라면 분리
  if ((!searchArtist || searchArtist.toLowerCase() === 'unknown artist') && searchTitle.includes('-')) {
    const parts = searchTitle.split('-')
    if (parts.length >= 2) {
      searchArtist = parts[0].trim()
      searchTitle = parts.slice(1).join('-').trim()
    }
  }

  searchArtist = searchArtist || artist
  searchTitle = searchTitle || title

  // 모든 소스에 대해 동시에 요청 (병렬)
  const promises = sources.map(async (source) => {
    if (source === 'LRCLIB') {
      const res = await getLrcLibLyrics(searchArtist, searchTitle, duration)
      return { source: 'LRCLIB', ...res }
    } else if (source === 'Alsong') {
      const res = await getAlsongLyrics(searchArtist, searchTitle)
      return { source: 'Alsong', ...res }
    }
    return { source, synced: null, plain: null }
  })

  const results = await Promise.all(promises)

  // 결과 합산: 싱크 가사와 일반 가사를 각각 최우선 소스에서 추출
  let bestSynced: string | null = null
  let bestPlain: string | null = null
  let syncSource: string | null = null
  let plainSource: string | null = null

  for (const source of sources) {
    const result = results.find(r => r.source === source)
    if (result) {
      if (!bestSynced && result.synced) {
        bestSynced = result.synced
        syncSource = result.source
      }
      if (!bestPlain && result.plain) {
        bestPlain = result.plain
        plainSource = result.source
      }
    }
  }

  if (bestSynced || bestPlain) {
    return {
      success: true,
      syncedLyrics: bestSynced,
      plainLyrics: bestPlain,
      source: syncSource || plainSource
    }
  }

  return { success: false, syncedLyrics: null, plainLyrics: null, source: null, error: 'Lyrics not found' }
}