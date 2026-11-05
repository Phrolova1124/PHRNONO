import { useEffect } from "react";

// Openings and route transitions can overlap while entering /admin. Only the
// last overlay to leave may restore scrolling, regardless of unmount order.
let locks = 0;
let previousHtmlOverflow = "";
let previousBodyOverflow = "";

export default function useDocumentScrollLock() {
  useEffect(() => {
    if (locks === 0) {
      previousHtmlOverflow = document.documentElement.style.overflow;
      previousBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, []);
}
