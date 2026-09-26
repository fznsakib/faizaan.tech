/** Input range the clipper handles: the shaper is fed at 1 / CLIP_RANGE so sums up to ±2 stay on the curve. */
export const CLIP_RANGE = 2;
/** Below this level the clipper is exactly transparent. */
export const CLIP_KNEE = 0.9;

/**
 * WaveShaper curve for a zero-latency soft clipper: identity to ±CLIP_KNEE, then a tanh knee that approaches
 * but never exceeds ±1. The song peaks at 0.989, so a DJ kick on top would otherwise clip hard.
 * (No DynamicsCompressor: its lookahead would shift the audio against the visual clock.)
 */
export function softClipCurve(samples = 4097): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const headroom = 1 - CLIP_KNEE;
  for (let i = 0; i < samples; i++) {
    const x = ((i / (samples - 1)) * 2 - 1) * CLIP_RANGE;
    const level = Math.abs(x);
    curve[i] = level <= CLIP_KNEE ? x : Math.sign(x) * (CLIP_KNEE + headroom * Math.tanh((level - CLIP_KNEE) / headroom));
  }
  return curve;
}
