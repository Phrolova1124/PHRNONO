import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import SkeletonImage from "./SkeletonImage";
import PreviewWatermark from "./PreviewWatermark";
import "./AccordionGallery.css";

function AccordionGallery({
  items,
  defaultIndex = 0,
  accentColor = "#d6f438",
  overlayColor = "#0c0e0c",
  textColor = "#fbfbf8",
  height = 520,
  gap = 8,
  radius = 0,
  expandRatio = 0.56,
  orientation = "horizontal",
  duration = 0.6,
  ease = "power3.out",
  parallax = 0.5,
  tilt = 0,
  stagger = 0.06,
  trigger = "hover",
  showLabels = true,
  grayscale = true,
  ariaLabel = "Portfolio gallery",
  className = "",
  onItemClick,
}) {
  const rootRef = useRef(null);
  const panelRefs = useRef([]);
  const mediaRefs = useRef([]);
  const barRefs = useRef([]);
  const textRefs = useRef([]);
  const timelineRef = useRef(null);
  const firstRunRef = useRef(true);
  const mediaSizeRef = useRef(320);
  const vertical = orientation === "vertical";
  const count = items.length;
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1));

  const prefersReduced = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const applyLayout = useCallback((animate) => {
    const panels = panelRefs.current;
    if (!panels.length) return;

    const ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);
    const grow = count > 1 ? (ratio * (count - 1)) / (1 - ratio) : 1;
    const mediaSize = mediaSizeRef.current;
    timelineRef.current?.kill();
    const animationDuration = animate && !prefersReduced ? duration : 0;
    const timeline = gsap.timeline();

    panels.forEach((panel, index) => {
      if (!panel) return;
      const isActive = index === active;
      const media = mediaRefs.current[index];
      const bar = barRefs.current[index];
      const text = textRefs.current[index];
      const rotation = isActive ? 0 : index < active ? tilt : -tilt;
      const rotationProperty = vertical ? { rotateX: -rotation } : { rotateY: rotation };

      timeline.to(panel, {
        flexGrow: isActive ? grow : 1,
        ...rotationProperty,
        duration: animationDuration,
        ease,
      }, 0);

      if (media) {
        const drift = Math.max(-1.5, Math.min(1.5, active - index));
        const shift = drift * parallax * mediaSize * 0.06;
        timeline.to(media, {
          xPercent: -50,
          yPercent: -50,
          x: vertical ? 0 : isActive ? 0 : shift,
          y: vertical ? (isActive ? 0 : shift) : 0,
          "--ag-gray": grayscale ? (isActive ? 0 : 1) : 0,
          "--ag-dim": isActive ? 0 : 0.35,
          duration: animationDuration,
          ease,
        }, 0);
      }

      if (showLabels && bar && text) {
        if (isActive) {
          timeline.to([bar, text], {
            opacity: 1,
            x: 0,
            duration: animationDuration,
            ease,
            stagger: prefersReduced ? 0 : stagger,
          }, 0);
        } else {
          timeline.to([bar, text], {
            opacity: 0,
            x: -14,
            duration: animationDuration * 0.6,
            ease,
          }, 0);
        }
      }
    });

    timelineRef.current = timeline;
  }, [active, count, duration, ease, expandRatio, grayscale, parallax, prefersReduced, showLabels, stagger, tilt, vertical]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const total = vertical ? bounds.height : bounds.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(140, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.22);
      mediaSizeRef.current = size;
      root.style.setProperty("--ag-media-size", `${size}px`);
      applyLayout(!firstRunRef.current);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [applyLayout, count, expandRatio, gap, vertical]);

  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout]);

  useEffect(() => () => timelineRef.current?.kill(), []);

  const handleEnter = (index) => {
    if (trigger === "hover") setActive(index);
  };

  const handleClick = (index, event) => {
    // Desktop hover galleries use the first click to select a panel. Touch
    // devices have no hover state, so a first tap should open the work.
    const supportsHover = typeof window !== "undefined"
      && (window.matchMedia("(hover: hover) and (pointer: fine)").matches
        || navigator.maxTouchPoints === 0);
    if (index !== active && supportsHover) {
      event.preventDefault();
      setActive(index);
      return;
    }
    onItemClick?.(items[index], event);
  };

  const handleKeyDown = (index, event) => {
    let nextIndex = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % count;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + count) % count;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = count - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActive(nextIndex);
    panelRefs.current[nextIndex]?.focus();
  };

  return (
    <section
      ref={rootRef}
      className={`accordion-gallery${vertical ? " accordion-gallery--vertical" : ""}${className ? ` ${className}` : ""}`}
      style={{
        "--ag-accent": accentColor,
        "--ag-overlay": overlayColor,
        "--ag-text": textColor,
        "--ag-gap": `${gap}px`,
        "--ag-radius": `${radius}px`,
        height: vertical ? `${Math.round(height * 1.6)}px` : `${height}px`,
      }}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const isActive = index === active;
        return (
          <a
            key={item.label ?? item.image}
            ref={(element) => { panelRefs.current[index] = element; }}
            className={`ag-panel${isActive ? " ag-panel--active" : ""}`}
            style={{ borderRadius: `${radius}px` }}
            href={item.link}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            onClick={(event) => handleClick(index, event)}
            onMouseEnter={() => handleEnter(index)}
            onFocus={() => setActive(index)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            aria-current={isActive ? "true" : undefined}
            aria-label={item.label}
          >
            <span className="ag-panel__frame">
              <span className="ag-panel__media" ref={(element) => { mediaRefs.current[index] = element; }}>
                <SkeletonImage
                  src={item.image}
                  alt={item.alt || item.label || ""}
                  draggable="false"
                  loading="lazy"
                />
              </span>
              <span className="ag-panel__overlay" aria-hidden="true" />
              {item.previewOnly && <PreviewWatermark label={item.watermarkText} />}
            </span>
            {showLabels && (
              <span className="ag-panel__label" aria-hidden="true">
                <span className="ag-panel__bar" ref={(element) => { barRefs.current[index] = element; }} />
                <span className="ag-panel__text" ref={(element) => { textRefs.current[index] = element; }}>
                  {item.label}
                </span>
              </span>
            )}
          </a>
        );
      })}
    </section>
  );
}

export default AccordionGallery;
