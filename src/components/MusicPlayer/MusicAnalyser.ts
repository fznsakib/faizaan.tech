export class MusicAnalyser {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private bufferLength: number;
  private bpmDetector: BPMDetector;

  constructor(audioContext: AudioContext, audioSource: AudioNode) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    audioSource.connect(this.analyser);
    this.analyser.connect(audioContext.destination);

    this.bpmDetector = new BPMDetector(
      audioContext.sampleRate,
      this.bufferLength
    );
  }

  /**
   * Get frequency data for low, mid, and high ranges
   */
  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate actual frequency ranges based on sample rate and FFT size
    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2; // Maximum frequency we can detect

    // Define proper frequency bands in Hz
    const lowFreqMax = 250; // 0-250 Hz (bass)
    const midFreqMax = 2000; // 250-2000 Hz (midrange)
    // High: 2000+ Hz (treble)

    // Convert Hz to frequency bin indices
    const lowEnd = Math.floor((lowFreqMax / nyquist) * this.bufferLength);
    const midEnd = Math.floor((midFreqMax / nyquist) * this.bufferLength);

    // Ensure we don't exceed buffer length
    const safeLowEnd = Math.min(lowEnd, this.bufferLength);
    const safeMidEnd = Math.min(midEnd, this.bufferLength);

    const lowFrequency = Array.from(this.dataArray.slice(0, safeLowEnd));
    const midFrequency = Array.from(
      this.dataArray.slice(safeLowEnd, safeMidEnd)
    );
    const highFrequency = Array.from(this.dataArray.slice(safeMidEnd));

    // normalize and average the data for easier consumption
    const normaliseLow = this.normaliseData(lowFrequency);
    const normaliseMid = this.normaliseData(midFrequency);
    const normaliseHigh = this.normaliseData(highFrequency);

    console.log("Frequency ranges:", {
      low: `0-${lowFreqMax}Hz (${safeLowEnd} bins)`,
      mid: `${lowFreqMax}-${midFreqMax}Hz (${safeMidEnd - safeLowEnd} bins)`,
      high: `${midFreqMax}+Hz (${this.bufferLength - safeMidEnd} bins)`,
      values: { low: normaliseLow, mid: normaliseMid, high: normaliseHigh },
    });

    return {
      lowFrequency: normaliseLow,
      midFrequency: normaliseMid,
      highFrequency: normaliseHigh,
    };
  }

  /**
   * Detect BPM from audio data
   */
  detectBPM(): number {
    this.analyser.getByteTimeDomainData(this.dataArray);
    return this.bpmDetector.addData(this.dataArray);
  }

  /**
   * Normalise array data to a more manageable size
   */
  private normaliseData(data: number[]): number[] {
    // return 3 values representing the low, mid, high of this range
    if (data.length === 0) return [0];

    const chunkSize = Math.max(1, Math.floor(data.length / 3));
    const result = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      // Use a more stable approach with weighted average
      const maxValue = Math.max(...chunk);
      const avgValue = chunk.reduce((sum, val) => sum + val, 0) / chunk.length;

      // Weight average more heavily for stability, max for responsiveness
      const stableValue = avgValue * 0.8 + maxValue * 0.2;
      result.push(stableValue);
    }

    return result;
  }
}

/**
 * Simple BPM detector class
 */
class BPMDetector {
  private sampleRate: number;
  private bufferSize: number;
  private recentEnergies: number[];
  private energyThreshold: number;
  private lastBeat: number;
  private beatTimes: number[];
  private currentTime: number;

  constructor(sampleRate: number, bufferSize: number) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.recentEnergies = [];
    this.energyThreshold = 0.8;
    this.lastBeat = 0;
    this.beatTimes = [];
    this.currentTime = 0;
  }

  addData(data: Uint8Array): number {
    // calculate energy in this buffer with sum of squares
    let energy = 0;
    for (let i = 0; i < data.length; i++) {
      // convert from 0-255 to -1.0 to 1.0
      const amplitude = data[i] / 128.0 - 1.0;
      energy += amplitude * amplitude;
    }
    energy = energy / data.length;

    // keep recent energies for threshold calculation
    this.recentEnergies.push(energy);
    if (this.recentEnergies.length > 43) {
      // about 1 second of data
      this.recentEnergies.shift();
    }

    // calculate the energy threshold
    const sortedEnergies = [...this.recentEnergies].sort((a, b) => a - b);
    this.energyThreshold =
      sortedEnergies[Math.floor(sortedEnergies.length * 0.6)];

    // increment time
    const bufferDuration = this.bufferSize / this.sampleRate;
    this.currentTime += bufferDuration;

    // check if we have a beat (energy peak)
    if (
      energy > this.energyThreshold &&
      this.currentTime - this.lastBeat > 0.35
    ) {
      // At least 350ms between beats
      this.beatTimes.push(this.currentTime);
      if (this.beatTimes.length > 10) {
        this.beatTimes.shift();
      }
      this.lastBeat = this.currentTime;
    }

    return this.calculateBPM();
  }

  private calculateBPM(): number {
    if (this.beatTimes.length < 4) return 0;

    // calculate time differences between beats
    const intervals = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }
    const avgInterval =
      intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    // convert to bpm
    return Math.round(60 / avgInterval);
  }
}
