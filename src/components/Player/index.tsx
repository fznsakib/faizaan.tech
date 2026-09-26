import { useCallback, useEffect, useRef, useState } from "react";

import Clock from "./Clock";
import { initials, marqueeText } from "./format";
import { CloseIcon, MarkIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, ShadeIcon, SkinIcon, StopIcon } from "./icons";
import Marquee from "./Marquee";
import * as Styled from "./Player.styled";
import Playlist from "./Playlist";
import Seek from "./Seek";
import { loadSkin, nextSkin, saveSkin, skinById } from "./skins";
import { useGlobalKeys } from "./useGlobalKeys";
import Visualiser from "./Visualiser";
import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import DjPad from "../DjPad";
import { keepFocus } from "../keepFocus";

import type { VisMode } from "./Visualiser";
import type { TrackInfo } from "../../audio/types";

/** Narrow screens get the drawer: phones (landscape ones of any width too), and touch-first tablets in portrait. */
export const DRAWER_QUERY =
  "(max-width: 600px), (pointer: coarse) and (max-width: 900px), (pointer: coarse) and (max-height: 500px)";
const DRAWER_ID = "player-drawer";
const PLAYLIST_ID = "player-playlist";

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const play = (id: string) => {
  engine.unlock();
  engine.select(id);
};

const Artwork: React.FC<{ track: TrackInfo }> = ({ track }) => {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <Styled.ArtFrame>
      {failed === track.artwork || !track.artwork ? (
        <Styled.ArtPlaceholder role="img" aria-label={`${track.album} cover`}>
          {initials(track.title)}
        </Styled.ArtPlaceholder>
      ) : (
        <Styled.Art
          key={track.artwork}
          src={track.artwork}
          alt={`${track.album} cover`}
          draggable={false}
          onError={() => setFailed(track.artwork)}
        />
      )}
    </Styled.ArtFrame>
  );
};

/**
 * The music player: a Winamp-style main window (artwork, LCD, visualiser, seek, transport, volume) over a playlist,
 * in three skins. Docked bottom-right above the links on desktop; a slide-out drawer with a tab on narrow screens.
 * Also owns the page-wide keys (Space, M, A S D F) and the jam pad toggle.
 */
