import * as Styled from "./NameHeader.styled";

import type { LetterPieces } from "./pieces";
import type { Shard } from "../../choreography/shatter";

/** Smallest a shard gets, px: a phone's name is small, and a plus much under this reads as a speck. */
const MIN_SHARD = 10;

/** A square piece centred on (x, y) of the letter box, `size` em across (at least `MIN_SHARD` px). */
const centred = (x: number, y: number, size: number): React.CSSProperties => {
  const span = `max(${MIN_SHARD}px, ${size.toFixed(3)}em)`;
  return {
    left: `${(x * 100).toFixed(1)}%`,
    top: `${(y * 100).toFixed(1)}%`,
    width: span,
    height: span,
    marginLeft: `calc(${span} / -2)`,
    marginTop: `calc(${span} / -2)`,
  };
};

/** One letter's burst: the perforated plate and the plusses it breaks into; decorative, hidden until it bursts. */
const ShatterLetter: React.FC<{ letter: string; shards: readonly Shard[]; pieces: LetterPieces }> = ({
  letter,
  shards,
  pieces,
}) => (
  <Styled.Burst
    ref={(el) => {
      pieces.burstLayer = el;
    }}
  >
    <Styled.Plate
      data-letter={letter}
      ref={(el) => {
        pieces.plate = el;
      }}
    />
    {shards.map((shard, j) => (
      <Styled.Shard
        key={j}
        $blue={shard.blue}
        ref={(el) => {
          if (el) pieces.shards[j] = el;
        }}
        style={centred(shard.x, shard.y, shard.size)}
      />
    ))}
  </Styled.Burst>
);

export default ShatterLetter;
