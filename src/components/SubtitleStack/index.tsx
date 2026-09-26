import { useMemo, useRef } from "react";

import * as Styled from "../../App.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { eqVariation, idleScanWeight, quantise, vuStep } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

const LINES: { text: string; bottom: number; width?: number }[] = [
  { text: "senior", bottom: 52, width: 20 },
  { text: "software", bottom: 42, width: 20 },
  { text: "engineer", bottom: 32, width: 20 },
  { text: "fullstack", bottom: 22 },
  { text: "london", bottom: 12 },
  { text: "affirm", bottom: 2 },
];

/** The six Doto lines: a 6-band graphic EQ while music plays (bottom = lowest band), a slow scan when idle. */
const SubtitleStack: React.FC = () => {
  const lines = useRef<HTMLHeadingElement[]>([]);
  const levels = useMemo(() => new Float32Array(LINES.length), []);
  const lastNow = useRef(0);

  useMusicFrame((frame, now) => {
    const dt = lastNow.current ? Math.min(0.1, (now - lastNow.current) / 1000) : 0;
    lastNow.current = now;
    const reduced = prefersReducedMotion();
    lines.current.forEach((line, i) => {
      const band = LINES.length - 1 - i;
      let settings: string;
      if (reduced) {
        settings = '"wght" 500, "ROND" 0';
      } else if (frame.isPlaying || frame.jamming) {
        levels[band] = vuStep(levels[band], frame.bands[band] ?? 0, dt);
        settings = eqVariation(levels[band], frame.isPlaying ? frame.section : 0);
      } else {
        levels[band] = 0;
        settings = `"wght" ${quantise(idleScanWeight(now / 1000, i), 10)}, "ROND" 0`;
      }
      setStyle(line, "fontVariationSettings", settings);
    });
  });

  return (
    <>
      {LINES.map((line, i) => (
        <Styled.SubtitleText
          key={line.text}
          $bottom={line.bottom}
          $left={2}
          $width={line.width}
          ref={(el) => {
            if (el) lines.current[i] = el;
          }}
        >
          {line.text}
        </Styled.SubtitleText>
      ))}
    </>
  );
};

export default SubtitleStack;
