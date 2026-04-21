export class Equalizer {
    public audioContext: AudioContext;
    public source: MediaElementAudioSourceNode;
    public filters: BiquadFilterNode[];
    public gainNode: GainNode;
    public frequencies = [60, 230, 910, 3600, 14000];

    constructor(audioElement: HTMLAudioElement) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        
        // Ensure context is running (can be suspended by browser policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.source = this.audioContext.createMediaElementSource(audioElement);
        this.gainNode = this.audioContext.createGain();
        
        this.filters = this.frequencies.map(freq => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.0;
            filter.gain.value = 0; // default 0dB
            return filter;
        });

        // Connect filters in series
        this.source.connect(this.filters[0]);
        for (let i = 0; i < this.filters.length - 1; i++) {
            this.filters[i].connect(this.filters[i + 1]);
        }
        
        // Connect last filter to GainNode, and GainNode to speakers
        this.filters[this.filters.length - 1].connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
    }

    setVolume(vol: number) {
        if (this.gainNode) this.gainNode.gain.value = vol;
    }

    setGain(index: number, gain: number) {
        if (this.filters[index]) {
            // clamp gain between -12 and 12 dB
            this.filters[index].gain.value = Math.max(-12, Math.min(12, gain));
        }
    }

    getGains(): number[] {
        return this.filters.map(filter => filter.gain.value);
    }

    destroy() {
        this.source?.disconnect();
        this.filters?.forEach(filter => filter.disconnect());
        // Do not close audioContext if it might be reused or if it is managed globally, 
        // but here we instantiate it per EQ instance, so we can try to close it.
        if (this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(console.error);
        }
    }
}
