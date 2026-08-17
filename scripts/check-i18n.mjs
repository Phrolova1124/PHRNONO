import { translations } from "../src/i18n.js";

function flattenShape(value, path = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenShape(item, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => flattenShape(item, path ? `${path}.${key}` : key));
  }
  return [path];
}

const baseKeys = new Set(flattenShape(translations.zh));
let failed = false;

for (const [locale, copy] of Object.entries(translations)) {
  const keys = new Set(flattenShape(copy));
  const missing = [...baseKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baseKeys.has(key));
  console.log(`${locale}: keys=${keys.size} missing=${missing.length} extra=${extra.length}`);
  if (missing.length || extra.length) {
    failed = true;
    console.error({ locale, missing, extra });
  }
}

if (failed) process.exitCode = 1;

