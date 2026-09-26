import { useEffect, useRef, useState } from "react";

import { formatTime } from "./format";
import * as Styled from "./Player.styled";

import type { TrackInfo } from "../../audio/types";

interface PlaylistProps {
  id: string;
  tracks: readonly TrackInfo[];
  current: string | null;
  onPlay: (id: string) => void;
}

const optionId = (track: TrackInfo) => `playlist-${track.id}`;

/**
 * The playlist window: `N. Artist - Title  m:ss`, the playing track selected. A listbox with a keyboard cursor
 * (arrows, Home/End move it; Enter plays); a click plays the row. Scrolls with the wheel or by touch.
 */
const Playlist: React.FC<PlaylistProps> = ({ id, tracks, current, onPlay }) => {
  const currentIndex = Math.max(
    0,
    tracks.findIndex((track) => track.id === current)
  );
  const [cursor, setCursor] = useState(currentIndex);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setCursor(currentIndex); // the cursor follows the song as it changes
  }, [currentIndex]);

  useEffect(() => {
    // keep the cursor row in view, scrolling only the list (never the page)
    const el = list.current;
    const row = el?.children[cursor] as HTMLElement | undefined;
    if (!el || !row) return;
    if (row.offsetTop < el.scrollTop) el.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > el.scrollTop + el.clientHeight) {
      el.scrollTop = row.offsetTop + row.offsetHeight - el.clientHeight;
    }
  }, [cursor]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = tracks.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, cursor + 1),
      ArrowUp: Math.max(0, cursor - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setCursor(moves[event.key]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onPlay(tracks[cursor].id);
    }
  };

  return (
    <Styled.PlaylistWindow>
      <Styled.TitleBar $small aria-hidden="true">
        <Styled.Ridges />
        <Styled.Title>playlist</Styled.Title>
        <Styled.Ridges />
      </Styled.TitleBar>
      <Styled.List
        ref={list}
        id={id}
        role="listbox"
        aria-label="Playlist"
        tabIndex={0}
        aria-activedescendant={optionId(tracks[cursor])}
        onKeyDown={onKeyDown}
      >
        {tracks.map((track, index) => (
          <Styled.Row
            key={track.id}
            id={optionId(track)}
            role="option"
            aria-selected={track.id === current}
            $cursor={index === cursor}
            onClick={() => {
              setCursor(index);
              onPlay(track.id);
            }}
          >
            <Styled.RowText>
              {index + 1}. {track.artist} - {track.title}
            </Styled.RowText>
            <Styled.RowTime>{formatTime(track.duration)}</Styled.RowTime>
          </Styled.Row>
        ))}
      </Styled.List>
    </Styled.PlaylistWindow>
  );
};

export default Playlist;
