/**
 * Network Guard — WiFi 전용 스트리밍 설정을 위한 네트워크 상태 감지
 * 
 * - Android Chrome: Network Information API로 자동 감지
 * - iOS Safari: API 미지원이므로 수동 토글에 의존
 */

/**
 * 현재 셀룰러 데이터 연결인지 확인합니다.
 * 
 * @returns true = 셀룰러, false = WiFi 또는 감지 불가
 */
export function isCellularConnection(): boolean {
  if (typeof navigator === 'undefined') return false
  
  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection

  if (!connection) {
    // iOS Safari 등 API 미지원 → 감지 불가
    return false
  }

  // type이 'cellular'이면 모바일 데이터
  if (connection.type === 'cellular') return true
  
  // effectiveType으로 추가 판별 (2g/3g/4g 등)
  // type이 없는 경우 effectiveType만으로는 WiFi/cellular 구분이 안 됨
  return false
}

/**
 * Network Information API를 지원하는지 확인합니다.
 * 
 * @returns true = 지원 (Android Chrome 등), false = 미지원 (iOS Safari 등)
 */
export function supportsNetworkInfo(): boolean {
  if (typeof navigator === 'undefined') return false
  return !!(
    (navigator as any).connection || 
    (navigator as any).mozConnection || 
    (navigator as any).webkitConnection
  )
}

/**
 * 현재 스트리밍이 가능한지 확인합니다.
 * 
 * @param wifiOnlyEnabled - Settings에서 WiFi 전용 모드가 켜져 있는지
 * @returns { allowed: boolean, reason?: string }
 */
export function canStreamNow(wifiOnlyEnabled: boolean): { allowed: boolean; reason?: string } {
  if (!wifiOnlyEnabled) {
    return { allowed: true }
  }

  // API 지원 여부 확인
  if (!supportsNetworkInfo()) {
    // iOS 등에서는 API를 지원하지 않으므로, 사용자 설정만으로 차단
    // 사용자가 수동으로 "WiFi 전용"을 켰다면 차단 (수동 모드)
    return { 
      allowed: false, 
      reason: '셀룰러 데이터에서 재생이 차단되었습니다.\n설정에서 변경할 수 있습니다.' 
    }
  }

  // Android 등 API 지원 시 자동 감지
  if (isCellularConnection()) {
    return { 
      allowed: false, 
      reason: '셀룰러 데이터에서 재생이 차단되었습니다.\nWiFi에 연결하거나 설정에서 변경해주세요.' 
    }
  }

  return { allowed: true }
}
