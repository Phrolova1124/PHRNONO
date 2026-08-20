import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function revealOrder(length, direction) {
  if (direction === "end") return Array.from({ length }, (_, index) => length - 1 - index);
  if (direction !== "center") return Array.from({ length }, (_, index) => index);

  const order = [];
  const middle = Math.floor((length - 1) / 2);
  for (let offset = 0; order.length < length; offset += 1) {
    const right = middle + offset;
    const left = middle - offset - 1;
    if (right < length) order.push(right);
    if (left >= 0 && order.length < length) order.push(left);
  }
  return order;
}

/**
 * A React Bits-inspired text decrypt effect. The original copy remains the
 * accessible label while the visual characters animate independently.
 */
export default function DecryptedText({
  text = "",
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "hover",
  clickMode = "once",
  ...props
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const intervalRef = useRef(null);
  const [displayText, setDisplayText] = useState(text);
  const [revealed, setRevealed] = useState(() => new Set(Array.from({ length: text.length }, (_, index) => index)));
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(true);
  const [hasViewed, setHasViewed] = useState(false);

  const availableChars = useMemo(() => {
    const source = useOriginalCharsOnly
      ? [...new Set(Array.from(text).filter((character) => !/\s/.test(character)))].join("")
      : characters;
    return Array.from(source || characters);
  }, [characters, text, useOriginalCharsOnly]);

  const scramble = useCallback((revealedIndices = new Set()) => (
    Array.from(text, (character, index) => {
      if (/\s/.test(character) || revealedIndices.has(index)) return character;
      return availableChars[Math.floor(Math.random() * availableChars.length)] ?? character;
    }).join("")
  ), [availableChars, text]);

  const stop = useCallback(() => {
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsAnimating(false);
  }, []);

  const showPlainText = useCallback(() => {
    stop();
    setDisplayText(text);
    setRevealed(new Set(Array.from({ length: text.length }, (_, index) => index)));
    setIsDecrypted(true);
  }, [stop, text]);

  const decrypt = useCallback(() => {
    if (reduceMotion || isAnimating || !text) {
      showPlainText();
      return;
    }

    const startingSet = new Set();
    const order = revealOrder(text.length, revealDirection);
    let pointer = 0;
    let iteration = 0;

    setRevealed(startingSet);
    setDisplayText(scramble(startingSet));
    setIsDecrypted(false);
    setIsAnimating(true);
    window.clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      if (sequential) {
        const next = new Set(order.slice(0, pointer + 1));
        pointer += 1;
        setRevealed(next);
        setDisplayText(scramble(next));
        if (pointer >= order.length) showPlainText();
        return;
      }

      iteration += 1;
      setDisplayText(scramble(startingSet));
      if (iteration >= maxIterations) showPlainText();
    }, Math.max(16, speed));
  }, [isAnimating, maxIterations, reduceMotion, revealDirection, scramble, sequential, showPlainText, speed, text]);

  const encrypt = useCallback(() => {
    if (reduceMotion || isAnimating || !text) return;
    const order = revealOrder(text.length, revealDirection).reverse();
    let pointer = 0;
    let iteration = 0;
    let current = new Set(Array.from({ length: text.length }, (_, index) => index));

    setRevealed(current);
    setDisplayText(text);
    setIsDecrypted(true);
    setIsAnimating(true);
    window.clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      if (!sequential) {
        iteration += 1;
        const encrypted = new Set();
        setRevealed(encrypted);
        setDisplayText(scramble(encrypted));
        if (iteration >= maxIterations) {
          stop();
          setIsDecrypted(false);
        }
        return;
      }

      current = new Set(current);
      current.delete(order[pointer]);
      pointer += 1;
      setRevealed(current);
      setDisplayText(scramble(current));
      if (pointer >= order.length) {
        stop();
        setIsDecrypted(false);
      }
    }, Math.max(16, speed));
  }, [isAnimating, maxIterations, reduceMotion, revealDirection, scramble, sequential, speed, stop, text]);

  useEffect(() => {
    showPlainText();
    setHasViewed(false);
    return () => window.clearInterval(intervalRef.current);
  }, [showPlainText]);

  useEffect(() => {
    if (animateOn !== "view" && animateOn !== "inViewHover") return undefined;
    if (reduceMotion) return undefined;

    const element = containerRef.current;
    if (!element) return undefined;
    if (!("IntersectionObserver" in window)) {
      decrypt();
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !hasViewed) {
        setHasViewed(true);
        decrypt();
      }
    }, { threshold: 0.16 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [animateOn, decrypt, hasViewed, reduceMotion]);

  const onClick = () => {
    if (animateOn !== "click") return;
    if (clickMode === "toggle" && isDecrypted) encrypt();
    else decrypt();
  };

  const onKeyDown = (event) => {
    if (animateOn !== "click" || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick();
  };

  const interactionProps = animateOn === "hover" || animateOn === "inViewHover"
    ? {
        onMouseEnter: decrypt,
        onMouseLeave: showPlainText,
      }
    : animateOn === "click"
      ? {
          onClick,
          onKeyDown,
          role: "button",
          tabIndex: 0,
        }
      : {};

  return (
    <motion.span
      ref={containerRef}
      className={parentClassName}
      style={{ display: "inline-block", whiteSpace: "pre-wrap" }}
      {...interactionProps}
      {...props}
    >
      <span style={visuallyHidden}>{text}</span>
      <span aria-hidden="true">
        {Array.from(displayText).map((character, index) => (
          <span key={`${character}-${index}`} className={revealed.has(index) || (!isAnimating && isDecrypted) ? className : encryptedClassName}>
            {character}
          </span>
        ))}
      </span>
    </motion.span>
  );
}
