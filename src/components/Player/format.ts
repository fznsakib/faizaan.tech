import type { TrackInfo } from "../../audio/types";

const clock = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const finite = (seconds: number) => (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);

/** LCD time: elapsed `m:ss`, or `-m:ss` remaining when given the duration. Bad input reads as zero. */
export function formatTime(seconds: number, remaining?: { duration: number }): string {
  if (remaining) return `-${clock(Math.max(0, finite(remaining.duration) - finite(seconds)))}`;
  return clock(finite(seconds));
}

/** The scrolling title: `Artist - Title (Album, Year) *** `, the separator making the loop seamless. */
export function marqueeText(track: TrackInfo): string {
  return `${track.artist} - ${track.title} (${track.album}, ${track.year}) *** `;
}

/** Up to two letters for the artwork placeholder: the first two words that start with a letter or digit. */
export function initials(title: string): string {
  const letters = title
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return letters || "♪";
}