const Player: React.FC = () => {
  const { status, track: currentId, tracks, bpm, isPlaying, muted, volume, duration, channels } = useMusicState();
  const drawer = useMediaQuery(DRAWER_QUERY);
  const [skin, setSkin] = useState(() => loadSkin(storage()));
  const [shaded, setShaded] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(true);
  const [padOpen, setPadOpen] = useState(false);
  const [remaining, setRemaining] = useState(false);
  const [visMode, setVisMode] = useState<VisMode>("bars");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const seekPreview = useRef<string | null>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useGlobalKeys();

  const track = tracks.find((t) => t.id === currentId) ?? tracks[0];
  const collapsed = shaded && !drawer;
  const next = skinById(nextSkin(skin));
  const sampleRate = engine.audioContext?.sampleRate;

  const closeDrawer = useCallback(() => {
    // closing with focus inside would drop it to <body>: hand it back to the tab
    if (panel.current?.contains(document.activeElement)) tab.current?.focus();
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!drawer || !drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawer, drawerOpen, closeDrawer]);

  useEffect(() => {
    // a tucked-away drawer takes no focus and isn't read out
    const el = panel.current;
    if (!el) return;
    el.inert = drawer && !drawerOpen;
  }, [drawer, drawerOpen]);

  const cycleSkin = () => {
    const id = nextSkin(skin);
    setSkin(id);
    saveSkin(storage(), id);
  };

  const title = status === "error" ? "audio can't play in this browser *** " : marqueeText(track);

  return (
    <>
      <Styled.Shell
        aria-label="Music player"
        data-skin={skin}
        data-layout={drawer ? "drawer" : "dock"}
        data-open={drawer && drawerOpen ? "" : undefined}
        style={drawer ? ({ "--drawer-width": "min(344px, calc(100vw - 52px))" } as React.CSSProperties) : undefined}
      >
        {drawer && (
          <Styled.Tab
            ref={tab}
            type="button"
            aria-expanded={drawerOpen}
            aria-controls={DRAWER_ID}
            aria-label="Music player"
            onMouseDown={keepFocus}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <MarkIcon />
            <Styled.TabLabel>player</Styled.TabLabel>
            <Styled.Lamp $on={isPlaying} />
          </Styled.Tab>
        )}
        <Styled.Stack ref={panel} id={DRAWER_ID}>
          <Styled.Window>
            <Styled.TitleBar
              onDoubleClick={(event) => {
                // the title bar's own buttons take fast clicks as clicks, not as a windowshade toggle
                if (!drawer && !(event.target as Element).closest("button")) setShaded((s) => !s);
              }}
            >
              <Styled.Mark aria-hidden="true">
                <MarkIcon />
              </Styled.Mark>
              {collapsed ? (
                <>
                  <Marquee text={title} preview={seekPreview} mini />
                  <Visualiser skin={skin} variant="mini" mode={visMode} />
                </>
              ) : (
                <>
                  <Styled.Ridges aria-hidden="true" />
                  <Styled.Title>faizaan.tech — {skinById(skin).name}</Styled.Title>
                  <Styled.Ridges aria-hidden="true" />
                </>
              )}
              <Styled.TitleButton
                type="button"
                aria-label={`Skin: ${skinById(skin).name}. Switch to ${next.name}`}
                title={`Switch to ${next.name}`}
                onMouseDown={keepFocus}
                onClick={cycleSkin}
              >
                <SkinIcon />
              </Styled.TitleButton>
              {drawer ? (
                <Styled.TitleButton
                  type="button"
                  aria-label="Close player"
                  onMouseDown={keepFocus}
                  onClick={closeDrawer}
                >
                  <CloseIcon />
                </Styled.TitleButton>
              ) : (
                <Styled.TitleButton
                  type="button"
                  aria-label="Windowshade"
                  aria-pressed={shaded}
                  title={shaded ? "Expand the player" : "Collapse the player"}
                  onMouseDown={keepFocus}
                  onClick={() => setShaded((s) => !s)}
                >
                  <ShadeIcon shaded={shaded} />
                </Styled.TitleButton>
              )}
            </Styled.TitleBar>

            {!collapsed && (
              <Styled.Body>
                <Artwork track={track} />
                <Styled.Lcd>
                  <Styled.LcdTop>
                    <Clock
                      key={skin}
                      segments={skin !== "faizaan"}
                      remaining={remaining}
                      duration={duration}
                      isPlaying={isPlaying}
                      onToggle={() => setRemaining((r) => !r)}
                    />
                  </Styled.LcdTop>
                  <Marquee text={title} preview={seekPreview} />
                  <Styled.Readouts aria-hidden="true">
                    <Styled.Readout $on={bpm !== null}>{bpm ? Math.round(bpm) : "000"}</Styled.Readout>
                    <Styled.ReadoutUnit>bpm</Styled.ReadoutUnit>
                    <Styled.Readout $on={Boolean(sampleRate)}>
                      {sampleRate ? Math.round(sampleRate / 1000) : "00"}
                    </Styled.Readout>
                    <Styled.ReadoutUnit>kHz</Styled.ReadoutUnit>
                    <Styled.Readout $on={channels === 1} $push>
                      mono
                    </Styled.Readout>
                    <Styled.Readout $on={channels !== null && channels > 1}>stereo</Styled.Readout>
                  </Styled.Readouts>
                </Styled.Lcd>

                <Visualiser
                  skin={skin}
                  variant="full"
                  mode={visMode}
                  onToggleMode={() => setVisMode((m) => (m === "bars" ? "scope" : "bars"))}
                />

                <Seek duration={duration} preview={seekPreview} />

                <Styled.Controls>
                  <Styled.Group>
                    <Styled.Button
                      type="button"
                      aria-label="Previous track"
                      onMouseDown={keepFocus}
                      onClick={() => {
                        engine.unlock();
                        engine.previous();
                      }}
                    >
                      <PrevIcon />
                    </Styled.Button>
                    <Styled.Button
                      type="button"
                      $play
                      aria-label="Play"
                      onMouseDown={keepFocus}
                      onClick={() => {
                        engine.unlock();
                        if (!engine.getSnapshot().isPlaying) engine.play();
                      }}
                    >
                      <PlayIcon />
                    </Styled.Button>
                    <Styled.Button
                      type="button"
                      aria-label="Pause"
                      onMouseDown={keepFocus}
                      onClick={() => {
                        // Winamp's pause: pauses, or resumes a paused song; does nothing when stopped
                        if (isPlaying) engine.pause();
                        else if (engine.frame.time > 0.05) engine.toggle();
                      }}
                    >
                      <PauseIcon />
                    </Styled.Button>
                    <Styled.Button
                      type="button"
                      aria-label="Stop"
                      onMouseDown={keepFocus}
                      onClick={() => engine.stop()}
                    >
                      <StopIcon />
                    </Styled.Button>
                    <Styled.Button
                      type="button"
                      aria-label="Next track"
                      onMouseDown={keepFocus}
                      onClick={() => {
                        engine.unlock();
                        engine.next();
                      }}
                    >
                      <NextIcon />
                    </Styled.Button>
                  </Styled.Group>
                  <Styled.Group>
                    <Styled.Button
                      type="button"
                      aria-label="Mute"
                      aria-pressed={muted}
                      onMouseDown={keepFocus}
                      onClick={() => engine.setMuted(!muted)}
                    >
                      <Styled.Lamp $on={muted} />
                      mute
                    </Styled.Button>
                    <Styled.Button
                      type="button"
                      aria-label="Jam pad"
                      aria-pressed={padOpen}
                      onMouseDown={keepFocus}
                      onClick={() => {
                        // on a phone the pad sits where the open drawer is: opening it tucks the drawer away
                        if (drawer && !padOpen) closeDrawer();
                        setPadOpen(!padOpen);
                      }}
                    >
                      <Styled.Lamp $on={padOpen} />
                      jam
                    </Styled.Button>
                    <Styled.Button
                      type="button"
                      aria-label="Playlist"
                      aria-pressed={playlistOpen}
                      aria-controls={PLAYLIST_ID}
                      onMouseDown={keepFocus}
                      onClick={() => setPlaylistOpen((open) => !open)}
                    >
                      <Styled.Lamp $on={playlistOpen} />
                      pl
                    </Styled.Button>
                  </Styled.Group>
                  <Styled.Volume
                    type="range"
                    aria-label="Volume"
                    aria-valuetext={`${Math.round(volume * 100)}%${muted ? ", muted" : ""}`}
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(volume * 100)}
                    $level={volume}
                    onChange={(event) => engine.setVolume(Number(event.currentTarget.value) / 100)}
                  />
                </Styled.Controls>
              </Styled.Body>
            )}
          </Styled.Window>

          {playlistOpen && !collapsed && (
            <Playlist id={PLAYLIST_ID} tracks={tracks} current={currentId} onPlay={play} />
          )}
        </Styled.Stack>
        <Styled.VisuallyHidden aria-live="polite" aria-atomic="true">
          {`Now playing: ${track.title} by ${track.artist}`}
        </Styled.VisuallyHidden>
      </Styled.Shell>
      {padOpen && (
        <Styled.PadDock data-layout={drawer ? "drawer" : "dock"}>
          <DjPad />
        </Styled.PadDock>
      )}
    </>
  );
};

export default Player;
