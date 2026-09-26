import { useEffect } from "react";

import * as Styled from "./Crate.styled";
import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";

const initials = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

interface CrateProps {
  onClose: () => void;
}

/** The record crate: one sleeve per track; picking one switches the song that drives the page. Esc closes. */
const Crate: React.FC<CrateProps> = ({ onClose }) => {
  const { tracks, track: current } = useMusicState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <Styled.Crate id="crate" role="group" aria-label="Record crate">
      {tracks.map((track) => (
        <Styled.Record key={track.id}>
          <Styled.Sleeve
            type="button"
            aria-label={`Play ${track.title}`}
            aria-current={track.id === current ? "true" : undefined}
            $current={track.id === current}
            onClick={() => {
              engine.unlock();
              engine.select(track.id);
            }}
          >
            {track.artwork ? <Styled.Art src={track.artwork} alt="" /> : <Styled.Initials>{initials(track.title)}</Styled.Initials>}
          </Styled.Sleeve>
          {track.credit && (
            <Styled.Credit href={track.credit.url} target="_blank" rel="noopener noreferrer">
              {track.credit.label}
            </Styled.Credit>
          )}
        </Styled.Record>
      ))}
    </Styled.Crate>
  );
};

export default Crate;
