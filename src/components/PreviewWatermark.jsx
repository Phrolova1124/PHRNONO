import "./PreviewWatermark.css";

const watermarkRows = [0, 1, 2, 3, 4];

/**
 * A visible protection marker for public, low-resolution previews. The
 * original asset is never used here: the Worker keeps it private in R2 and
 * exposes it only through the authenticated owner endpoint.
 */
export default function PreviewWatermark({ label = "PHRNONO / PREVIEW ONLY" }) {
  const text = typeof label === "string" && label.trim() ? label.trim() : "PHRNONO / PREVIEW ONLY";

  return (
    <span className="preview-watermark" aria-hidden="true">
      {watermarkRows.map((row) => (
        <span key={row}>{text} · {text} · {text}</span>
      ))}
    </span>
  );
}
