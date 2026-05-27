let mediaCtx: AudioContext | null = null;
let fallbackCtx: AudioContext | null = null;

export function getMediaAudioContext(): AudioContext {
  if (typeof window === 'undefined') return {} as AudioContext;
  if (!mediaCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    mediaCtx = new AudioCtx();
  }
  return mediaCtx;
}

export function getFallbackAudioContext(): AudioContext {
  if (typeof window === 'undefined') return {} as AudioContext;
  if (!fallbackCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    fallbackCtx = new AudioCtx();
  }
  return fallbackCtx;
}

export async function unlockAllAudioContexts(): Promise<void> {
  if (typeof window === 'undefined') return;
  const mCtx = getMediaAudioContext();
  const fCtx = getFallbackAudioContext();
  
  const promises = [];
  if (mCtx && mCtx.state === 'suspended') {
    promises.push(mCtx.resume().catch(() => {}));
  }
  if (fCtx && fCtx.state === 'suspended') {
    promises.push(fCtx.resume().catch(() => {}));
  }
  
  // iOS Safari를 확실하게 잠금 해제하기 위해 짧은 무음 비프음을 재생하는 비책 적용
  try {
    [mCtx, fCtx].forEach(ctx => {
      if (ctx && ctx.state !== 'closed') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001; // 거의 들리지 않는 무음
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(0.01);
      }
    });
  } catch (e) {
    console.warn('Silent beep unlock failed:', e);
  }

  await Promise.all(promises);
}
