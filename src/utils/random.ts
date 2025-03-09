export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const clampedRandom = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};
