import { useRef, useState } from "react";

import { GlassPanelContainer, GlassShape } from "./GlassPanel.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { generateShards, IDLE_RECUT_MS, recutDue, shardCount } from "../../choreography/shards";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { ShardSpec } from "../../choreography/shards";

/** Frosted-glass shards: hard re-cuts on downbeats (every 2 bars, every bar in a drop), every 4 s when idle. */
const GlassPanel: React.FC = () => {
  const [cut, setCut] = useState<{ generation: number; shards: ShardSpec[] }>(() => ({
    generation: 0,
    shards: generateShards(5),
  }));
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const lastRecutBar = useRef<number | null>(null);
  const lastIdleRecut = useRef<number | null>(null);

  const recut = (level: 0 | 1) =>
    setCut((previous) => ({ generation: previous.generation + 1, shards: generateShards(shardCount(level)) }));

  useMusicFrame((frame, now) => {
    const reduced = prefersReducedMotion();
    if (recutDue(frame, lastRecutBar.current, reduced)) {
      lastRecutBar.current = frame.barIndex;
      recut(frame.sectionLevel);
    } else if (!frame.isPlaying) {
      lastRecutBar.current = null;
      if (lastIdleRecut.current === null) lastIdleRecut.current = now;
      if (!reduced && now - lastIdleRecut.current >= IDLE_RECUT_MS) {
        lastIdleRecut.current = now;
        recut(0);
      }
    }
    const gain = frame.isPlaying ? 0.55 + 0.45 * frame.energy : 1;
    cut.shards.forEach((shard, i) => {
      const node = nodes.current[i];
      if (node) setStyle(node, "opacity", (shard.opacity * gain).toFixed(2));
    });
  });

  return (
    <GlassPanelContainer>
      {cut.shards.map((shard, i) => (
        <GlassShape
          key={`${cut.generation}-${shard.id}`}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          style={{
            clipPath: shard.clipPath,
            top: `${shard.top}%`,
            left: `${shard.left}%`,
            width: `${shard.width}px`,
            height: `${shard.height}px`,
            scale: String(shard.scale),
            animationDelay: `${shard.delay}s`,
            animationDuration: `${shard.duration}s`,
          }}
        />
      ))}
    </GlassPanelContainer>
  );
};

export default GlassPanel;
