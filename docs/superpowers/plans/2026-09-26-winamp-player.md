# Winamp-Style Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (superpowers:test-driven-development for every pure function and engine change). Steps use checkbox (`- [ ]`) syntax for tracking. Project skills that apply: `create-animation`, `tune-animation`, `audio-analysis`, and `sync-claude-config` (Task 7).

**Goal:** Replace the top-left transport bar and record crate with a proper music player. It shows each song's title, artist, album and artwork, lets you browse and play the playlist, and has a frequency visualiser. The look is a 2000s Winamp homage with three skins you can cycle through. It sits just above the social links on desktop and slides out from a side tab on mobile. Also remove the song "etaki".

**Architecture:**
- **Track metadata** (artist, album, year, artwork) becomes part of each bundled `TrackSource` in `src/audio/tracks.ts`, with the artwork downloaded once and committed to `src/assets/artwork/`.
- **The engine** gains the few operations a player needs: `previous()`, `stop()`, `setVolume()`, the current track's `duration` in `EngineState`, and read-only spectrum/waveform readers for the visualiser.
- **The player** (`src/components/Player/`) is one component tree: a main window (title bar, artwork, LCD time, scrolling marquee, visualiser, seek and volume sliders, transport buttons) plus a playlist window.
  - Per-frame work (time display, seek position, visualiser canvas) goes through `useMusicFrame` + `setStyle`/canvas. React only re-renders on coarse state (track, play state, skin, open/closed, playlist).
  - Skins are sets of CSS custom properties plus small per-skin styled variations. Everything is drawn with CSS/SVG/canvas: no Nullsoft skin bitmaps are copied; it's an homage.
- **The Transport bar and Crate are deleted.** Their jobs (play/pause/next/mute, picking a track, the jam-pad toggle, and the global Space / M / A S D F keys) move into the player. The keys move into a headless keyboard hook that keeps working when the player is collapsed.

**Tech Stack:** React 18, TypeScript (strict), styled-components 6, Canvas 2D, Web Audio `AnalyserNode`, Vitest.

**Spec:** the owner's request (2026-09-26, pre-approved; the owner answered the open questions):
> "I want a music player that actually shows the track title, album, artist and album artwork, and you can scroll through / go next etc.: basically an interface for the bar we have in the top left at the moment. It should sit just on top of the social icons bar. For mobile, there should be a tab button on the side that, on press, has the player come out, and then it can be put back in again. The player should go for a very 2000s Winamp skin kind of look, with a frequency visualiser. Implement 3 skins that the user can cycle through. Also make sure to fetch the album artworks/music metadata for each song. Also remove the etaki song."

Owner answers: the player **replaces** the top-left bar (and the crate). `void.mp3` and `in-my-mind.mp3` are DJ Worm tracks, whose Spotify links the owner gave; metadata below.

## Track metadata (verified; use exactly)

Durations were matched against the files to within 0.4 s, except "expression on your face", whose file is a shorter edit identified by its ID3 tags.

