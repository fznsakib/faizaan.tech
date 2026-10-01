import * as Styled from "./NameHeader.styled";

import type { LetterPieces, LetterPlan } from "./pieces";

/** A square piece centred on (x, y) of the letter box, `size` em across. */
const centred = (x: number, y: number, size: number): React.CSSProperties => ({
  left: `${(x * 100).toFixed(1)}%`,
  top: `${(y * 100).toFixed(1)}%`,
  width: `${size.toFixed(3)}em`,
  height: `${size.toFixed(3)}em`,
  marginLeft: `${(-size / 2).toFixed(3)}em`,
  marginTop: `${(-size / 2).toFixed(3)}em`,
});

/** One letter's material layers (bottom to top, as `MATTERS`), drips, shards and sparkles; all decorative. */
const MatterLetter: React.FC<{ letter: string; plan: LetterPlan; pieces: LetterPieces }> = ({ letter, plan, pieces }) => (
  <Styled.Matter>
    <Styled.Chrome
      ref={(el) => {
        pieces.chrome = el;
      }}
    >
      {letter}
    </Styled.Chrome>
    <Styled.Molten
      ref={(el) => {
        pieces.molten = el;
      }}
    >
      {letter}
    </Styled.Molten>
    <Styled.Shatter
      ref={(el) => {
        pieces.shatter = el;
      }}
    >
      {letter}
    </Styled.Shatter>
    <Styled.Frost
      ref={(el) => {
        pieces.frost = el;
      }}
    >
      {letter}
    </Styled.Frost>
    {plan.drips.map((drip, j) => (
      <Styled.Drip
        key={`drip${j}`}
        ref={(el) => {
          if (el) pieces.drips[j] = el;
        }}
        style={{
          left: `${(drip.x * 100).toFixed(1)}%`,
          width: `${drip.size.toFixed(3)}em`,
          height: `${(drip.size * 1.25).toFixed(3)}em`,
          marginLeft: `${(-drip.size / 2).toFixed(3)}em`,
        }}
      />
    ))}
    {plan.shards.map((shard, j) => (
      <Styled.Shard
        key={`shard${j}`}
        $blue={shard.blue}
        ref={(el) => {
          if (el) pieces.shards[j] = el;
        }}
        style={centred(shard.x, shard.y, shard.size)}
      />
    ))}
    {plan.sparkles.map((sparkle, j) => (
      <Styled.Sparkle
        key={`sparkle${j}`}
        ref={(el) => {
          if (el) pieces.sparkles[j] = el;
        }}
        style={centred(sparkle.x, sparkle.y, sparkle.size)}
      />
    ))}
  </Styled.Matter>
);

export default MatterLetter;
