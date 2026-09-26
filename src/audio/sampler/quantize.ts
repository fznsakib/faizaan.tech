/** Song time of the 16th-note grid point closest to `songTime`. */
export function nearestSixteenth(songTime: number, beat0: number, bpm: number): number {
  const step = 60 / bpm / 4;
  return beat0 + Math.round((songTime - beat0) / step) * step;
}
