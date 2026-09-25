import { useEffect, useRef, useState } from "react";

import * as Styled from "./MusicDebug.styled";
import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";

import type { MusicFrame } from "../../audio/types";

const METERS = ["kick", "snare", "hat", "energy", "section"] as const;
const LOOKAHEAD = 0.2;

/** Schedules clicks on grid beats via the audio clock (1760 Hz downbeats, 880 Hz otherwise). */
function createMetronome() {
  let nextBeat: number | null = null;
  return (frame: MusicFrame) => {
    const ctx = engine.audioContext;
    const map = engine.beatMap;
    if (!ctx || !map || !frame.isPlaying) {
      nextBeat = null;
      return;
    }
    const period = 60 / map.bpm;
    const songNow = engine.songTimeAtContext(ctx.currentTime);
    const due = Math.ceil((songNow - map.beat0) / period);
    if (nextBeat === null || nextBeat < due - 1 || nextBeat > due + 2) nextBeat = due;
    while (map.beat0 + nextBeat * period < songNow + LOOKAHEAD) {
      const when = engine.contextTimeAtSong(map.beat0 + nextBeat * period);
      if (when >= ctx.currentTime) {
        const beatInBar = (((nextBeat - map.downbeatMod) % map.beatsPerBar) + map.beatsPerBar) % map.beatsPerBar;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = beatInBar === 0 ? 1760 : 880;
        gain.gain.setValueAtTime(0.4, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(when);
        oscillator.stop(when + 0.06);
      }
      nextBeat++;
    }
  };
}

/** `?debug` overlay: beat/downbeat/section lamps, envelopes, live bands, readout and a metronome. */
const MusicDebug: React.FC = () => {
  const root = useRef<HTMLDivElement>(null);
  const [metronome, setMetronome] = useState(false);
  const metronomeOn = useRef(false);
  const tickMetronome = useRef(createMetronome());

  useEffect(() => {
    metronomeOn.current = metronome;
  }, [metronome]);

  useEffect(() => {
    (window as Window & { __music?: typeof engine }).__music = engine;
  }, []);

  useMusicFrame((frame) => {
    const panel = root.current;
    if (!panel) return;
    const el = (key: string) => panel.querySelector<HTMLElement>(`[data-k="${key}"]`);
    const set = (key: string, property: "opacity" | "transform", value: string) => {
      const node = el(key);
      if (node) node.style[property] = value;
    };
    const on = frame.isPlaying;
    set("beat", "opacity", String(on ? (1 - frame.beatPhase) ** 3 : 0));
    set("bar", "opacity", String(on ? (1 - frame.barPhase) ** 4 : 0));
    set("drop", "opacity", frame.sectionLevel ? "1" : "0.15");
    for (const key of METERS) set(key, "transform", `scaleX(${frame[key]})`);
    frame.bands.forEach((value, i) => set(`band${i}`, "transform", `scaleY(${value})`));
    const readout = el("readout");
    if (readout) {
      readout.textContent =
        `t=${frame.time.toFixed(3)} bpm=${frame.bpm.toFixed(2)} beat=${frame.beatIndex} ` +
        `bar=${frame.barIndex}.${Math.floor(frame.barPhase * 4) + 1}\n` +
        `sec=${frame.section.toFixed(2)} lvl=${frame.sectionLevel} conf=${frame.beatConfidence}`;
    }
    if (metronomeOn.current) tickMetronome.current(frame);
  });

  return (
    <Styled.Panel ref={root}>
      <Styled.Row>
        <Styled.Lamp data-k="beat" $color="#ffffff" title="beat" />
        <Styled.Lamp data-k="bar" $color="#ff8a00" title="downbeat" />
        <Styled.Lamp data-k="drop" $color="#ff4fd8" title="section level" />
      </Styled.Row>
      {METERS.map((key) => (
        <Styled.Meter key={key}>
          <span>{key}</span>
          <Styled.Track>
            <Styled.Fill data-k={key} />
          </Styled.Track>
        </Styled.Meter>
      ))}
      <Styled.Bands>
        {Array.from({ length: 6 }, (_, i) => (
          <Styled.Band key={i} data-k={`band${i}`} />
        ))}
      </Styled.Bands>
      <Styled.Readout data-k="readout" />
      <label>
        <input type="checkbox" checked={metronome} onChange={(event) => setMetronome(event.target.checked)} />{" "}
        metronome
      </label>
    </Styled.Panel>
  );
};

export default MusicDebug;
