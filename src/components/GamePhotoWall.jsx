import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { normalizeGameWallContent, usePublishedContent } from "../contentApi";
import { gameWallImages } from "../gameWallData";
import LocalizedDecryptedText from "./LocalizedDecryptedText";
import PixelSwap from "./PixelSwap";
import ShapeGrid from "./ShapeGrid";
import SkeletonImage from "./SkeletonImage";
import PreviewWatermark from "./PreviewWatermark";
import "./GamePhotoWall.css";

const filters = ["all", "collection", "shoreline", "scarlet", "garden", "starlight", "sunlit"];

const tiltStyleProperties = [
  "--game-wall-tilt-x",
  "--game-wall-tilt-y",
];

function fill(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function imageNumber(image) {
  return String(image.number).padStart(2, "0");
}

function useFinePointer() {
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateFinePointer = () => setFinePointer(mediaQuery.matches);

    updateFinePointer();
    mediaQuery.addEventListener("change", updateFinePointer);

    return () => mediaQuery.removeEventListener("change", updateFinePointer);
  }, []);

  return finePointer;
}

function GameWallTile({ image, index, label, copy, reduceMotion, tiltEnabled, onOpen }) {
  const surfaceRef = useRef(null);
  const animationFrameRef = useRef(0);
  const nextTiltRef = useRef(null);

  const resetTilt = useCallback(() => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    nextTiltRef.current = null;
    const surface = surfaceRef.current;
    if (!surface) return;

    surface.dataset.tiltActive = "false";
    tiltStyleProperties.forEach((property) => surface.style.removeProperty(property));
  }, []);

  const applyTilt = useCallback(() => {
    animationFrameRef.current = 0;
    const surface = surfaceRef.current;
    const nextTilt = nextTiltRef.current;
    if (!surface || !nextTilt) return;

    surface.style.setProperty("--game-wall-tilt-x", `${nextTilt.rotateX.toFixed(2)}deg`);
    surface.style.setProperty("--game-wall-tilt-y", `${nextTilt.rotateY.toFixed(2)}deg`);
    surface.dataset.tiltActive = "true";
  }, []);

  const handlePointerMove = useCallback((event) => {
    if (!tiltEnabled || event.pointerType !== "mouse") return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const pointerX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const pointerY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));

    nextTiltRef.current = {
      rotateX: (0.5 - pointerY) * 4.8,
      rotateY: (pointerX - 0.5) * 6.2,
    };

    if (!animationFrameRef.current) {
      animationFrameRef.current = window.requestAnimationFrame(applyTilt);
    }
  }, [applyTilt, tiltEnabled]);

  useEffect(() => () => resetTilt(), [resetTilt]);

  useEffect(() => {
    if (!tiltEnabled) resetTilt();
  }, [resetTilt, tiltEnabled]);

  return (
    <motion.button
      className={`game-wall-tile game-wall-tile-${image.shape}`}
      type="button"
      onClick={(event) => onOpen(image, event)}
      onPointerMove={tiltEnabled ? handlePointerMove : undefined}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
      onBlur={resetTilt}
      data-tilt-enabled={tiltEnabled ? "true" : "false"}
      aria-label={fill(copy.gameWall.openImage, { label: copy.gameWall.groups[image.group], index: imageNumber(image) })}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.32, delay: reduceMotion ? 0 : Math.min(index * 0.018, 0.24) }}
      layout={!reduceMotion}
    >
      <span ref={surfaceRef} className="game-wall-tile__tilt-surface" data-tilt-active="false">
        <SkeletonImage
          src={image.thumb}
          alt={fill(copy.gameWall.imageAlt, { group: copy.gameWall.groups[image.group], index: imageNumber(image) })}
          loading={index < 12 ? "eager" : "lazy"}
          decoding="async"
        />
        <span className="game-wall-tile-scrim" aria-hidden="true" />
        {image.previewOnly && <PreviewWatermark label={image.watermarkText} />}
        <span className="game-wall-tile-meta">
          <span>{copy.gameWall.groups[image.group]}</span>
          <strong>{imageNumber(image)}</strong>
        </span>
        <span className="game-wall-tile-label">{label}</span>
      </span>
    </motion.button>
  );
}

function GameWallTitle({ copy }) {
  return (
    <h1 id="game-wall-title">
      <span className="game-wall-title-decrypted">{copy.gameWall.title}</span>
      <span className="game-wall-title-decrypted game-wall-title-accent">{copy.gameWall.titleAccent}</span>
    </h1>
  );
}