| id | title | artist | album | year | artwork source (download once) |
|---|---|---|---|---|---|
| empty-lightning | Empty Lightning (feat. Oklou) | Woesum | Blue Summer | 2021 | `https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/01/72/3d/01723d0a-a4a1-a668-7ed8-1f05e1b97969/artwork.jpg/600x600bb.jpg` |
| bend-tiesto | Bend It Like You Don't Care | Tiësto | Kaleidoscope | 2009 | `https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ac/ec/66/acec66a8-1fbd-1ead-7d23-7f1f93c48dc7/190295449490.jpg/600x600bb.jpg` |
| expression-on-your-face | Expression On Your Face | Mechatok, Ecco2k & Bladee | Expression On Your Face (Single) | 2025 | `https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/56/c8/32/56c83231-2e61-15cf-420f-a0e1bf71b897/889030043047.png/600x600bb.jpg` |
| generate-utopia | Generate Utopia | death's dynamic shroud & Galen Tipton | You Like Music | 2024 | `https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e7/1e/70/e71e7059-9d82-5124-cc85-d182d22cb900/797885144935_cover.jpg/600x600bb.jpg` |
| void | Void ///////(d) [u] [m] | DJ Worm, jamesjamesjames & Eurohead | SWEEDISH Open 2025 ***sthlm city i lågor*** | 2025 | `https://i.scdn.co/image/ab67616d0000b273ed25a1eda491a275ada07dff` |
| in-my-mind | In My Mind | DJ Worm, Eurohead & SPÖKE | In My Heart / In My Mind | 2024 | `https://i.scdn.co/image/ab67616d0000b273b0dbe5cdee230af2f14fa97b` |
| i-still-see-you | I Still See You | Himera & Nora Korra | Now I Know What Dreams Are Made Of | 2025 | `https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4b/bf/a9/4bbfa9ec-d976-6f93-4da6-d87b8a1ab6e6/5050580865167.png/600x600bb.jpg` |

## Global Constraints

- **Placement:**
  - **Desktop:** fixed bottom-right, right-aligned with the social links dock and sitting just above it. The dock is 16 px from the right and bottom and 48 px tall, so the player's bottom edge is about 76 px, with a 12 px gap. `z-index: 20`, the same as the old transport: above the glass (9) and the head canvas (10), below MusicDebug (90) and Splash (100). It must not cover the name header.
  - **Mobile** (`max-width: 600px`, or `pointer: coarse` with a narrow viewport): the player is tucked off-screen at the right edge. A tab stays visible on the right side at mid-height, not colliding with the link dock. Pressing the tab slides the player out; pressing it again, a close button, or Esc slides it back. `aria-expanded` and `aria-controls` go on the tab.
  - Reduced motion: the slide is instant.
