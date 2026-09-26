# Social Links Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (superpowers:test-driven-development for pure logic). Steps use checkbox (`- [ ]`) syntax for tracking. Project skills that apply: `create-animation`, `tune-animation`.

**Goal:** Replace the five big pixelated PNG icons (LinkedIn, Gmail, GitHub, Letterboxd, Strava) with a smaller, cleaner, more engaging link dock that feels part of the site's dot-matrix, music-reactive world. It needs a genuine touch equivalent, and a clean email glyph instead of the Gmail logo.

**Architecture:**
- A new `SocialLinks` component renders five inline-SVG glyphs (no raster images, no icon-font dependency).
- At rest each glyph reads as dot-matrix, e.g. the glyph masked by a dot grid in the site's blue.
- On hover or keyboard focus it resolves into the crisp solid glyph in its brand colour, leans slightly toward the pointer, and shows a small lowercase Doto label.
- It breathes with the music: a subtle scale or dot-brightness pulse on the kick, arriving from the head like the other shockwaves.
- On touch/no-hover devices the glyphs show resolved by default, with a beat-driven shimmer that ripples across the row, and one tap opens the link.
- Pure logic (glyph registry, magnet offset, resolve easing) lives in small tested modules; per-frame work goes through `useMusicFrame` + `setStyle`.

**Tech Stack:** React 18, TypeScript (strict), styled-components 6, inline SVG, Vitest.

**Spec:** the owner's request (2026-09-26, pre-approved):
> "I have these icons at the moment. They're pixelated, then unpixelate on hover. It's alright, but I think we can do WAY better: make them way more engaging, cleaner and beautiful. They're a bit big at the moment, so I don't mind if you make them smaller. There also needs to be a better equivalent for mobile, where you can't hover. And the Gmail icon looks weird: maybe get a better icon for Gmail that is square, or just a more generic email icon."

## Global Constraints

- **Links (keep the hrefs exactly):**

| Label | href | Accessible name |
|---|---|---|
| linkedin | `https://www.linkedin.com/in/faizaan-sakib/` | "LinkedIn" |
| email | `mailto:fznsakib@gmail.com` | "Email" |
| github | `https://github.com/fznsakib` | "GitHub" |
| letterboxd | `https://letterboxd.com/fznsakib/` | "Letterboxd" |
| strava | `https://strava.app.link/VhdUXhuiWRb` | "Strava" |

  Today every link's accessible name is "Pixelated icon"; fix that. External links open in a new tab with `rel="noopener noreferrer"`, as today (check the current behaviour in `src/components/PixelIcon/index.tsx`); `mailto:` opens normally.
- **Glyphs:**
  - LinkedIn, GitHub, Letterboxd and Strava come from Simple Icons (CC0, simpleicons.org). Copy the path data into a local module with a one-line source comment; add no npm dependency.
  - Email is a clean generic envelope, square-ish and drawn to match the stroke/fill weight of the others. Lucide's `mail` (ISC) is fine with attribution, or draw your own.
  - No Gmail logo.
- **Size:** smaller than today's 80 px. The glyph is ~22–28 px, and hit targets are ≥ 44×44 px (WCAG target size). The dock stays bottom-right at `z-index: 20`, above the glass (9) and the head canvas (10). At 400–500 px width it fits in one row inside the viewport, with ≥ 16 px margins, and doesn't collide with the transport or crate.
- **Touch** (`@media (hover: none)`, or `pointer: coarse`): no hover-only affordance. Glyphs are legible and resolved at rest; one tap opens the link (no double-tap gate); pressing gives immediate visual feedback.
- **Keyboard:** visible `:focus-visible` ring; focus triggers the same resolve and label as hover.
- **Reduced motion:** no magnet lean, pulses or shimmer; hover/focus resolves instantly (a colour change only).
- **Music coupling:** only through `useMusicFrame` + `setStyle` (write-on-change). No per-frame React state, and no second rAF loop. Per-frame JS ≤ 0.5 ms p95.
- **Clean up:** remove `src/components/PixelIcon/` and the five PNGs in `src/assets/` once unused (`git grep` to confirm).
- **Ownership:** don't edit `CLAUDE.md` or `.claude/`. Don't touch `src/components/Background`, `GlassPanel`, `NameHeader`, `SubtitleStack`, `src/audio/*` or `src/choreography/{faces,grid,glass}.ts`; other workers own those. In `src/App.tsx` and `src/App.styled.tsx`, change only the social-icons block. Don't push or merge.
- **Dev server** for browser checks: `yarn dev --port 5195 --strictPort`.