export default function GamePhotoWall({ copy }) {
  const images = usePublishedContent("game-wall", gameWallImages, normalizeGameWallContent);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState({ id: null, state: "loading" });
  const openerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lightboxRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const tiltEnabled = finePointer && !reduceMotion;

  const visibleImages = useMemo(
    () => (filter === "all" ? images : images.filter((image) => image.group === filter)),
    [filter, images],
  );
  const selectedIndex = visibleImages.findIndex((image) => image.id === selectedId);
  const selected = selectedIndex >= 0 ? visibleImages[selectedIndex] : null;

  const getLabel = (image) => image.title || fill(copy.gameWall.fullLabel, {
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
        <ShapeGrid
          className="game-wall-hero__shape-grid"
          speed={reduceMotion ? 0 : 0.28}
          squareSize={48}
          direction="diagonal"
          borderColor="rgba(242, 241, 235, 0.08)"
          hoverFillColor="transparent"
          shape="square"
          hoverTrailAmount={0}
        />
        <div className="game-wall-copy">
          <p className="game-wall-eyebrow">
            {fill(copy.gameWall.eyebrow, { count: images.length })}
          </p>
          <GameWallTitle copy={copy} />
          <p className="game-wall-intro"><LocalizedDecryptedText text={copy.gameWall.intro} /></p>
          <p className="game-wall-instruction"><LocalizedDecryptedText text={copy.gameWall.instruction} /></p>
        </div>
        <div className="game-wall-hero-frame">
          <PixelSwap
            className="game-wall-hero-pixel-swap"
            firstContent={<SkeletonImage src="/game-wall/thumb/crimson-20.jpg" alt={copy.gameWall.heroPreviewFirstAlt} shimmer />}
            secondContent={<SkeletonImage src="/game-wall/thumb/collection-113.jpg" alt={copy.gameWall.heroPreviewSecondAlt} shimmer />}
            pixelSize={52}
            gap={1}
            pixelRadius={0}
            pixelSpin={0}
            pixelScale={0.35}
            duration={900}
            pixelDuration={340}
            pattern="diagonal"
            randomness={0.14}
            fade
            trigger="click"
            ariaLabel={copy.gameWall.heroPreviewAction}
            aspectRatio="1.06"
          />
          <span className="game-wall-hero-prompt"><LocalizedDecryptedText text={copy.gameWall.heroPreviewPrompt} /></span>
          <strong>{String(images.length).padStart(2, "0")}</strong>
        </div>
      </div>

      <div className="game-wall-browser" data-cia-context="game-wall">
        <div className="game-wall-toolbar">
          <div>
            <p><LocalizedDecryptedText text={copy.gameWall.archiveLabel} /></p>
            <h2><LocalizedDecryptedText text={copy.gameWall.archiveTitle} variant="display" /></h2>
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
                <GameWallTile
                  key={image.id}
                  image={image}
                  index={index}
                  label={label}
                  copy={copy}
                  reduceMotion={reduceMotion}
                  tiltEnabled={tiltEnabled}
                  onOpen={openViewer}
                />
              );
            })}
          </AnimatePresence>
        </div>

        <p className="game-wall-disclaimer"><LocalizedDecryptedText text={copy.gameWall.disclaimer} /></p>
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
              <p id="game-wall-lightbox-title"><LocalizedDecryptedText text={getLabel(selected)} /></p>
              <p><LocalizedDecryptedText text={fill(copy.gameWall.position, { current: selectedIndex + 1, total: visibleImages.length })} /></p>
              <button ref={closeButtonRef} type="button" onClick={closeViewer} aria-label={copy.gameWall.close}>
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="game-wall-lightbox-stage">
              <button className="game-wall-lightbox-arrow game-wall-lightbox-previous" type="button" onClick={() => moveSelection(-1)} aria-label={copy.gameWall.previous}>
                <CaretLeft size={28} weight="bold" />
              </button>
              <div className="game-wall-lightbox-viewport">
                <motion.img
                  key={selected.id}
                  className={`game-wall-lightbox-image${selected.letterboxed ? " game-wall-lightbox-image--letterboxed" : ""}`}
                  src={selected.full}
                  alt={fill(copy.gameWall.imageAlt, { group: copy.gameWall.groups[selected.group], index: imageNumber(selected) })}
                  data-media-state={lightboxMedia.id === selected.id ? lightboxMedia.state : "loading"}
                  data-media-shimmer="true"
                  onLoad={() => setLightboxMedia({ id: selected.id, state: "loaded" })}
                  onError={() => setLightboxMedia({ id: selected.id, state: "error" })}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
                />
                {selected.previewOnly && <PreviewWatermark label={selected.watermarkText} />}
              </div>
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
