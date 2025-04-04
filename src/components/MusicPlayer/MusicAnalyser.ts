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
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    audioSource.connect(this.analyser);
    this.analyser.connect(audioContext.destination);

    this.bpmDetector = new BPMDetector(audioContext.sampleRate, this.bufferLength);
  }

  /**
   * Get frequency data for low, mid, and high ranges
   */
  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.dataArray);

    const lowEnd = Math.floor(this.bufferLength * 0.2);  // approx 0-200Hz
    const midEnd = Math.floor(this.bufferLength * 0.6);  // approx 200-2000Hz

    const lowFrequency = Array.from(this.dataArray.slice(0, lowEnd));
    const midFrequency = Array.from(this.dataArray.slice(lowEnd, midEnd));
    const highFrequency = Array.from(this.dataArray.slice(midEnd));

    // normalize and average the data for easier consumption
    const normaliseLow = this.normaliseData(lowFrequency);
    const normaliseMid = this.normaliseData(midFrequency);
    const normaliseHigh = this.normaliseData(highFrequency);

    return {
      lowFrequency: normaliseLow,
      midFrequency: normaliseMid,
      highFrequency: normaliseHigh
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
      const average = chunk.reduce((sum, val) => sum + val, 0) / chunk.length;
      result.push(average);
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
      const amplitude = (data[i] / 128.0) - 1.0;
      energy += amplitude * amplitude;
    }
    energy = energy / data.length;

    // keep recent energies for threshold calculation
    this.recentEnergies.push(energy);
    if (this.recentEnergies.length > 43) { // about 1 second of data
      this.recentEnergies.shift();
    }

    // calculate the energy threshold
    const sortedEnergies = [...this.recentEnergies].sort((a, b) => a - b);
    this.energyThreshold = sortedEnergies[Math.floor(sortedEnergies.length * 0.6)];

    // increment time
    const bufferDuration = this.bufferSize / this.sampleRate;
    this.currentTime += bufferDuration;

    // check if we have a beat (energy peak)
    if (energy > this.energyThreshold && this.currentTime - this.lastBeat > 0.35) { // At least 350ms between beats
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
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    // convert to bpm
    return Math.round(60 / avgInterval);
  }
} 