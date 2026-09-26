import * as Styled from "./DjPad.styled";
import { engine } from "../../audio/engine";

import type { Voice } from "../../audio/types";

const PADS: { voice: Voice; key: string; label: string }[] = [
  { voice: "kick", key: "a", label: "Kick" },
  { voice: "snare", key: "s", label: "Snare" },
  { voice: "hat", key: "d", label: "Hat" },
  { voice: "stab", key: "f", label: "Stab" },
];

/** On-screen DJ pad (touch and discoverability): the same voices as keys A S D F. */
const DjPad: React.FC = () => (
  <Styled.Pad role="group" aria-label="Jam pad">
    {PADS.map((pad) => (
      <Styled.PadButton
        key={pad.voice}
        type="button"
        aria-label={`${pad.label} (${pad.key.toUpperCase()})`}
        onPointerDown={(event) => {
          event.preventDefault(); // no focus, and pointer presses play here rather than on click
          engine.hit(pad.voice, event.timeStamp);
        }}
        onClick={(event) => {
          if (event.detail === 0) engine.hit(pad.voice); // keyboard activation only
        }}
      >
        <Styled.Key>{pad.key}</Styled.Key> {pad.label.toLowerCase()}
      </Styled.PadButton>
    ))}
  </Styled.Pad>
);

export default DjPad;
