/**
 * Calculate RMS (Root Mean Square) of frequency data
 * RMS provides a better measure of signal intensity than simple averaging
 */
export function calculateRMS(frequencyData: number[]): number {
  if (frequencyData.length === 0) return 0;

  const sumSquares = frequencyData.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumSquares / frequencyData.length);
}

/**
 * Normalize RMS value to 0-1 range
 * Assumes max value is ~255 from byte frequency data
 */
export function normalizeRMS(rms: number, maxValue: number = 255): number {
  return Math.min(rms / maxValue, 1);
}

/**
 * Calculate RMS intensity for multiple frequency bins combined
 */
export function calculateCombinedRMS(
  frequencyBins: Record<string, number[]>,
  binNames: string[]
): number {
  const allData = binNames.flatMap((name) => frequencyBins[name] || []);
  const rms = calculateRMS(allData);
  return normalizeRMS(rms);
}
