import { useEffect, useMemo, useRef } from "react";

import { stepBars, stepPeaks } from "./analyser";
import { endCost, startCost } from "./cost";
import { geometry, Painter, visWidth } from "./paint";
import * as Styled from "./Player.styled";
import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";
import { keepFocus } from "../keepFocus";

import type { VisVariant } from "./paint";
import type { SkinId } from "./skins";

export type VisMode = "bars" | "scope";

const MAX_DPR = 2;

interface VisualiserProps {
  skin: SkinId;
  variant: VisVariant;
  mode: VisMode;
  onToggleMode?: () => void;
}

const peakOf = (values: Float32Array) => values.reduce((max, v) => (v > max ? v : max), 0);

/**
 * Winamp-style analyser (log-spaced bars with falling peak caps) or oscilloscope, from the engine's live analyser.
 * Drawn from the shared music ticker; once silent and settled it stops redrawing until sound returns.
 */
const Visualiser: React.FC<VisualiserProps> = ({ skin, variant, mode, onToggleMode }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useMemo(() => geometry(skin, variant), [skin, variant]);
  const buffers = useMemo(
    () => ({
      levels: new Float32Array(g.bars),
      shown: new Float32Array(g.bars),
      peaks: new Float32Array(g.bars),
      holds: new Float32Array(g.bars),
      wave: new Float32Array(g.cols),
    }),
    [g]
  );
  const painter = useRef<Painter | null>(null);
  /** The last drawn frame was silent and settled: nothing to draw until sound returns. */
  const idle = useRef(false);
  const lastNow = useRef(0);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let dpr = 0;
    const setup = () => {
      const next = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (next === dpr) return;
      dpr = next;
      const p = new Painter(ctx, skin, g, dpr);
      el.width = p.width;
      el.height = p.height;
      painter.current = p;
      idle.current = false;
    };
    setup();
    window.addEventListener("resize", setup);
    return () => {
      window.removeEventListener("resize", setup);
      painter.current = null;
    };
  }, [skin, g]);

  useEffect(() => {
    idle.current = false;
  }, [mode]);

  useMusicFrame((_, now) => {
    const started = startCost();
    const p = painter.current;
    if (!p) return;
    const dt = lastNow.current ? Math.min(0.1, (now - lastNow.current) / 1000) : 0;
    lastNow.current = now;
    const { levels, shown, peaks, holds, wave } = buffers;
    if (mode === "scope") {
      const live = engine.readWaveform(wave);
      if (live || !idle.current) p.scope(wave);
      idle.current = !live;
    } else {
      const live = engine.readSpectrum(levels);
      stepBars(levels, shown, dt);
      stepPeaks(shown, peaks, holds, dt);
      const settled = !live && peakOf(shown) === 0 && peakOf(peaks) === 0;
      if (!settled || !idle.current) p.bars(shown, peaks);
      idle.current = settled;
    }
    endCost(now, started);
  });

  const style = { width: visWidth(g), height: g.height };
  if (variant === "mini") {
    return (
      <Styled.MiniVis aria-hidden="true">
        <canvas ref={canvas} style={style} />
      </Styled.MiniVis>
    );
  }
  return (
    <Styled.Vis
      type="button"
      aria-label="Oscilloscope"
      aria-pressed={mode === "scope"}
      title={mode === "scope" ? "Show the spectrum" : "Show the oscilloscope"}
      onMouseDown={keepFocus}
      onClick={onToggleMode}
    >
      <canvas ref={canvas} style={style} />
    </Styled.Vis>
  );
};

export default Visualiser;