## Review Focus

1. **Touch devices:** emulate an iPhone (touch, hover: none). The icons read clearly and one tap navigates, without needing a hover.
2. **Keyboard:** Tab reaches each link in order with a visible focus ring and the label, and Enter opens it.
3. **Accessible names:** a screen reader hears "LinkedIn", "Email", "GitHub", "Letterboxd" and "Strava", not "Pixelated icon".
4. **Narrow viewport** (400×800): the dock fits, doesn't overlap the transport or crate, and targets are ≥ 44 px.
5. **Glass and head overlap:** with glass or the head behind the dock, every icon still receives clicks (`elementFromPoint` returns the link).

---

### Task 1: Glyph registry and link data

**Files:**
- Create: `src/components/SocialLinks/glyphs.ts` (SVG path data with a source comment per glyph), `src/components/SocialLinks/links.ts` (the table above, typed), `src/components/SocialLinks/links.test.ts`

- [ ] **Step 1: Write the failing test.** Every link has:
  - a unique label, an accessible name and an https or mailto href, exactly as in the table;
  - a glyph whose `viewBox` is square and whose path is non-empty.

  There is no Gmail glyph: assert that the email glyph's source comment isn't Gmail, or that the registry has no `gmail` key.
- [ ] **Step 2: Run it (FAIL), implement, run it (PASS), commit.** `git commit -m "feat(links): glyph registry and link data"`

### Task 2: The dock

**Files:**
- Create: `src/components/SocialLinks/index.tsx`, `SocialLinks.styled.ts`, and any small pure helper modules with tests (e.g. `magnet.ts`: pointer offset → a lean clamped to ≤ 6 px, zero outside a radius; `resolve.ts` if the resolve easing is non-trivial)
- Modify: `src/App.tsx` (replace the five `PixelIcon`s with `<SocialLinks />`), `src/App.styled.tsx` (the `SocialIconsContainer` styles, or move them into the component)
- Delete: `src/components/PixelIcon/`, `src/assets/{linkedin,gmail,github,letterboxd,strava}.png` once unused

- [ ] **Step 1: Write the pure helpers with tests first (TDD).**
- [ ] **Step 2: Build the dock.**
  - Rest: dot-matrix glyphs, e.g. an SVG `<pattern>` of dots used as a mask over the glyph, or the glyph drawn in the site blue (`#8AB1EE`) behind a dot mask.
  - Hover or focus: resolve to the crisp glyph in brand colour. LinkedIn `#0A66C2`, GitHub white (on this dark green), Letterboxd `#FF8000` / `#00E054` / `#40BCF4` (its three dots), Strava `#FC4C02`, email the site blue or white.
  - Motion: a small magnet lean toward the pointer, and a lowercase Doto label (`linkedin`, `email`, …) fading in above or beside it.
  - Music: a subtle beat pulse, e.g. dot brightness or a 3–6% scale on `frame.kick`, delayed by the icon's distance from the head at `SHOCKWAVE_SPEED` (use `KickHistory` from `src/choreography/type.ts` the way `NameHeader` does).
  - Touch: resolved at rest, a beat shimmer rippling left to right, and a press state.

  Make it beautiful; iterate in the browser.
- [ ] **Step 3: Verify in the browser.** Screenshots:
  - (a) desktop at rest;
  - (b) hovering one icon, showing the label;
  - (c) keyboard focus;
  - (d) iPhone emulation (touch + hover: none) at 390×844;
  - (e) 400×800 desktop.

  Also:
  - Tab order and Enter work.
  - The accessible names in the a11y snapshot are right.
  - `elementFromPoint` at each icon's centre returns its link, including while a glass piece or the head is behind it.
  - Per-frame JS cost: p95 over 600 frames.
- [ ] **Step 4: Run all checks and commit.** Run `yarn test`, `yarn lint` and `yarn build`, then `git commit -m "feat(links): a dot-matrix link dock that resolves on hover, focus and touch"`

## Acceptance (report with evidence)
- Tests, lint and build are green, with counts.
- Screenshots (a)–(e), described.
- Tab-order and accessible-name results.
- Click-through results.
- Per-frame cost.
- Every `Ruling:` line.
