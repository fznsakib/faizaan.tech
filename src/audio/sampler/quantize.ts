/** Song time of the next 16th-note grid point at least `lead` seconds after `songTime`. */
export function nextSixteenth(songTime: number, beat0: number, bpm: number, lead = 0.01): number {
  const step = 60 / bpm / 4;
  return beat0 + Math.ceil((songTime + lead - beat0) / step - 1e-9) * step;
}
