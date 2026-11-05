import { useCallback, useEffect, useRef, useState } from "react";
import "./LineSidebar.css";

const falloffCurves = {
  linear: (proximity) => proximity,
  smooth: (proximity) => proximity * proximity * (3 - 2 * proximity),
  sharp: (proximity) => proximity * proximity * proximity,
};

function LineSidebar({
  items,
  accentColor = "#425000",
  textColor = "#51544d",
  markerColor = "#8d9088",
  showIndex = true,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 30,
  falloff = "smooth",
  markerLength = 60,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 20,
  fontSize = 1.1,
  smoothing = 100,
  defaultActive = null,
  activeIndex: controlledActiveIndex = null,
  onItemClick,
  ariaLabel = "Section navigation",
  className = "",
}) {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const targetsRef = useRef([]);
  const currentRef = useRef([]);
  const animationRef = useRef(null);
  const lastFrameRef = useRef(0);
  const activeRef = useRef(defaultActive);
  const smoothingRef = useRef(smoothing);
  const reduceMotionRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(defaultActive);

  activeRef.current = activeIndex;
  smoothingRef.current = smoothing;

  useEffect(() => {
    if (controlledActiveIndex !== null && controlledActiveIndex !== undefined) {
      setActiveIndex(controlledActiveIndex);
    }
  }, [controlledActiveIndex]);

  const runFrame = useCallback((now) => {
    const elapsed = Math.min((now - lastFrameRef.current) / 1000, 0.05);
    lastFrameRef.current = now;
    const timeConstant = Math.max(smoothingRef.current, 1) / 1000;
    const interpolation = reduceMotionRef.current ? 1 : 1 - Math.exp(-elapsed / timeConstant);
    let moving = false;

    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const target = Math.max(targetsRef.current[index] || 0, activeRef.current === index ? 1 : 0);
      const current = currentRef.current[index] || 0;
      const next = current + (target - current) * interpolation;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;
      currentRef.current[index] = value;
      element.style.setProperty("--effect", value.toFixed(4));
      if (!settled) moving = true;
    });

    animationRef.current = moving ? window.requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    lastFrameRef.current = performance.now();
    animationRef.current = window.requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback((event) => {
    const list = listRef.current;
    if (!list || reduceMotionRef.current) return;
    const bounds = list.getBoundingClientRect();
    const pointerY = event.clientY - bounds.top;
    const ease = falloffCurves[falloff] ?? falloffCurves.linear;

    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const center = element.offsetTop + element.offsetHeight / 2;
      const distance = Math.abs(pointerY - center);
      targetsRef.current[index] = ease(Math.max(0, 1 - distance / proximityRadius));
    });
    startLoop();
  }, [falloff, proximityRadius, startLoop]);

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const handleClick = useCallback((index, label) => {
    setActiveIndex(index);
    onItemClick?.(index, label);
  }, [onItemClick]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (event) => {
      reduceMotionRef.current = event.matches;
      startLoop();
    };
    reduceMotionRef.current = motionQuery.matches;
    motionQuery.addEventListener("change", updatePreference);
    return () => motionQuery.removeEventListener("change", updatePreference);
  }, [startLoop]);

  useEffect(() => {
    startLoop();
  }, [activeIndex, startLoop]);

  useEffect(() => () => {
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }, []);

  return (
    <nav
      aria-label={ariaLabel}
      className={`line-sidebar${showMarker ? " line-sidebar--markers" : ""}${scaleTick ? " line-sidebar--scale-tick" : ""}${className ? ` ${className}` : ""}`}
      style={{
        "--accent-color": accentColor,
        "--text-color": textColor,
        "--marker-color": markerColor,
        "--marker-length": `${markerLength}px`,
        "--marker-gap": `${markerGap}px`,
        "--tick-scale": tickScale,
        "--max-shift": `${maxShift}px`,
        "--item-gap": `${itemGap}px`,
        "--font-size": `${fontSize}rem`,
        "--smoothing": `${smoothing}ms`,
      }}
    >
      <ul ref={listRef} className="line-sidebar__list" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        {items.map((label, index) => (
          <li
            key={`${label}-${index}`}
            ref={(element) => { itemRefs.current[index] = element; }}
            className="line-sidebar__item"
          >
            {showMarker && <span className="line-sidebar__marker" aria-hidden="true" />}
            <button
              type="button"
              className="line-sidebar__label"
              aria-current={activeIndex === index ? "page" : undefined}
              onClick={() => handleClick(index, label)}
            >
              {showIndex && <span className="line-sidebar__index">{String(index + 1).padStart(2, "0")}</span>}
              <span className="line-sidebar__text">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default LineSidebar;
