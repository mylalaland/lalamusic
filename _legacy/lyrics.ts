'use server'

// 1. LRCLIB (해외 곡, 팝송에 강력함 - 무료/오픈소스)
async function getLrcLibLyrics(artist: string, title: string, duration?: number) {
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    })
    // 재생 시간 정보가 있으면 정확도가 올라갑니다.
    if (duration) params.append('duration', duration.toString())

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'SlowiMusic/1.0' }
    })

    if (!res.ok) return null

    const data = await res.json()
    // syncedLyrics(싱크 가사)가 없으면 plainLyrics(일반 가사) 반환
    return data.syncedLyrics || data.plainLyrics || null
  } catch (e) {
    console.error('LRCLIB Error:', e)
    return null
  }
}

// 2. 알송 (한국 노래, K-POP에 강력함)
async function getAlsongLyrics(artist: string, title: string) {
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
    const lyricMatch = text.match(/<strLyric>([\s\S]*?)<\/strLyric>/)
    
    if (lyricMatch && lyricMatch[1]) {
      return lyricMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<br>/gi, '\n')
    }
    return null
  } catch (e) {
    console.error('Alsong Error:', e)
    return null
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

// 3. 통합 검색 함수 (외부에서 호출)
export async function getExternalLyrics(artist: string, title: string, duration?: number) {
  // 1순위: LRCLIB 시도 (팝송 등 해외 데이터 우수)
  const lrcLib = await getLrcLibLyrics(artist, title, duration)
  if (lrcLib) return { success: true, lyrics: lrcLib, source: 'LRCLIB' }

  // 2순위: 알송 시도 (한국 노래 데이터 우수)
  const alsong = await getAlsongLyrics(artist, title)
  if (alsong) return { success: true, lyrics: alsong, source: 'Alsong' }

  return { success: false, error: 'Lyrics not found' }
}