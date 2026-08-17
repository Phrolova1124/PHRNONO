import { useCallback, useEffect, useRef } from "react";
import {
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import "./ScrollExpand.css";

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

const smoothstep = (edge0, edge1, value) => {
  const amount = clamp((value - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

function ScrollExpand({
  src = "",
  mediaType = "image",
  poster = "",
  alt = "",
  title = "",
  scrollHint = "",
  startWidth = 42,
  startHeight = 58,
  startRadius = 24,
  endRadius = 0,
  mediaZoom = 1.35,
  scrollDistance = 1.2,
  holdDistance = 0.35,
  smoothing = 0.1,
  overlayScrim = 0.45,
  useWindowScroll = false,
  enabled = true,
  children,
  className = "",
  style,
  ...rest
}) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const mediaRef = useRef(null);
  const titleRef = useRef(null);
  const overlayRef = useRef(null);
  const scrimRef = useRef(null);
  const hintRef = useRef(null);
  const overlayInteractiveRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const propsRef = useRef({});
  propsRef.current = {
    startWidth,
    startHeight,
    startRadius,
    endRadius,
    mediaZoom,
    scrollDistance,
    holdDistance,
    smoothing,
    overlayScrim,
    useWindowScroll,
    enabled,
  };

  const { scrollYProgress } = useScroll({
    container: useWindowScroll ? undefined : rootRef,
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const expansionProgress = useTransform(scrollYProgress, (value) => {
    const current = propsRef.current;
    if (!current.enabled || reduceMotion) return 1;
    const expansionSpan = Math.max(0.01, current.scrollDistance);
    const totalSpan = expansionSpan + Math.max(0, current.holdDistance);
    return clamp((value * totalSpan) / expansionSpan, 0, 1);
  });

  const followedProgress = useSpring(expansionProgress, {
    stiffness: 170,
    damping: 34,
    mass: 0.5,
  });
  const activeProgress = reduceMotion || smoothing <= 0 ? expansionProgress : followedProgress;

  const applyProgress = useCallback((progress) => {
    const frame = frameRef.current;
    const media = mediaRef.current;
    if (!frame || !media) return;

    const current = propsRef.current;
    const eased = smoothstep(0, 1, progress);
    const width = current.startWidth + (100 - current.startWidth) * eased;
    const height = current.startHeight + (100 - current.startHeight) * eased;
    const insetX = Math.max(0, (100 - width) / 2);
    const insetY = Math.max(0, (100 - height) / 2);
    const radius = current.startRadius + (current.endRadius - current.startRadius) * eased;

    frame.style.clipPath = `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`;
    media.style.transform = `scale(${current.mediaZoom + (1 - current.mediaZoom) * eased})`;

    if (scrimRef.current) {
      scrimRef.current.style.opacity = `${current.overlayScrim * eased}`;
    }

    if (titleRef.current) {
      const exit = smoothstep(0.36, 0.82, progress);
      titleRef.current.style.opacity = `${1 - exit}`;
      titleRef.current.style.transform = `translate3d(0, ${-28 * exit}px, 0) scale(${1 + 0.05 * exit})`;
    }

    if (hintRef.current) {
      const exit = smoothstep(0, 0.12, progress);
      hintRef.current.style.opacity = `${1 - exit}`;
      hintRef.current.style.transform = `translate3d(0, ${8 * exit}px, 0)`;
    }

    if (overlayRef.current) {
      const enter = smoothstep(0.66, 1, progress);
      overlayRef.current.style.opacity = `${enter}`;
      overlayRef.current.style.transform = `translate3d(0, ${18 * (1 - enter)}px, 0)`;

      const interactive = progress >= 0.78;
      if (overlayInteractiveRef.current !== interactive) {
        overlayInteractiveRef.current = interactive;
        overlayRef.current.inert = !interactive;
        overlayRef.current.setAttribute("aria-hidden", String(!interactive));
      }
    }
  }, []);

  useMotionValueEvent(activeProgress, "change", applyProgress);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!root || !track || !stage) return undefined;

    const measure = () => {
      const current = propsRef.current;
      const stageHeight = current.useWindowScroll ? window.innerHeight : root.clientHeight;
      if (stageHeight <= 0) return;

      const staticMode = reduceMotion || !current.enabled;
      const expansionLength = Math.max(0, current.scrollDistance);
      const holdLength = Math.max(0, current.holdDistance);
      stage.style.height = `${stageHeight}px`;
      track.style.height = `${stageHeight * (staticMode ? 1 : 1 + expansionLength + holdLength)}px`;

      const width = root.clientWidth || stageHeight;
      stage.style.setProperty("--se-title-size", `${clamp(width * 0.075, 36, 112)}px`);
      applyProgress(staticMode ? 1 : activeProgress.get());
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeProgress, applyProgress, reduceMotion]);

  const initialInsetX = Math.max(0, (100 - startWidth) / 2);
  const initialInsetY = Math.max(0, (100 - startHeight) / 2);
  const media = mediaType === "video" ? (
    <video
      ref={mediaRef}
      className="scroll-expand__media"
      src={src}
      poster={poster}
      aria-label={alt}
      autoPlay={!reduceMotion}
      muted
      loop
      playsInline
    />
  ) : (
    <img
      ref={mediaRef}
      className="scroll-expand__media"
      src={src}
      alt={alt}
      draggable="false"
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <section
      ref={rootRef}
      className={`scroll-expand ${useWindowScroll ? "" : "scroll-expand--scroller"} ${className}`.trim()}
      style={style}
      {...rest}
    >
      <div ref={trackRef} className="scroll-expand__track">
        <div ref={stageRef} className="scroll-expand__stage">
          <div
            ref={frameRef}
            className="scroll-expand__frame"
            style={{ clipPath: `inset(${initialInsetY}% ${initialInsetX}% ${initialInsetY}% ${initialInsetX}% round ${startRadius}px)` }}
          >
            {media}
            <div ref={scrimRef} className="scroll-expand__scrim" aria-hidden="true" />
            {children ? (
              <div ref={overlayRef} className="scroll-expand__overlay" aria-hidden="true" inert>
                {children}
              </div>
            ) : null}
          </div>
          {title ? (
            <div ref={titleRef} className="scroll-expand__title" aria-hidden="true">
              {title}
            </div>
          ) : null}
          {scrollHint ? (
            <div ref={hintRef} className="scroll-expand__hint" aria-hidden="true">
              {scrollHint}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ScrollExpand;
