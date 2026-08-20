import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { gameWallImages } from "../gameWallData";
import DecryptedText from "./DecryptedText";
import "./GamePhotoWall.css";

const filters = ["all", "collection", "shoreline", "scarlet", "garden", "starlight", "sunlit"];

function fill(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function imageNumber(image) {
  return String(image.number).padStart(2, "0");
}

export default function GamePhotoWall({ copy }) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const openerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lightboxRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const visibleImages = useMemo(
    () => (filter === "all" ? gameWallImages : gameWallImages.filter((image) => image.group === filter)),
    [filter],
  );
  const selectedIndex = visibleImages.findIndex((image) => image.id === selectedId);
  const selected = selectedIndex >= 0 ? visibleImages[selectedIndex] : null;

  const getLabel = (image) => fill(copy.gameWall.fullLabel, {
    group: copy.gameWall.groups[image.group],
    index: imageNumber(image),
  });

  const closeViewer = () => {
    restoreFocusRef.current = true;
    setSelectedId(null);
  };

  const moveSelection = (delta) => {
    if (!selected || !visibleImages.length) return;
    const nextIndex = (selectedIndex + delta + visibleImages.length) % visibleImages.length;
    setSelectedId(visibleImages[nextIndex].id);
  };

  const chooseFilter = (nextFilter) => {
    if (selectedId) restoreFocusRef.current = true;
    setFilter(nextFilter);
    setSelectedId(null);
  };

  const openViewer = (image, event) => {
    openerRef.current = event.currentTarget;
    setSelectedId(image.id);
  };

  useEffect(() => {
    if (!selected) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 30);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelection(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelection(1);
      }
      if (event.key === "Tab") {
        const focusable = [...(lightboxRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [])];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected, selectedIndex, visibleImages]);

  useEffect(() => {
    if (selected || !restoreFocusRef.current) return undefined;

    const focusTimer = window.setTimeout(() => openerRef.current?.focus(), 0);
    restoreFocusRef.current = false;
    return () => window.clearTimeout(focusTimer);
  }, [selected]);

  return (
    <section className="game-wall-page" aria-labelledby="game-wall-title">
      <div className="game-wall-hero">
        <div className="game-wall-copy">
          <p className="game-wall-eyebrow">
            <DecryptedText
              text={fill(copy.gameWall.eyebrow, { count: gameWallImages.length })}
              animateOn="view"
              sequential
              revealDirection="center"
              speed={24}
              characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /.-"
              parentClassName="game-wall-decrypted-text"
              encryptedClassName="game-wall-decrypted-encrypted"
            />
          </p>
          <h1 id="game-wall-title">
            {copy.gameWall.title}
            <span>{copy.gameWall.titleAccent}</span>
          </h1>
          <p className="game-wall-intro">{copy.gameWall.intro}</p>
          <p className="game-wall-instruction">{copy.gameWall.instruction}</p>
        </div>
        <div className="game-wall-hero-frame" aria-hidden="true">
          <img src="/game-wall/thumb/crimson-20.jpg" alt="" />
          <span>PHRNONO / PLAY LOG</span>
          <strong>{String(gameWallImages.length).padStart(2, "0")}</strong>
        </div>
      </div>

      <div className="game-wall-browser">
        <div className="game-wall-toolbar">
          <div>
            <p>{copy.gameWall.archiveLabel}</p>
            <h2>{copy.gameWall.archiveTitle}</h2>
          </div>
          <div className="game-wall-toolbar-right">
            <p className="game-wall-count" aria-live="polite">
              {fill(copy.gameWall.results, { count: visibleImages.length })}
            </p>
            <div className="game-wall-filters" role="group" aria-label={copy.gameWall.filterLabel}>
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => chooseFilter(item)}
                >
                  {item === "all" ? copy.gameWall.all : copy.gameWall.groups[item]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="game-wall-grid" id="game-wall-grid">
          <AnimatePresence mode="popLayout">
            {visibleImages.map((image, index) => {
              const label = getLabel(image);
              return (
                <motion.button
                  key={image.id}
                  className={`game-wall-tile game-wall-tile-${image.shape}`}
                  type="button"
                  onClick={(event) => openViewer(image, event)}
                  aria-label={fill(copy.gameWall.openImage, { label: copy.gameWall.groups[image.group], index: imageNumber(image) })}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.32, delay: reduceMotion ? 0 : Math.min(index * 0.018, 0.24) }}
                  layout={!reduceMotion}
                >
                  <img
                    src={image.thumb}
                    alt={fill(copy.gameWall.imageAlt, { group: copy.gameWall.groups[image.group], index: imageNumber(image) })}
                    loading={index < 12 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span className="game-wall-tile-scrim" aria-hidden="true" />
                  <span className="game-wall-tile-meta">
                    <span>{copy.gameWall.groups[image.group]}</span>
                    <strong>{imageNumber(image)}</strong>
                  </span>
                  <span className="game-wall-tile-label">{label}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <p className="game-wall-disclaimer">{copy.gameWall.disclaimer}</p>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            ref={lightboxRef}
            className="game-wall-lightbox"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-wall-lightbox-title"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeViewer();
            }}
          >
            <div className="game-wall-lightbox-bar">
              <p id="game-wall-lightbox-title">{getLabel(selected)}</p>
              <p>{fill(copy.gameWall.position, { current: selectedIndex + 1, total: visibleImages.length })}</p>
              <button ref={closeButtonRef} type="button" onClick={closeViewer} aria-label={copy.gameWall.close}>
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="game-wall-lightbox-stage">
              <button className="game-wall-lightbox-arrow game-wall-lightbox-previous" type="button" onClick={() => moveSelection(-1)} aria-label={copy.gameWall.previous}>
                <CaretLeft size={28} weight="bold" />
              </button>
              <motion.img
                key={selected.id}
                className="game-wall-lightbox-image"
                src={selected.full}
                alt={fill(copy.gameWall.imageAlt, { group: copy.gameWall.groups[selected.group], index: imageNumber(selected) })}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
              />
              <button className="game-wall-lightbox-arrow game-wall-lightbox-next" type="button" onClick={() => moveSelection(1)} aria-label={copy.gameWall.next}>
                <CaretRight size={28} weight="bold" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
