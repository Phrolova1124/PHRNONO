import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import "./FlowingMenu.css";

function distance(x, y, x2, y2) {
  const xDiff = x - x2;
  const yDiff = y - y2;
  return xDiff * xDiff + yDiff * yDiff;
}

function closestEdge(mouseX, mouseY, width, height) {
  return distance(mouseX, mouseY, width / 2, 0) < distance(mouseX, mouseY, width / 2, height)
    ? "top"
    : "bottom";
}

function MenuItem({
  item,
  index,
  speed,
  textColor,
  marqueeBgColor,
  marqueeTextColor,
  borderColor,
  reducedMotion,
  onItemClick,
}) {
  const itemRef = useRef(null);
  const marqueeRef = useRef(null);
  const marqueeInnerRef = useRef(null);
  const animationRef = useRef(null);
  const [repetitions, setRepetitions] = useState(4);

  useEffect(() => {
    const calculateRepetitions = () => {
      if (!marqueeInnerRef.current) return;
      const content = marqueeInnerRef.current.querySelector(".flowing-menu__part");
      if (!content || content.offsetWidth === 0) return;
      setRepetitions(Math.max(4, Math.ceil(window.innerWidth / content.offsetWidth) + 2));
    };

    calculateRepetitions();
    window.addEventListener("resize", calculateRepetitions);
    return () => window.removeEventListener("resize", calculateRepetitions);
  }, [item.text, item.image]);

  useEffect(() => {
    const setupMarquee = () => {
      if (!marqueeInnerRef.current || reducedMotion) return;
      const content = marqueeInnerRef.current.querySelector(".flowing-menu__part");
      if (!content || content.offsetWidth === 0) return;

      animationRef.current?.kill();
      animationRef.current = gsap.to(marqueeInnerRef.current, {
        x: -content.offsetWidth,
        duration: speed,
        ease: "none",
        repeat: -1,
      });
    };

    const timer = window.setTimeout(setupMarquee, 50);
    return () => {
      window.clearTimeout(timer);
      animationRef.current?.kill();
      animationRef.current = null;
    };
  }, [item.text, item.image, repetitions, reducedMotion, speed]);

  const handleMouseEnter = (event) => {
    if (reducedMotion || !itemRef.current || !marqueeRef.current || !marqueeInnerRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const edge = closestEdge(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    gsap.timeline({ defaults: { duration: 0.6, ease: "expo" } })
      .set(marqueeRef.current, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .set(marqueeInnerRef.current, { y: edge === "top" ? "101%" : "-101%" }, 0)
      .to([marqueeRef.current, marqueeInnerRef.current], { y: "0%" }, 0);
  };

  const handleMouseLeave = (event) => {
    if (reducedMotion || !itemRef.current || !marqueeRef.current || !marqueeInnerRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const edge = closestEdge(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    gsap.timeline({ defaults: { duration: 0.6, ease: "expo" } })
      .to(marqueeRef.current, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .to(marqueeInnerRef.current, { y: edge === "top" ? "101%" : "-101%" }, 0);
  };

  return (
    <div
      className={`flowing-menu__item${item.active ? " is-active" : ""}`}
      ref={itemRef}
      style={{ borderColor }}
    >
      <a
        className="flowing-menu__item-link"
        href={item.link}
        aria-current={item.active ? "true" : undefined}
        onClick={(event) => {
          if (!onItemClick) return;
          event.preventDefault();
          onItemClick(index);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ color: textColor }}
      >
        {item.text}
      </a>
      <div className="flowing-menu__marquee" ref={marqueeRef} style={{ backgroundColor: marqueeBgColor }} aria-hidden="true">
        <div className="flowing-menu__inner-wrap">
          <div className="flowing-menu__inner" ref={marqueeInnerRef}>
            {[...Array(repetitions)].map((_, repetition) => (
              <div className="flowing-menu__part" key={repetition} style={{ color: marqueeTextColor }}>
                <span>{item.text}</span>
                <div className="flowing-menu__img" style={{ backgroundImage: `url(${item.image})` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlowingMenu({
  items = [],
  speed = 15,
  textColor = "#fbfbf8",
  bgColor = "#0c0e0c",
  marqueeBgColor = "#d6f438",
  marqueeTextColor = "#0c0e0c",
  borderColor = "rgba(251, 251, 248, 0.35)",
  reducedMotion = false,
  onItemClick,
  ariaLabel = "Work categories",
}) {
  return (
    <div className="flowing-menu-wrap" style={{ backgroundColor: bgColor }}>
      <nav className="flowing-menu" aria-label={ariaLabel}>
        {items.map((item, index) => (
          <MenuItem
            key={item.text}
            item={item}
            index={index}
            speed={speed}
            textColor={textColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={borderColor}
            reducedMotion={reducedMotion}
            onItemClick={onItemClick}
          />
        ))}
      </nav>
    </div>
  );
}
