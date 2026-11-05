import { Fragment } from "react";

/**
 * Keeps localized copy static while preserving intentional line breaks used by
 * the display headings.
 */
export default function LocalizedDecryptedText({ text }) {
  if (typeof text !== "string") return text;

  return text.split("\n").map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}
