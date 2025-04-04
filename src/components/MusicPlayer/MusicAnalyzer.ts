export class MusicAnalyzer {
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

        // Split the frequency data into low, mid, and high ranges
        // This is a simple split - for production you might want a more nuanced approach
        const lowEnd = Math.floor(this.bufferLength * 0.2);  // approx 0-200Hz
        const midEnd = Math.floor(this.bufferLength * 0.6);  // approx 200-2000Hz

        const lowFrequency = Array.from(this.dataArray.slice(0, lowEnd));
        const midFrequency = Array.from(this.dataArray.slice(lowEnd, midEnd));
        const highFrequency = Array.from(this.dataArray.slice(midEnd));

        // Normalise and average the data for easier consumption
        const normalisedLow = this.normaliseData(lowFrequency);
        const normalisedMid = this.normaliseData(midFrequency);
        const normalisedHigh = this.normaliseData(highFrequency);

        return {
            lowFrequency: normalisedLow,
            midFrequency: normalisedMid,
            highFrequency: normalisedHigh
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
        // For simplicity, we'll just return 3 values representing the low, mid, high of this range
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
 * Improved BPM detector class with more stable detection
 */
class BPMDetector {
    private sampleRate: number;
    private bufferSize: number;
    private recentEnergies: number[] = [];
    private energyThreshold: number = 0.15;
    private beatTimes: number[] = [];
    private currentTime: number = 0;
    private lastPeakTime: number = 0;
    private minInterBeatInterval: number = 0.25; // At least 250ms between beats (240 BPM max)

    // BPM smoothing
    private bpmHistory: number[] = [];
    private historySize: number = 10;
    private currentBPM: number = 0;

    // Low-pass filter coefficients for beat detection
    private energyHistory: number[] = [];
    private energyHistorySize: number = 43; // ~1 second at typical buffer sizes
    private decayRate: number = 0.99; // Decay rate for dynamic threshold

    constructor(sampleRate: number, bufferSize: number) {
        this.sampleRate = sampleRate;
        this.bufferSize = bufferSize;
    }

    addData(data: Uint8Array): number {
        // Calculate energy in this buffer (sum of squares, focusing on low frequencies which carry beats)
        let energy = 0;
        const lowFreqCutoff = Math.min(40, Math.floor(data.length / 4)); // Focus on lower frequencies

        for (let i = 0; i < lowFreqCutoff; i++) {
            // Convert from 0-255 to -1.0 to 1.0
            const amplitude = (data[i] / 128.0) - 1.0;
            energy += amplitude * amplitude;
        }
        energy = energy / lowFreqCutoff;

        // Update energy history for dynamic threshold
        this.recentEnergies.push(energy);
        if (this.recentEnergies.length > this.energyHistorySize) {
            this.recentEnergies.shift();
        }

        // Calculate dynamic threshold with bias toward recent history
        // Sort energies to find the median-ish level (60th percentile)
        const sortedEnergies = [...this.recentEnergies].sort((a, b) => a - b);
        const medianEnergy = sortedEnergies[Math.floor(sortedEnergies.length * 0.6)];

        // Dynamic threshold: decay previous threshold and mix with current median
        if (this.energyHistory.length === 0) {
            this.energyThreshold = medianEnergy * 1.5; // Initial threshold
        } else {
            this.energyThreshold = this.energyThreshold * this.decayRate + medianEnergy * 1.5 * (1 - this.decayRate);
        }

        // Add to energy history
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.energyHistorySize) {
            this.energyHistory.shift();
        }

        // Increment time
        const bufferDuration = this.bufferSize / this.sampleRate;
        this.currentTime += bufferDuration;

        // Check for beat - current energy > threshold AND time since last beat is reasonable
        const timeSinceLastBeat = this.currentTime - this.lastPeakTime;
        if (energy > this.energyThreshold && timeSinceLastBeat > this.minInterBeatInterval) {
            this.beatTimes.push(this.currentTime);
            this.lastPeakTime = this.currentTime;

            // Keep a reasonable history size
            if (this.beatTimes.length > 24) { // Store about 6 seconds of beats at 120 BPM
                this.beatTimes.shift();
            }

            // Calculate and update BPM
            this.updateBPM();
        }

        return this.currentBPM;
    }

    private updateBPM(): number {
        if (this.beatTimes.length < 4) {
            return 0; // Not enough beats to calculate accurate BPM
        }

        // Calculate intervals between beats
        const intervals: number[] = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
            intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }

        // Filter out outliers (intervals that are significantly different from others)
        const validIntervals = this.filterOutliers(intervals);

        if (validIntervals.length < 2) {
            return this.currentBPM; // Not enough valid intervals
        }

        // Calculate BPM from average interval
        const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
        const instantBPM = Math.round(60 / avgInterval);

        // Constrain BPM to reasonable range (40-220 BPM)
        const constrainedBPM = Math.max(60, Math.min(220, instantBPM));

        // Add to history and calculate moving average for stability
        this.bpmHistory.push(constrainedBPM);
        if (this.bpmHistory.length > this.historySize) {
            this.bpmHistory.shift();
        }

        // weight recent values more heavily using a decay factor
        let weightedSum = 0;
        let weightSum = 0;
        const decayFactor = 0.85;

        for (let i = this.bpmHistory.length - 1, weight = 1; i >= 0; i--, weight *= decayFactor) {
            weightedSum += this.bpmHistory[i] * weight;
            weightSum += weight;
        }

        this.currentBPM = Math.round(weightedSum / weightSum);
        return this.currentBPM;
    }

    /**
     * Filter out intervals that are significantly different from the median
     */
    private filterOutliers(intervals: number[]): number[] {
        if (intervals.length <= 3) return intervals;

        const sortedIntervals = [...intervals].sort((a, b) => a - b);
        const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

        // filter out if differs from median by more than 25%
        return intervals.filter(interval => {
            const difference = Math.abs(interval - medianInterval) / medianInterval;
            return difference <= 0.25;
        });
    }
} 