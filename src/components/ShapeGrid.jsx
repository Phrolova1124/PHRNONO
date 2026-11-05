import { useEffect, useRef } from "react";
import "./ShapeGrid.css";

function ShapeGrid({
  direction = "right",
  speed = 1,
  borderColor = "#999",
  squareSize = 40,
  hoverFillColor = "#222",
  shape = "square",
  hoverTrailAmount = 0,
  className = "",
}) {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const gridOffset = useRef({ x: 0, y: 0 });
  const hoveredSquare = useRef(null);
  const trailCells = useRef([]);
  const cellOpacities = useRef(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const isHex = shape === "hexagon";
    const isTriangle = shape === "triangle";
    const hexHorizontal = squareSize * 1.5;
    const hexVertical = squareSize * Math.sqrt(3);
    let isVisible = false;
    let isPageVisible = !document.hidden;
    let motionAllowed = !motionQuery.matches && speed > 0;

    const resizeCanvas = () => {
      const nextWidth = canvas.offsetWidth;
      const nextHeight = canvas.offsetHeight;

      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      drawGrid();
    };

    const drawHex = (centerX, centerY, size) => {
      context.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index;
        const vertexX = centerX + size * Math.cos(angle);
        const vertexY = centerY + size * Math.sin(angle);
        if (index === 0) context.moveTo(vertexX, vertexY);
        else context.lineTo(vertexX, vertexY);
      }
      context.closePath();
    };

    const drawCircle = (centerX, centerY, size) => {
      context.beginPath();
      context.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      context.closePath();
    };

    const drawTriangle = (centerX, centerY, size, flip) => {
      context.beginPath();
      if (flip) {
        context.moveTo(centerX, centerY + size / 2);
        context.lineTo(centerX + size / 2, centerY - size / 2);
        context.lineTo(centerX - size / 2, centerY - size / 2);
      } else {
        context.moveTo(centerX, centerY - size / 2);
        context.lineTo(centerX + size / 2, centerY + size / 2);
        context.lineTo(centerX - size / 2, centerY + size / 2);
      }
      context.closePath();
    };

    const paintCell = (key, drawShape) => {
      const alpha = cellOpacities.current.get(key);
      if (alpha) {
        context.globalAlpha = alpha;
        drawShape();
        context.fillStyle = hoverFillColor;
        context.fill();
        context.globalAlpha = 1;
      }
      drawShape();
      context.strokeStyle = borderColor;
      context.stroke();
    };

    function drawGrid() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 1;

      if (isHex) {
        const columnShift = Math.floor(gridOffset.current.x / hexHorizontal);
        const offsetX = ((gridOffset.current.x % hexHorizontal) + hexHorizontal) % hexHorizontal;
        const offsetY = ((gridOffset.current.y % hexVertical) + hexVertical) % hexVertical;
        const columns = Math.ceil(canvas.width / hexHorizontal) + 3;
        const rows = Math.ceil(canvas.height / hexVertical) + 3;

        for (let column = -2; column < columns; column += 1) {
          for (let row = -2; row < rows; row += 1) {
            const centerX = column * hexHorizontal + offsetX;
            const centerY = row * hexVertical + ((column + columnShift) % 2 !== 0 ? hexVertical / 2 : 0) + offsetY;
            paintCell(`${column},${row}`, () => drawHex(centerX, centerY, squareSize));
          }
        }
        return;
      }

      if (isTriangle) {
        const halfWidth = squareSize / 2;
        const columnShift = Math.floor(gridOffset.current.x / halfWidth);
        const rowShift = Math.floor(gridOffset.current.y / squareSize);
        const offsetX = ((gridOffset.current.x % halfWidth) + halfWidth) % halfWidth;
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        const columns = Math.ceil(canvas.width / halfWidth) + 4;
        const rows = Math.ceil(canvas.height / squareSize) + 4;

        for (let column = -2; column < columns; column += 1) {
          for (let row = -2; row < rows; row += 1) {
            const centerX = column * halfWidth + offsetX;
            const centerY = row * squareSize + squareSize / 2 + offsetY;
            const flip = ((column + columnShift + row + rowShift) % 2 + 2) % 2 !== 0;
            paintCell(`${column},${row}`, () => drawTriangle(centerX, centerY, squareSize, flip));
          }
        }
        return;
      }

      const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize;
      const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
      const columns = Math.ceil(canvas.width / squareSize) + 3;
      const rows = Math.ceil(canvas.height / squareSize) + 3;

      for (let column = -2; column < columns; column += 1) {
        for (let row = -2; row < rows; row += 1) {
          const centerX = column * squareSize + squareSize / 2 + offsetX;
          const centerY = row * squareSize + squareSize / 2 + offsetY;
          const key = `${column},${row}`;

          if (shape === "circle") {
            paintCell(key, () => drawCircle(centerX, centerY, squareSize));
          } else {
            const squareX = column * squareSize + offsetX;
            const squareY = row * squareSize + offsetY;
            const alpha = cellOpacities.current.get(key);
            if (alpha) {
              context.globalAlpha = alpha;
              context.fillStyle = hoverFillColor;
              context.fillRect(squareX, squareY, squareSize, squareSize);
              context.globalAlpha = 1;
            }
            context.strokeStyle = borderColor;
            context.strokeRect(squareX, squareY, squareSize, squareSize);
          }
        }
      }
    }

    const updateCellOpacities = () => {
      const targets = new Map();

      if (hoveredSquare.current) {
        targets.set(`${hoveredSquare.current.x},${hoveredSquare.current.y}`, 1);
      }

      if (hoverTrailAmount > 0) {
        trailCells.current.forEach((cell, index) => {
          const key = `${cell.x},${cell.y}`;
          if (!targets.has(key)) {
            targets.set(key, (trailCells.current.length - index) / (trailCells.current.length + 1));
          }
        });
      }

      targets.forEach((unused, key) => {
        if (!cellOpacities.current.has(key)) cellOpacities.current.set(key, 0);
      });

      cellOpacities.current.forEach((opacity, key) => {
        const target = targets.get(key) || 0;
        const next = opacity + (target - opacity) * 0.15;
        if (next < 0.005) cellOpacities.current.delete(key);
        else cellOpacities.current.set(key, next);
      });
    };

    const updateAnimation = () => {
      const effectiveSpeed = Math.max(speed, 0.1);
      const wrapX = isHex ? hexHorizontal * 2 : squareSize;
      const wrapY = isHex ? hexVertical : isTriangle ? squareSize * 2 : squareSize;

      if (direction === "right") gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX;
      if (direction === "left") gridOffset.current.x = (gridOffset.current.x + effectiveSpeed + wrapX) % wrapX;
      if (direction === "up") gridOffset.current.y = (gridOffset.current.y + effectiveSpeed + wrapY) % wrapY;
      if (direction === "down") gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY;
      if (direction === "diagonal") {
        gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX;
        gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY;
      }

      updateCellOpacities();
      drawGrid();
      requestRef.current = window.requestAnimationFrame(updateAnimation);
    };

    const stop = () => {
      if (requestRef.current) {
        window.cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };

    const start = () => {
      if (isVisible && isPageVisible && motionAllowed && !requestRef.current) {
        requestRef.current = window.requestAnimationFrame(updateAnimation);
      } else if (isVisible && !motionAllowed) {
        updateCellOpacities();
        drawGrid();
      }
    };

    const addTrailCell = () => {
      if (!hoveredSquare.current || hoverTrailAmount <= 0) return;
      trailCells.current.unshift({ ...hoveredSquare.current });
      if (trailCells.current.length > hoverTrailAmount) trailCells.current.length = hoverTrailAmount;
    };

    const setHoveredCell = (column, row) => {
      if (hoveredSquare.current?.x === column && hoveredSquare.current?.y === row) return;
      addTrailCell();
      hoveredSquare.current = { x: column, y: row };
      if (!motionAllowed) {
        updateCellOpacities();
        drawGrid();
      }
    };

    const handleMouseMove = (event) => {
      const bounds = canvas.getBoundingClientRect();
      const mouseX = event.clientX - bounds.left;
      const mouseY = event.clientY - bounds.top;

      if (isHex) {
        const columnShift = Math.floor(gridOffset.current.x / hexHorizontal);
        const offsetX = ((gridOffset.current.x % hexHorizontal) + hexHorizontal) % hexHorizontal;
        const offsetY = ((gridOffset.current.y % hexVertical) + hexVertical) % hexVertical;
        const column = Math.round((mouseX - offsetX) / hexHorizontal);
        const rowOffset = (column + columnShift) % 2 !== 0 ? hexVertical / 2 : 0;
        const row = Math.round((mouseY - offsetY - rowOffset) / hexVertical);
        setHoveredCell(column, row);
        return;
      }

      if (isTriangle) {
        const halfWidth = squareSize / 2;
        const offsetX = ((gridOffset.current.x % halfWidth) + halfWidth) % halfWidth;
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        setHoveredCell(Math.round((mouseX - offsetX) / halfWidth), Math.floor((mouseY - offsetY) / squareSize));
        return;
      }

      const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize;
      const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
      const method = shape === "circle" ? Math.round : Math.floor;
      setHoveredCell(method((mouseX - offsetX) / squareSize), method((mouseY - offsetY) / squareSize));
    };

    const handleMouseLeave = () => {
      addTrailCell();
      hoveredSquare.current = null;
      if (!motionAllowed) {
        updateCellOpacities();
        drawGrid();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) start();
      else stop();
    });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => resizeCanvas());

    const handleVisibility = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) start();
      else stop();
    };

    const handleMotionChange = (event) => {
      motionAllowed = !event.matches && speed > 0;
      if (motionAllowed) start();
      else {
        stop();
        drawGrid();
      }
    };

    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery.addEventListener("change", handleMotionChange);
    observer.observe(canvas);
    resizeObserver?.observe(canvas);
    resizeCanvas();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      motionQuery.removeEventListener("change", handleMotionChange);
      observer.disconnect();
      resizeObserver?.disconnect();
      stop();
    };
  }, [direction, speed, borderColor, hoverFillColor, squareSize, shape, hoverTrailAmount]);

  return <canvas ref={canvasRef} className={`shapegrid-canvas ${className}`} aria-hidden="true" />;
}

export default ShapeGrid;