- **Replacement:**
  - Delete `src/components/Transport/*` and `src/components/Crate/*`.
  - Keep `src/components/DjPad`: its toggle becomes a "JAM" button in the player. Keep the pad's own position, or adjust it only if the player now overlaps it.
  - Keep the pure key logic (`transportKeyAction`, `djKeyVoice`, `padKeyHits`) and its tests, moved to `src/components/Player/keys.ts` (update `DjPad`'s import). Mount a headless `useGlobalKeys()` in the player so Space, M and A S D F behave exactly as today, including when the player is collapsed on mobile.
- **Metadata and artwork:**
  - Artwork is committed under `src/assets/artwork/<id>.jpg`, downscaled to 300×300 (`sips -Z 300 -s format jpeg`) to keep the bundle small. Each image carries a source comment in `tracks.ts`.
  - There are no runtime network calls: the site stays static.
  - Titles shown are the full titles in the table above.
- **Remove etaki:**
  - Delete `src/assets/audio/etaki.mp3`, `src/audio/beatmaps/etaki.json` and its `tracks.ts` entry.
  - In `scripts/analyzeTrack.real.test.ts`, remove the etaki `REFERENCE` row and the "30 s clips" etaki test. The portable synthetic test "hears a dotted groove at its beat, not the 3:2 kick pulse" in `src/audio/analysis/analyzeTrack.test.ts` still pins the 3:2 fix.
  - Leave the historical calibration comments in `analyzeTrack.ts` as they are.
- **Skins:** three skins, cycled from a title-bar button (and the `S` key is **not** used; keep keys as today). The choice is remembered in `localStorage` under `player.skin`. All three share the same layout and differ in look only:
  1. **"base"**: a Winamp 2.x homage. Gunmetal beveled chrome, black LCD with green segment digits, a green→yellow→red analyser gradient with grey peak caps, and small beveled grey buttons.
  2. **"chrome"**: Y2K brushed silver and aqua (Winamp 3 / WMP 9 / iTunes Aqua era). Glossy pill buttons, an ice-blue LCD, and a cyan analyser.
  3. **"faizaan"**: the site's own. Deep green body (`rgb(20, 61, 50)` family), a Doto dot-matrix LCD in `#8AB1EE`, copper/orange accents echoing the head, and pixel bevels.
- **Visualiser:** a canvas analyser with ~19–24 log-spaced bars and falling peak caps (Winamp-style), drawn per frame. Clicking it toggles oscilloscope mode, as in Winamp. It's driven by the engine's analyser via `readSpectrum`/`readWaveform`, not by `frame.bands`. It's flat when paused, and still moves when jamming (DJ hits go through the analyser).
- **Performance:**
  - Per-frame JS for the whole player is ≤ 1 ms p95.
  - The LCD time text updates only when the displayed second changes.
  - No React state per frame, and no second rAF loop.
- **Accessibility:**
  - Every control is a real `<button>` or `<input type="range">` with a label (e.g. "Previous track", "Seek", "Volume").
  - The playlist is a `role="listbox"` with options, `aria-selected` on the current track, and keyboard navigation: arrows move, Enter plays.
  - The marquee is decorative (`aria-hidden`), with a visually hidden "Now playing: title by artist" (polite live region, updated per track only).
  - Visible `:focus-visible` rings in every skin.
- **Ownership:** this is the only worker, so you may edit anything needed, including `CLAUDE.md`/`.claude` in Task 7 via the `sync-claude-config` skill. Don't push or merge.
- **Dev server** for browser checks: `yarn dev --port 5198 --strictPort`. `?debug` exposes `window.__music`.

## Review Focus

1. **Global keys still work with the transport gone:** Space toggles play/pause (and resumes after an interruption), M mutes, A S D F hit (not while typing), including with the mobile drawer closed. Covered by the existing `keys.ts` tests plus a Task 5 browser check.
2. **Seek and the LCD across a track switch:** picking another track resets the time and seek bar to 0 and the marquee to the new title, with no stale duration from the previous track. Tested in Task 2 (`duration` in state) and checked in the browser in Task 5.
3. **Narrow screens:** at 390×844 the drawer opens and closes, never covers the link dock tab targets, and everything inside is reachable. Browser check in Task 6.
4. **Artwork missing or failing to load:** the player shows a skin-styled placeholder (initials), not a broken image. Covered by a component test or a browser check forcing a bad URL.
5. **Volume and mute interplay:** mute (M or button) silences without losing the volume, and unmuting restores it. Tested in Task 2.

---

### Task 1: Remove etaki; add metadata and artwork

**Files:**
- Delete: `src/assets/audio/etaki.mp3`, `src/audio/beatmaps/etaki.json`
- Modify: `src/audio/tracks.ts`, `src/audio/tracks.test.ts`, `src/audio/types.ts` (`TrackSource` and `TrackInfo` gain `artist: string; album: string; year: number; artwork: string`), `src/audio/MusicEngine.ts` (`tracks` in state carries the new `TrackInfo` fields), `scripts/analyzeTrack.real.test.ts`
- Create: `src/assets/artwork/*.jpg` (7 files)

- [ ] **Step 1: Write the failing tests.** In `tracks.test.ts`:
  - every track has a non-empty title, artist and album, a 4-digit year and an artwork URL;
  - there is no `etaki` id;
  - `TRACKS.map(t => t.id)` equals the seven ids in the table, in the table's order (the playlist order);
  - the existing "lists every song in src/assets/audio once" test keeps passing after the mp3 is deleted.
- [ ] **Step 2: Run to see it fail, then implement.** Download the artwork (curl, then `sips -Z 300 -s format jpeg`), fill in the metadata, delete the etaki files and edit the real test. Run `yarn test` to see it pass.
- [ ] **Step 3: Commit.** `git commit -m "feat(tracks): artist, album, year and artwork for every song; remove etaki"`

### Task 2: Engine operations for a player

**Files:** `src/audio/MusicEngine.ts`, `src/audio/MusicEngine.test.ts`, `src/audio/types.ts`, `src/audio/testing/fakeAudio.ts` (add `getFloatTimeDomainData` to the fake analyser)

**Interfaces (produce exactly):**
- `previous(): void`: if more than 3 s into the track, restart it; otherwise go to the previous track, wrapping around. Keeps playing if it was playing.
- `stop(): void`: pause and return to 0.
- `setVolume(v: number): void`: clamp to 0..1, with a 10 ms ramp like mute. `EngineState.volume: number` (default 1). Mute multiplies with volume, so unmuting restores the volume.
- `EngineState.duration: number | null`: the current track's duration, once decoded (or from its beat map). `null` while unknown, and reset on track switch.
- `readSpectrum(out: Float32Array): boolean`: fills `out.length` log-spaced bars (40 Hz – 16 kHz) as 0..1 levels. Map dB linearly from −90 to −20, clamped: this is a display analyser, and Winamp's also clipped. Returns false (and zero-fills) when there's no analyser or nothing is playing or jamming.
- `readWaveform(out: Float32Array): boolean`: time-domain samples −1..1, resampled to `out.length`. False (and zero-fills) as above.

- [ ] **Step 1: Write failing tests for each operation.** Examples:
  - `previous` at 5 s restarts at 0; at 1 s it goes back one track, wrapping from the first to the last;
  - `stop` leaves `isPlaying` false and `seek` at 0;
  - `setVolume(0.5)` then mute then unmute restores the gain to 0.5;
  - `duration` appears after preload and is null right after switching to an undecoded track;
  - `readSpectrum` returns false and zeros when paused, and levels in 0..1 when playing with the fake analyser.
- [ ] **Step 2: Run (FAIL), implement, run (PASS), run `yarn test`, then commit.** `git commit -m "feat(engine): previous, stop, volume, duration and spectrum/waveform readers for the player"`

### Task 3: Player maths (pure)

**Files:** `src/components/Player/format.ts` (+ test), `src/components/Player/analyser.ts` (+ test), `src/components/Player/skins.ts` (+ test)

**Interfaces:**
- `formatTime(seconds: number, remaining?: { duration: number }): string` → `"3:07"` or `"-1:12"`. Handles NaN or negative input as `"0:00"`.
- `marqueeText(track: TrackInfo): string` → `"Artist - Title (Album, Year) *** "` (a Winamp-style separator for the loop).
- `stepPeaks(levels: Float32Array, peaks: Float32Array, dt: number): void`: peak caps jump up instantly and fall at a constant rate (e.g. 1.2 levels/s after a 0.25 s hold). Frame-rate independent (test at 60 vs 120 Hz).
- `SKINS: readonly Skin[]` (3 entries, ids `base`, `chrome`, `faizaan`), `nextSkin(id): SkinId` (cycles), and `loadSkin(storage)`/`saveSkin(storage, id)` (tolerant of missing or garbage values → `base`).

- [ ] **Step 1:** Write the failing tests for all of the above.
- [ ] **Step 2:** Run (FAIL), implement, run (PASS), then commit. `git commit -m "feat(player): time, marquee, peak-cap and skin helpers"`

### Task 4: The player

**Files:** `src/components/Player/index.tsx`, `Player.styled.ts`, `Visualiser.tsx`, `Playlist.tsx`, `keys.ts` + `keys.test.ts` (moved from Transport), `useGlobalKeys.ts`; modify `src/App.tsx` (swap `<Transport />` for `<Player />`) and `src/components/DjPad/index.tsx` (the import path); delete `src/components/Transport/`, `src/components/Crate/`

- [ ] **Step 1: Build the main window.** From top to bottom:
  - **Title bar:** a small logo mark, the text `faizaan.tech — <skin name>`, a skin-cycle button, and a windowshade toggle. On desktop, the windowshade collapses to a thin bar with a mini marquee and a mini visualiser, as in Winamp; double-clicking the title bar also toggles it.
  - **Body:** artwork (≈ 72–96 px) on the left, with the LCD next to it:
    - elapsed time in large segment/dot digits (click to toggle remaining time);
    - the scrolling marquee;
    - small `kHz` / `stereo` indicators, which must be truthful: show the AudioContext sample rate; omit kbps unless it's computed honestly.
  - **Visualiser** (canvas).
  - **Seek slider**, then the **button row:** prev, play, pause, stop, next, mute, JAM (toggles the DjPad), PL (toggles the playlist). Then the volume slider.
  - **Playlist window** below or attached: `N. Artist - Title  m:ss` rows, the current row highlighted, scrollable with the mouse wheel. Click, or Enter on a focused row, plays it (`engine.unlock(); engine.select(id)`), and picking plays even when paused (existing `select` semantics).
- [ ] **Step 2: Build the skins.** Each skin is visually distinct and polished; iterate in the browser with screenshots. It should feel like 2003, but crisp at 2× DPR.
- [ ] **Step 3: Wire the per-frame work.**
  - `useMusicFrame` drives the visualiser canvas, the LCD digits (when the second changes), the seek position (while not dragging), and the marquee offset (a slow pixel scroll, ~30 px/s; paused under reduced motion).
  - Everything else is React state from `useMusicState()`.
- [ ] **Step 4: Global keys.** Move the key logic and tests to `Player/keys.ts`, and wire `useGlobalKeys()` so behaviour is identical to the old Transport (read `git show v2:src/components/Transport/index.tsx`).
- [ ] **Step 5: Run all checks and commit.** Run `yarn test`, `yarn lint` and `yarn build`, then `git commit -m "feat(player): a Winamp-style player with three skins replaces the transport and crate"`

### Task 5: Browser verification (desktop)

- [ ] Screenshots at 1440×900:
  - each of the three skins, playing mid-drop, with the visualiser moving;
  - the oscilloscope mode;
  - windowshade mode;
  - the playlist, with the current song highlighted.
- [ ] Behaviour checks:
  - The metadata and artwork are correct for every song: cycle through all seven with next, and check `previous` at < 3 s and > 3 s.
  - Seek-dragging works, and the LCD resets on track switch.
  - Space, M and A S D F work, and the JAM button opens the pad.
  - The skin persists across a reload.
  - A forced bad artwork URL shows the placeholder.
- [ ] Clicks: `elementFromPoint` at the player's controls returns them, even with glass or the head behind. The player doesn't overlap the link dock or the name header.
- [ ] Performance: the player's per-frame cost, p95 over 600 frames (≤ 1 ms).
- [ ] Console: 0 errors.

### Task 6: Mobile

- [ ] At 390×844 with touch and hover: none:
  - the tab is visible at the right edge, mid-height;
  - pressing it slides the drawer out (screenshot) and pressing again tucks it back;
  - Esc closes it;
  - `aria-expanded` toggles;
  - controls inside are ≥ 44 px targets where practical (Winamp is tiny; scale the mobile drawer up);
  - the playlist scrolls by touch.
- [ ] Reduced motion: the drawer opens and closes instantly.

### Task 7: Docs

- [ ] Run the `sync-claude-config` skill. Update `CLAUDE.md` and `.claude/` to cover:
  - the Player replacing Transport/Crate, and the keys moving;
  - the new engine operations;
  - track metadata and artwork;
  - the z-index table;
  - how to add a song, which now also needs metadata + artwork.
- [ ] Commit. `git commit -m "docs: sync Claude config for the player"`

## Acceptance (report with evidence)
- Tests, lint and build are green, with counts.
- Screenshots from Tasks 5 and 6, described.
- Metadata and artwork checks per song.
- Key, click-through and accessibility checks.
- Per-frame cost.
- Every `Ruling:` line.
