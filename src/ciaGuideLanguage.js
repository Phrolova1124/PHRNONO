const locales = new Set(["zh", "en", "ja"]);

function explicitLanguage(message) {
  if (/(?:用|以)(?:英文|英语)(?:回答|回复|说)|(?:answer|reply|respond|speak)\s+(?:to\s+me\s+)?in\s+english|英語で(?:答|返|話)/iu.test(message)) return "en";
  if (/(?:用|以)(?:中文|华语|汉语)(?:回答|回复|说)|(?:answer|reply|respond|speak)\s+(?:to\s+me\s+)?in\s+(?:chinese|mandarin)|中国語で(?:答|返|話)/iu.test(message)) return "zh";
  if (/(?:用|以)(?:日文|日语)(?:回答|回复|说)|(?:answer|reply|respond|speak)\s+(?:to\s+me\s+)?in\s+japanese|日本語で(?:答|返|話)/iu.test(message)) return "ja";
  return null;
}

function textLanguage(message) {
  const requested = explicitLanguage(message);
  if (requested) return requested;
  if (/[\u3040-\u30ff]/u.test(message)) return "ja";
  if (/[\u3400-\u9fff]/u.test(message)) return "zh";
  // A short name/number/acknowledgement is ambiguous; keep the conversation's
  // language. A real English sentence must not inherit the page's Chinese UI.
  if (/\b(?:hello|hi|hey|thanks|thank\s+you|who|what|why|how|where|can|could|would|please|show|take|open|want|tell|explain|help|music|story|works?|portfolio)\b/iu.test(message)
    || /\b[a-z]{2,}\s+[a-z]{2,}\b/iu.test(message)) return "en";
  return null;
}

export function getCiaReplyLocale(message, pageLocale = "zh", history = []) {
  const detected = textLanguage(typeof message === "string" ? message : "");
  if (detected) return detected;
  for (const turn of [...(Array.isArray(history) ? history : [])].reverse()) {
    if (turn?.role !== "visitor" || typeof turn.body !== "string") continue;
    const previous = textLanguage(turn.body);
    if (previous) return previous;
  }
  return locales.has(pageLocale) ? pageLocale : "zh";
}
