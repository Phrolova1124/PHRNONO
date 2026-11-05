import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import { normalizeMusicContent, usePublishedContent } from "../contentApi";
import { musicTracks } from "../musicData";
import LocalizedDecryptedText from "./LocalizedDecryptedText";
import ShapeGrid from "./ShapeGrid";
import SkeletonImage from "./SkeletonImage";
import "./MusicPage.css";

function trackNumber(index) {
  return String(index + 1).padStart(2, "0");
}

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return "0:00";

  const wholeSeconds = Math.floor(value);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = String(wholeSeconds % 60).padStart(2, "0");

  return String(minutes) + ":" + seconds;
}

function replaceTitle(template, title) {
  return template.replace("{title}", title);
}

function Artwork({ track, className = "" }) {
  return (
    <SkeletonImage
      className={className}
      src={track.artwork}
      alt=""
      shimmer={className.includes("music-page__cover")}
      loading={className.includes("music-page__cover") ? "eager" : "lazy"}
    />
  );
}

export default function MusicPage({ copy }) {
  const tracks = usePublishedContent("music", musicTracks, normalizeMusicContent);
  const [activeTrackId, setActiveTrackId] = useState(musicTracks[0]?.id ?? "");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0];

  useEffect(() => {
    if (activeTrackId && tracks.some((track) => track.id === activeTrackId)) return;
    setActiveTrackId(tracks[0]?.id ?? "");
  }, [activeTrackId, tracks]);

  useEffect(() => {
    const player = audioRef.current;

    if (!player) return;

    player.volume = volume;
  }, [volume]);

  useEffect(() => {
    const player = audioRef.current;

    if (!player) return;

    player.pause();
    player.load();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
  }, [activeTrack?.id]);

  if (!activeTrack) return null;

  const togglePlayback = async () => {
    const player = audioRef.current;

    if (!player) return;

    if (player.paused) {
      setAudioError(false);

      try {
        await player.play();
      } catch {
        setAudioError(true);
      }

      return;
    }

    player.pause();
  };

  const selectTrack = (trackId) => {
    if (trackId === activeTrack.id) {
      void togglePlayback();
      return;
    }

    setActiveTrackId(trackId);
  };

  const seek = (event) => {
    const nextTime = Number(event.target.value);
    const player = audioRef.current;

    if (!player || !Number.isFinite(nextTime)) return;

    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const updateDuration = (event) => {
    const nextDuration = event.currentTarget.duration;
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
  };

  const activeDuration = duration || 0;
  const shownDuration = activeDuration ? formatTime(activeDuration) : activeTrack.duration;
  const playLabel = playing
    ? replaceTitle(copy.music.pauseTrack, activeTrack.title)
    : replaceTitle(copy.music.playTrack, activeTrack.title);

  return (
    <section className="music-page" aria-labelledby="music-page-title">
      <div className="music-page__hero">
        <ShapeGrid
          className="music-page__shape-grid"
          speed={0.28}
          squareSize={48}
          direction="diagonal"
          borderColor="rgba(242, 241, 235, 0.07)"
          hoverFillColor="transparent"
          shape="square"
          hoverTrailAmount={0}
        />
        <div className="music-page__hero-copy">
          <p className="music-page__eyebrow"><LocalizedDecryptedText text={copy.music.eyebrow} /></p>
          <p className="music-page__source-note"><LocalizedDecryptedText text={copy.music.sourceNote} /></p>
          <h1 id="music-page-title">
            <LocalizedDecryptedText text={copy.music.title} variant="display" />
            <span className="music-page__title-accent"><LocalizedDecryptedText text={copy.music.titleAccent} variant="display" /></span>
          </h1>
          <p className="music-page__intro"><LocalizedDecryptedText text={copy.music.intro} /></p>
        </div>

        <div className="music-page__signal" aria-hidden="true">
          <span className="music-page__signal-label">{copy.music.signalLabel}</span>
          <div className="music-page__signal-bars">
            {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
          </div>
          <div className="music-page__signal-readout">
            <span>01</span>
            <span>{copy.music.localAudio}</span>
            <span>{String(tracks.length).padStart(2, "0")} TRACK</span>
          </div>
        </div>
      </div>

      <div className="music-page__deck" data-cia-context="music">
        <section className="music-page__player-panel" aria-labelledby="music-now-playing">
          <div className="music-page__panel-topline">
            <p><LocalizedDecryptedText text={copy.music.nowPlaying} /></p>
            <span><LocalizedDecryptedText text={copy.music.localAudio} /></span>
          </div>
          <div className="music-page__track-heading">
            <Artwork track={activeTrack} className="music-page__cover" />
            <div>
              <h2 id="music-now-playing"><LocalizedDecryptedText text={activeTrack.title} variant="display" /></h2>
              <p><LocalizedDecryptedText text={activeTrack.artist} /></p>
            </div>
          </div>
          <p className="music-page__release"><LocalizedDecryptedText text={activeTrack.release} /></p>

          <audio
            ref={audioRef}
            className="music-page__audio"
            src={activeTrack.audioSrc}
            preload="metadata"
            onDurationChange={updateDuration}
            onEnded={() => {
              setPlaying(false);
              setCurrentTime(activeDuration);
            }}
            onError={() => {
              setPlaying(false);
              setAudioError(true);
            }}
            onLoadedMetadata={updateDuration}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />

          <div className="music-page__native-player">
            <button
              className="music-page__play-button"
              type="button"
              aria-label={playLabel}
              aria-pressed={playing}
              onClick={() => void togglePlayback()}
            >
              {playing
                ? <Pause size={24} weight="fill" aria-hidden="true" />
                : <Play size={24} weight="fill" aria-hidden="true" />}
            </button>

            <div className="music-page__timeline">
              <label className="sr-only" htmlFor="music-progress">
                {copy.music.seekLabel.replace("{title}", activeTrack.title)}
              </label>
              <input
                id="music-progress"
                type="range"
                min="0"
                max={Math.max(activeDuration, 1)}
                step="0.1"
                value={Math.min(currentTime, activeDuration || 0)}
                disabled={!activeDuration}
                onChange={seek}
              />
              <p>
                <span>{formatTime(currentTime)}</span>
                <span>{shownDuration}</span>
              </p>
            </div>

            <label className="music-page__volume-control">
              <span>{volume === 0
                ? <SpeakerSlash size={18} weight="bold" aria-hidden="true" />
                : <SpeakerHigh size={18} weight="bold" aria-hidden="true" />}</span>
              <span className="sr-only">{copy.music.volumeLabel}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                aria-label={copy.music.volumeLabel}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="music-page__player-footer">
            <p><LocalizedDecryptedText text={copy.music.listenHint} /></p>
            <span><LocalizedDecryptedText text={playing ? copy.music.playingStatus : copy.music.readyStatus} /></span>
          </div>
          {audioError && <p className="music-page__audio-error" role="alert">{copy.music.playbackError}</p>}

          <div className="music-page__lyrics">
            <div className="music-page__panel-topline">
              <p><LocalizedDecryptedText text={copy.music.lyricsLabel} /></p>
              <span><LocalizedDecryptedText text={copy.music.localAudio} /></span>
            </div>
            {activeTrack.lyrics
              ? <p className="music-page__lyrics-text">{activeTrack.lyrics}</p>
              : <p><LocalizedDecryptedText text={copy.music.lyricsUnavailable} /></p>}
          </div>
        </section>

        <aside className="music-page__index" aria-labelledby="music-track-index">
          <div className="music-page__panel-topline">
            <p><LocalizedDecryptedText text={copy.music.listLabel} /></p>
            <span><LocalizedDecryptedText text={copy.music.trackCount.replace("{count}", String(musicTracks.length).padStart(2, "0"))} /></span>
          </div>
          <h2 id="music-track-index"><LocalizedDecryptedText text={copy.music.listTitle} variant="display" /></h2>
          <ol className="music-page__track-list">
            {tracks.map((track, index) => {
              const selected = track.id === activeTrack.id;
              const selectedAndPlaying = selected && playing;
              const trackAction = selected
                ? selectedAndPlaying
                  ? replaceTitle(copy.music.pauseTrack, track.title)
                  : replaceTitle(copy.music.playTrack, track.title)
                : replaceTitle(copy.music.selectTrack, track.title);

              return (
                <li key={track.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={trackAction}
                    onClick={() => selectTrack(track.id)}
                  >
                    <span className="music-page__list-number">{trackNumber(index)}</span>
                    <Artwork track={track} className="music-page__list-artwork" />
                    <span className="music-page__list-copy">
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                    </span>
                    {selectedAndPlaying
                      ? <Pause className="music-page__list-play" size={18} weight="fill" aria-hidden="true" />
                      : <Play className="music-page__list-play" size={18} weight="fill" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <p className="music-page__notice"><LocalizedDecryptedText text={copy.music.notice} /></p>
    </section>
  );
}
