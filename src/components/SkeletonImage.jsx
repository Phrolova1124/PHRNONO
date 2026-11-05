import { forwardRef, useEffect, useRef, useState } from "react";
import "./SkeletonImage.css";

const SkeletonImage = forwardRef(function SkeletonImage(
  {
    src,
    alt,
    className = "",
    shimmer = false,
    onLoad,
    onError,
    ...props
  },
  forwardedRef,
) {
  const imageRef = useRef(null);
  const [loadedSource, setLoadedSource] = useState("");
  const [failedSource, setFailedSource] = useState("");
  const state = failedSource === src ? "error" : loadedSource === src ? "loaded" : "loading";

  const assignRef = (node) => {
    imageRef.current = node;

    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  useEffect(() => {
    const image = imageRef.current;

    if (!image || image.getAttribute("src") !== src || !image.complete) return;

    if (image.naturalWidth > 0) {
      setLoadedSource(src);
      setFailedSource("");
    } else {
      setFailedSource(src);
    }
  }, [src]);

  const handleLoad = (event) => {
    if (event.currentTarget.getAttribute("src") === src) {
      setLoadedSource(src);
      setFailedSource("");
    }

    onLoad?.(event);
  };

  const handleError = (event) => {
    if (event.currentTarget.getAttribute("src") === src) {
      setFailedSource(src);
    }

    onError?.(event);
  };

  return (
    <img
      ref={assignRef}
      className={className}
      src={src}
      alt={alt}
      data-media-state={state}
      data-media-shimmer={shimmer ? "true" : undefined}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
});

export default SkeletonImage;
