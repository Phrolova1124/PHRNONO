import { getCiaGuideInstructions } from "./ciaGuideKnowledge.js";
import { getCiaReplyLocale } from "../src/ciaGuideLanguage.js";
import { completeContactDelivery, getOperationsOverview, handleAdminOperations, recordSecurityEvent, saveContactSubmission } from "./adminOperations.js";

const visitorApiPath = "/api/visitors";
const visitorCounterName = "phrnono";
const visitorTimeZone = "Asia/Taipei";
const musicTrackPath = "/music/tracks/";
const musicCacheControl = "public, max-age=3600, must-revalidate";
const authLoginPath = "/api/auth/login";
const authLogoutPath = "/api/auth/logout";
const authSessionPath = "/api/auth/session";
const adminOverviewPath = "/api/admin/overview";
const adminAnalyticsResetPath = "/api/admin/analytics/reset";
const analyticsEventsPath = "/api/analytics/events";
const contactApiPath = "/api/contact";
const ciaGuideApiPath = "/api/cia-guide";
const publicContentPath = "/api/content/";
const publicMediaPath = "/api/media/";
const adminContentPath = "/api/admin/content/";
const adminMediaPath = "/api/admin/media";
const adminMultipartMediaPath = "/api/admin/media/multipart";
const adminCookieName = "__Host-phrnono_admin";
const adminSessionLifetimeSeconds = 60 * 60 * 8;
const authLimiterName = "phrnono-admin-auth";
const ciaGuideLimiterName = "phrnono-cia-guide";
const ciaGuideModel = "@cf/zai-org/glm-4.7-flash";
const authWindowMs = 15 * 60 * 1000;
const authMaxFailures = 5;
const ciaGuideWindowMs = 10 * 60 * 1000;
const ciaGuideMaxRequests = 12;
// A conservative site-wide ceiling bounds this guide's demand. Workers AI's
// free allocation is shared across the account; this does not reserve quota
// consumed by other services or guarantee zero overage on a paid plan.
const ciaGuideDailyMaxRequests = 180;
const ciaGuideDailyLimiterName = "phrnono-cia-guide-daily";
const authBodyMaxBytes = 8 * 1024;
const ciaGuideBodyMaxBytes = 8 * 1024;
const ciaGuideMessageMaxLength = 900;
const ciaGuideHistoryMaxMessages = 4;
const ciaGuideHistoryMessageMaxLength = 600;
const ciaGuideOutputMaxLength = 4000;
const ciaGuideResponseTimeoutMs = 15000;
const contentBodyMaxBytes = 96 * 1024;
const contactBodyMaxBytes = 16 * 1024;
const contactMessageMaxLength = 5000;
const contactNameMaxLength = 120;
const contactEmailMaxLength = 320;
const analyticsEventMaxBytes = 4 * 1024;
const analyticsSlugPattern = /^[a-z0-9][a-z0-9/_-]{0,99}$/iu;
const analyticsEventTypes = new Set(["cv_download", "work_click", "work_dwell"]);
const analyticsDwellMaxSeconds = 60 * 60;
const visitorAnalyticsResetPageSize = 1000;
const visitorAnalyticsStoragePrefixes = ["day:", "event:", "visitor:"];
const ciaGuideLocales = new Set(["zh", "en", "ja"]);
const ciaGuideContexts = new Set(["home", "about", "work", "work-case-study", "game-wall", "music", "character", "character-story"]);
// Keep a comfortable margin below R2's free 10 GB storage allowance.  Uploads
// are manual-owner actions only; there is no background importer or sync job.
const mediaUploadMaxBytes = 20 * 1024 * 1024;
const mediaStorageQuotaBytes = 8 * 1024 * 1024 * 1024;
const multipartOverheadMaxBytes = 128 * 1024;
// A 16 MiB part keeps every request comfortably below the Worker inbound
// limit, while still allowing a 500 MiB file to finish in just 32 parts.
const multipartPartSizeBytes = 16 * 1024 * 1024;
const multipartUploadMaxBytes = 500 * 1024 * 1024;
const multipartSessionLifetimeMs = 24 * 60 * 60 * 1000;
const multipartMaxParts = Math.ceil(multipartUploadMaxBytes / multipartPartSizeBytes);
const contentListMax = 100;
const adminContentListMax = 200;
const publicContentCacheControl = "public, max-age=60, must-revalidate";
const publicMediaCacheControl = "public, max-age=31536000, immutable";
const contentCollections = new Set(["works", "game-wall", "music"]);
const contentStatuses = new Set(["draft", "published"]);
const contentCollectionAliases = new Map([["work", "works"], ["works", "works"], ["game-wall", "game-wall"], ["music", "music"]]);
const contentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const contentSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const workCategories = new Set(["3D SCENE", "3D PROP", "ILLUSTRATION", "CHARACTER"]);
const gameWallGroups = new Set(["collection", "sunlit", "starlight", "shoreline", "scarlet", "garden"]);
const gameWallShapes = new Set(["feature", "wide", "tall", "standard"]);
const mediaMimeDetails = new Map([
  ["image/jpeg", { kind: "image", extension: "jpg", aliases: ["image/pjpeg"] }],
  ["image/png", { kind: "image", extension: "png", aliases: [] }],
  ["image/vnd.adobe.photoshop", { kind: "image", extension: "psd", aliases: ["image/x-photoshop", "application/x-photoshop"] }],
  ["image/webp", { kind: "image", extension: "webp", aliases: [] }],
  ["image/gif", { kind: "image", extension: "gif", aliases: [] }],
  ["image/avif", { kind: "image", extension: "avif", aliases: [] }],
  ["audio/mpeg", { kind: "audio", extension: "mp3", aliases: ["audio/mp3"] }],
  ["audio/mp4", { kind: "audio", extension: "m4a", aliases: ["audio/x-m4a", "audio/m4a"] }],
  ["audio/ogg", { kind: "audio", extension: "ogg", aliases: ["application/ogg"] }],
  ["audio/wav", { kind: "audio", extension: "wav", aliases: ["audio/x-wav", "audio/wave"] }],
  ["audio/aac", { kind: "audio", extension: "aac", aliases: [] }],
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const jsonHeaders = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store",
};
const securityHeaders = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' https:",
    "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "script-src 'self' https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  ].join("; "),
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!headers.has(name)) headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getCounterDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: visitorTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function counterValue(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function methodNotAllowed(allowed) {
  return new Response(null, {
    status: 405,
    headers: { ...jsonHeaders, allow: allowed },
  });
}

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;

  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

async function hmacBytes(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
}

async function signSessionValue(secret, value) {
  return base64UrlEncode(await hmacBytes(secret, value));
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return "";

  for (const entry of cookieHeader.split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function adminConfigured(env) {
  return [env.ADMIN_EMAIL, env.ADMIN_PASSWORD, env.ADMIN_SESSION_KEY, env.AUTH_RATE_LIMIT_KEY]
    .every((value) => typeof value === "string" && value.length > 0);
}

function ciaGuideConfigured(env) {
  return typeof env.CIA_GUIDE_RATE_LIMIT_KEY === "string"
    && env.CIA_GUIDE_RATE_LIMIT_KEY.trim().length > 0
    && typeof env.AI?.run === "function";
}

async function readJsonRequest(request, maxBytes = authBodyMaxBytes) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return { error: "Request is too large.", status: 413 };

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return { error: "Expected JSON.", status: 415 };

  const rawBody = await request.text();
  if (textEncoder.encode(rawBody).byteLength > maxBytes) return { error: "Request is too large.", status: 413 };

  try {
    return { value: JSON.parse(rawBody) };
  } catch {
    return { error: "Invalid request.", status: 400 };
  }
}

async function credentialsMatch(env, email, password) {
  const [submittedEmail, configuredEmail, submittedPassword, configuredPassword] = await Promise.all([
    sha256(email),
    sha256(env.ADMIN_EMAIL),
    sha256(password),
    sha256(env.ADMIN_PASSWORD),
  ]);

  return constantTimeEqual(submittedEmail, configuredEmail) && constantTimeEqual(submittedPassword, configuredPassword);
}

async function getRateLimitKey(request, env, scope = "auth") {
  const forwarded = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  return base64UrlEncode(await hmacBytes(env.AUTH_RATE_LIMIT_KEY, `${scope}:${forwarded}`));
}

async function getCiaGuideClientHash(request, env) {
  const client = request.headers.get("cf-connecting-ip") ?? "unknown";
  // Rotate the opaque identifier every limiter window. Only the count and its
  // expiry are stored; neither the identifier nor the IP goes to the model.
  const window = Math.floor(Date.now() / ciaGuideWindowMs);
  return base64UrlEncode(await hmacBytes(env.CIA_GUIDE_RATE_LIMIT_KEY, `cia-guide:v2:${window}:${client}`));
}

async function useAuthLimiter(request, env, outcome, scope = "auth") {
  const limiter = env.AUTH_LIMITER?.getByName(authLimiterName);
  if (!limiter) return null;

  try {
    const key = await getRateLimitKey(request, env, scope);
    const limiterResponse = await limiter.fetch(new Request("https://auth-limiter.internal/attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, outcome }),
    }));
    if (!limiterResponse.ok) return null;

    const result = await limiterResponse.json();
    if (typeof result?.allowed !== "boolean") return null;
    return result;
  } catch {
    return null;
  }
}

async function useCiaGuideLimiter(request, env) {
  try {
    const clientHash = await getCiaGuideClientHash(request, env);
    const limiter = env.CIA_GUIDE_LIMITER?.getByName(clientHash);
    if (!limiter) return null;
    const limiterResponse = await limiter.fetch(new Request("https://cia-guide-limiter.internal/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: clientHash }),
    }));
    if (!limiterResponse.ok) return null;

    const result = await limiterResponse.json();
    if (typeof result?.allowed !== "boolean") return null;
    return { ...result, clientHash };
  } catch {
    return null;
  }
}

async function useCiaGuideDailyLimiter(env) {
  try {
    const limiter = env.CIA_GUIDE_LIMITER?.getByName(ciaGuideDailyLimiterName);
    if (!limiter) return null;
    const limiterResponse = await limiter.fetch(new Request("https://cia-guide-limiter.internal/daily", {
      method: "POST",
    }));
    if (!limiterResponse.ok) return null;

    const result = await limiterResponse.json();
    if (typeof result?.allowed !== "boolean") return null;
    return result;
  } catch {
    return null;
  }
}

function buildSessionCookie(token, maxAge = adminSessionLifetimeSeconds) {
  return `${adminCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${adminCookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function createAdminSession(env) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = new Uint8Array(18);
  crypto.getRandomValues(nonce);
  const payload = {
    v: 1,
    iat: now,
    exp: now + adminSessionLifetimeSeconds,
    nonce: base64UrlEncode(nonce),
  };
  const encodedPayload = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signSessionValue(env.ADMIN_SESSION_KEY, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function readAdminSession(request, env) {
  if (!adminConfigured(env)) return null;
  const token = readCookie(request, adminCookieName);
  const [encodedPayload, signature, extraSegment] = token.split(".");
  if (!encodedPayload || !signature || extraSegment) return null;

  const payloadBytes = base64UrlDecode(encodedPayload);
  const signatureBytes = base64UrlDecode(signature);
  if (!payloadBytes || !signatureBytes) return null;

  const expectedSignature = await hmacBytes(env.ADMIN_SESSION_KEY, encodedPayload);
  if (!constantTimeEqual(signatureBytes, expectedSignature)) return null;

  try {
    const payload = JSON.parse(textDecoder.decode(payloadBytes));
    if (payload?.v !== 1 || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function publicJsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": publicContentCacheControl,
      ...extraHeaders,
    },
  });
}

function cmsUnavailableResponse() {
  return jsonResponse({ error: "Content management is unavailable." }, 503);
}

function canonicalCollection(value) {
  return typeof value === "string" ? contentCollectionAliases.get(value) ?? null : null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeOptionalText(value, field, maxLength, { allowEmpty = false } = {}) {
  if (value === null) return { value: null };
  if (typeof value !== "string") return { error: `${field} must be text.` };
  const normalized = normalizeText(value);
  if (!allowEmpty && !normalized) return { error: `${field} cannot be empty.` };
  if (normalized.length > maxLength) return { error: `${field} is too long.` };
  return { value: normalized };
}

function normalizeMediaId(value, field) {
  if (value === null) return { value: null };
  if (typeof value !== "string" || !contentIdPattern.test(value)) return { error: `${field} must be a media id.` };
  return { value: value.toLowerCase() };
}

function normalizeExternalUrl(value, field = "externalUrl") {
  if (value === null) return { value: null };
  if (typeof value !== "string" || value.length > 2048) return { error: `${field} must be a valid HTTPS or HTTP URL.` };

  try {
    const url = new URL(value);
    if (!url.hostname || !["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      return { error: `${field} must be a valid HTTPS or HTTP URL.` };
    }
    return { value: url.toString() };
  } catch {
    return { error: `${field} must be a valid HTTPS or HTTP URL.` };
  }
}

function normalizeDuration(value) {
  if (value === null) return { value: null };
  if (typeof value !== "string" || !/^\d{1,3}:[0-5]\d$/u.test(value)) {
    return { error: "duration must use M:SS or MM:SS." };
  }
  return { value };
}

function normalizePublishedAt(value) {
  if (value === null) return { value: null };
  if (typeof value !== "string" || value.length > 64) return { error: "publishedAt must be an ISO date." };
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return { error: "publishedAt must be an ISO date." };
  return { value: new Date(timestamp).toISOString() };
}

function validateCollectionData(collection, value) {
  if (!isPlainObject(value)) return { error: "data must be an object." };

  const allowedFields = {
    works: new Set(["category", "year", "imageMediaId", "sourceMediaId", "watermarkText", "alt", "discipline", "externalUrl"]),
    "game-wall": new Set(["group", "number", "shape", "letterboxed", "thumbnailMediaId", "imageMediaId", "sourceMediaId", "watermarkText"]),
    music: new Set(["artist", "release", "duration", "audioMediaId", "artworkMediaId", "lyrics", "genre"]),
  }[collection];

  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) return { error: `data.${key} is not allowed for ${collection}.` };
  }

  const output = {};
  const copyText = (field, maxLength, options) => {
    if (!hasOwn(value, field)) return null;
    const result = normalizeOptionalText(value[field], `data.${field}`, maxLength, options);
    if (result.error) return result;
    output[field] = result.value;
    return null;
  };
  const copyMediaId = (field) => {
    if (!hasOwn(value, field)) return null;
    const result = normalizeMediaId(value[field], `data.${field}`);
    if (result.error) return result;
    output[field] = result.value;
    return null;
  };

  if (collection === "works") {
    if (hasOwn(value, "category")) {
      if (value.category === null) output.category = null;
      else if (typeof value.category !== "string" || !workCategories.has(value.category)) {
        return { error: "data.category must be one of the supported work categories." };
      } else output.category = value.category;
    }
    if (hasOwn(value, "year")) {
      if (value.year === null) output.year = null;
      else if (typeof value.year !== "string" || !/^(19|20)\d{2}$/u.test(value.year)) return { error: "data.year must be a four-digit year." };
      else output.year = value.year;
    }
    for (const field of ["imageMediaId", "sourceMediaId"]) {
      const result = copyMediaId(field);
      if (result) return result;
    }
    const watermark = copyText("watermarkText", 100);
    if (watermark) return watermark;
    for (const [field, maxLength] of [["alt", 500], ["discipline", 160]]) {
      const result = copyText(field, maxLength);
      if (result) return result;
    }
    if (hasOwn(value, "externalUrl")) {
      const result = normalizeExternalUrl(value.externalUrl);
      if (result.error) return result;
      output.externalUrl = result.value;
    }
  }

  if (collection === "game-wall") {
    if (hasOwn(value, "group")) {
      if (value.group === null) output.group = null;
      else if (typeof value.group !== "string" || !gameWallGroups.has(value.group)) {
        return { error: "data.group must be one of the supported game-wall groups." };
      } else output.group = value.group;
    }
    if (hasOwn(value, "number")) {
      if (value.number === null) output.number = null;
      else if (!Number.isSafeInteger(value.number) || value.number < 0 || value.number > 999999) {
        return { error: "data.number must be a non-negative whole number." };
      } else output.number = value.number;
    }
    if (hasOwn(value, "shape")) {
      if (value.shape === null) output.shape = null;
      else if (typeof value.shape !== "string" || !gameWallShapes.has(value.shape)) {
        return { error: "data.shape must be one of feature, wide, tall, or standard." };
      } else output.shape = value.shape;
    }
    if (hasOwn(value, "letterboxed")) {
      if (value.letterboxed === null) output.letterboxed = null;
      else if (typeof value.letterboxed !== "boolean") return { error: "data.letterboxed must be true or false." };
      else output.letterboxed = value.letterboxed;
    }
    for (const field of ["thumbnailMediaId", "imageMediaId", "sourceMediaId"]) {
      const result = copyMediaId(field);
      if (result) return result;
    }
    const watermark = copyText("watermarkText", 100);
    if (watermark) return watermark;
  }

  if (collection === "music") {
    for (const [field, maxLength] of [["artist", 240], ["release", 320], ["genre", 160], ["lyrics", 24000]]) {
      const result = copyText(field, maxLength, { allowEmpty: field === "lyrics" });
      if (result) return result;
    }
    if (hasOwn(value, "duration")) {
      const result = normalizeDuration(value.duration);
      if (result.error) return result;
      output.duration = result.value;
    }
    for (const field of ["audioMediaId", "artworkMediaId"]) {
      const result = copyMediaId(field);
      if (result) return result;
    }
  }

  return { value: output };
}

function validateContentInput(body, collection, mode) {
  if (!isPlainObject(body)) return { error: "Invalid content request." };
  const allowedFields = new Set(["slug", "title", "summary", "body", "status", "sortOrder", "coverMediaId", "mediaIds", "publishedAt", "data"]);
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return { error: `${key} is not an allowed content field.` };
  }

  const output = {};
  if (hasOwn(body, "slug")) {
    if (typeof body.slug !== "string") return { error: "slug must be lowercase letters, numbers, and hyphens." };
    const slug = body.slug.trim();
    if (!contentSlugPattern.test(slug) || slug.length > 120 || slug !== slug.toLowerCase()) {
      return { error: "slug must be lowercase letters, numbers, and hyphens." };
    }
    output.slug = slug;
  } else if (mode === "create") {
    // The owner UI deliberately keeps the publishing form focused on visible
    // copy.  Generate an opaque but URL-safe slug when it does not send one;
    // callers may still supply a readable slug explicitly.
    output.slug = `entry-${uuid().replaceAll("-", "")}`;
  }

  for (const [field, maxLength] of [["title", 160], ["summary", 1200], ["body", 24000]]) {
    if (!hasOwn(body, field)) continue;
    const result = normalizeOptionalText(body[field], field, maxLength, { allowEmpty: true });
    if (result.error) return result;
    output[field] = result.value ?? "";
  }

  if (hasOwn(body, "status")) {
    if (typeof body.status !== "string" || !contentStatuses.has(body.status)) return { error: "status must be draft or published." };
    output.status = body.status;
  }

  if (hasOwn(body, "sortOrder")) {
    if (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < -1000000 || body.sortOrder > 1000000) {
      return { error: "sortOrder must be a whole number in range." };
    }
    output.sortOrder = body.sortOrder;
  }

  if (hasOwn(body, "coverMediaId")) {
    const result = normalizeMediaId(body.coverMediaId, "coverMediaId");
    if (result.error) return result;
    output.coverMediaId = result.value;
  }

  if (hasOwn(body, "mediaIds")) {
    if (!Array.isArray(body.mediaIds) || body.mediaIds.length > 60) return { error: "mediaIds must contain at most 60 media ids." };
    const uniqueIds = new Set();
    for (const id of body.mediaIds) {
      const result = normalizeMediaId(id, "mediaIds");
      if (result.error || result.value === null) return { error: "mediaIds must contain valid media ids." };
      uniqueIds.add(result.value);
    }
    if (uniqueIds.size !== body.mediaIds.length) return { error: "mediaIds cannot contain duplicates." };
    output.mediaIds = [...uniqueIds];
  }

  if (hasOwn(body, "publishedAt")) {
    const result = normalizePublishedAt(body.publishedAt);
    if (result.error) return result;
    output.publishedAt = result.value;
  }

  if (hasOwn(body, "data")) {
    const result = validateCollectionData(collection, body.data);
    if (result.error) return result;
    output.data = result.value;
  }

  if (mode === "update" && Object.keys(output).length === 0) return { error: "No content fields were supplied." };
  return { value: output };
}

function parseContentData(value) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mergeContentData(current, changes) {
  const next = { ...current };
  for (const [key, value] of Object.entries(changes ?? {})) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

function collectionMediaIds(collection, data) {
  const fields = {
    works: ["imageMediaId", "sourceMediaId"],
    "game-wall": ["thumbnailMediaId", "imageMediaId", "sourceMediaId"],
    music: ["audioMediaId", "artworkMediaId"],
  };
  return (fields[collection] ?? []).map((field) => data[field]).filter(Boolean);
}

function publicCollectionMediaIds(collection, data, coverMediaId) {
  const fields = {
    works: ["imageMediaId"],
    "game-wall": ["thumbnailMediaId", "imageMediaId"],
    music: ["audioMediaId", "artworkMediaId"],
  };
  const ids = new Set((fields[collection] ?? []).map((field) => data[field]).filter(Boolean));
  if (coverMediaId) ids.add(coverMediaId);
  // The source is deliberately excluded even when it was accidentally chosen
  // as a cover. It remains an owner-only R2 object in every case.
  if (data.sourceMediaId) ids.delete(data.sourceMediaId);
  return ids;
}

function contentDatabaseAvailable(env) {
  return Boolean(env.CONTENT_DB && typeof env.CONTENT_DB.prepare === "function");
}

function mediaBucketAvailable(env) {
  return Boolean(env.MEDIA_BUCKET && typeof env.MEDIA_BUCKET.get === "function" && typeof env.MEDIA_BUCKET.put === "function");
}

function multipartMediaBucketAvailable(env) {
  return Boolean(
    mediaBucketAvailable(env)
      && typeof env.MEDIA_BUCKET.createMultipartUpload === "function"
      && typeof env.MEDIA_BUCKET.resumeMultipartUpload === "function",
  );
}

function d1Statement(database, query, values = []) {
  const statement = database.prepare(query);
  return values.length > 0 ? statement.bind(...values) : statement;
}

async function d1First(database, query, values = []) {
  return d1Statement(database, query, values).first();
}

async function d1All(database, query, values = []) {
  const result = await d1Statement(database, query, values).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function d1Run(database, query, values = []) {
  return d1Statement(database, query, values).run();
}

function d1BatchStatement(database, query, values = []) {
  return d1Statement(database, query, values);
}

function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mediaPublicUrl(id) {
  return `${publicMediaPath}${id}`;
}

function mediaAdminFileUrl(id) {
  return `${adminMediaPath}/${id}/file`;
}

function mediaResponseShape(row, { admin = false } = {}) {
  const result = {
    id: row.id,
    kind: row.kind,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size) || 0,
    alt: row.alt_text || "",
    url: mediaPublicUrl(row.id),
  };

  if (admin) {
    result.collection = row.collection;
    result.contentId = row.content_id || null;
    result.visibility = row.visibility;
    result.createdAt = row.created_at;
    result.updatedAt = row.updated_at;
    result.fileUrl = mediaAdminFileUrl(row.id);
  }

  return result;
}

function groupMediaByContent(mediaRows, options) {
  const byContent = new Map();
  for (const row of mediaRows) {
    if (!row.content_id) continue;
    const items = byContent.get(row.content_id) ?? [];
    items.push(mediaResponseShape(row, options));
    byContent.set(row.content_id, items);
  }
  return byContent;
}

function createMediaKey(collection, kind, id, extension) {
  return `cms/${collection}/${kind}/${id}.${extension}`;
}

function asciiBytes(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function hasBytes(bytes, start, expected) {
  return expected.every((byte, index) => bytes[start + index] === byte);
}

function sniffMediaMime(bytes) {
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (asciiBytes(bytes, 0, 4) === "8BPS") return "image/vnd.adobe.photoshop";
  if (asciiBytes(bytes, 0, 4) === "RIFF" && asciiBytes(bytes, 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(asciiBytes(bytes, 0, 6))) return "image/gif";
  if (asciiBytes(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(asciiBytes(bytes, 8, 12))) return "image/avif";
  if (asciiBytes(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (asciiBytes(bytes, 0, 4) === "RIFF" && asciiBytes(bytes, 8, 12) === "WAVE") return "audio/wav";
  if (asciiBytes(bytes, 4, 8) === "ftyp" && ["M4A ", "M4B ", "f4a "].includes(asciiBytes(bytes, 8, 12))) return "audio/mp4";
  if (asciiBytes(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0)) return "audio/mpeg";
  if (bytes[0] === 0xff && [0xf1, 0xf9].includes(bytes[1])) return "audio/aac";
  return null;
}

function compatibleDeclaredMime(declaredMime, detectedMime) {
  const normalized = typeof declaredMime === "string" ? declaredMime.split(";", 1)[0].trim().toLowerCase() : "";
  if (!normalized || normalized === "application/octet-stream") return true;
  const details = mediaMimeDetails.get(detectedMime);
  return normalized === detectedMime || Boolean(details?.aliases.includes(normalized));
}

function canonicalDeclaredMediaMime(value) {
  const normalized = typeof value === "string" ? value.split(";", 1)[0].trim().toLowerCase() : "";
  if (!normalized) return null;
  if (mediaMimeDetails.has(normalized)) return normalized;
  for (const [mimeType, details] of mediaMimeDetails) {
    if (details.aliases.includes(normalized)) return mimeType;
  }
  return null;
}

function expectedMultipartPartBytes(session, partNumber) {
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > session.part_count) return null;
  const start = (partNumber - 1) * session.part_size;
  return Math.min(session.byte_size - start, session.part_size);
}

function multipartSessionExpiry() {
  return new Date(Date.now() + multipartSessionLifetimeMs).toISOString();
}

function multipartSessionShape(row, uploadedParts = []) {
  return {
    id: row.id,
    collection: row.collection,
    contentId: row.content_id || null,
    mimeType: row.mime_type,
    kind: row.kind,
    byteSize: Number(row.byte_size) || 0,
    partSize: Number(row.part_size) || multipartPartSizeBytes,
    partCount: Number(row.part_count) || 0,
    uploadedParts: uploadedParts.map((part) => ({
      number: Number(part.part_number),
      etag: part.etag,
      byteSize: Number(part.byte_size) || 0,
    })),
    status: row.status,
    expiresAt: row.expires_at,
  };
}

function multipartFileMetadataInput(body) {
  if (!isPlainObject(body)) return { error: "Invalid multipart upload request." };
  const allowedFields = new Set(["collection", "contentId", "alt", "fileName", "fileSize", "mimeType"]);
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return { error: `${key} is not an allowed multipart upload field.` };
  }

  const collection = canonicalCollection(body.collection);
  if (!collection || !contentCollections.has(collection)) return { error: "collection is invalid." };

  let contentId = null;
  if (body.contentId !== undefined && body.contentId !== null && body.contentId !== "") {
    if (typeof body.contentId !== "string" || !contentIdPattern.test(body.contentId)) return { error: "contentId is invalid." };
    contentId = body.contentId.toLowerCase();
  }

  const alt = body.alt === undefined || body.alt === null || body.alt === ""
    ? ""
    : normalizeOptionalText(body.alt, "alt", 500, { allowEmpty: true });
  if (alt?.error) return alt;

  if (body.fileName !== undefined && (typeof body.fileName !== "string" || body.fileName.length > 255)) {
    return { error: "fileName must be text up to 255 characters." };
  }

  if (!Number.isSafeInteger(body.fileSize) || body.fileSize <= mediaUploadMaxBytes || body.fileSize > multipartUploadMaxBytes) {
    return { error: "fileSize must be larger than 20 MiB and no larger than 500 MiB." };
  }

  const mimeType = canonicalDeclaredMediaMime(body.mimeType);
  if (!mimeType) return { error: "mimeType must be a supported audio or image MIME type." };
  const details = mediaMimeDetails.get(mimeType);
  if (collection !== "music" && details.kind !== "image") {
    return { error: "Only image uploads are allowed for this collection." };
  }

  const partCount = Math.ceil(body.fileSize / multipartPartSizeBytes);
  if (!Number.isSafeInteger(partCount) || partCount < 2 || partCount > multipartMaxParts) {
    return { error: "The multipart file has an invalid number of parts." };
  }

  return {
    value: {
      collection,
      contentId,
      alt: alt?.value ?? "",
      mimeType,
      kind: details.kind,
      extension: details.extension,
      byteSize: body.fileSize,
      partSize: multipartPartSizeBytes,
      partCount,
    },
  };
}

function parseMultipartPartSize(request) {
  const supplied = request.headers.get("x-phrnono-part-size");
  if (!supplied || !/^\d{1,10}$/u.test(supplied)) return null;
  const size = Number(supplied);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

function createBoundedUploadStream(body, maxBytes, captureBytes = 0) {
  let byteSize = 0;
  const captured = [];
  let capturedSize = 0;

  const stream = body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      byteSize += bytes.byteLength;
      if (byteSize > maxBytes) {
        const error = new Error("Multipart upload part exceeds its declared size.");
        controller.error(error);
        throw error;
      }

      if (capturedSize < captureBytes) {
        const remaining = captureBytes - capturedSize;
        const sample = bytes.slice(0, remaining);
        captured.push(sample);
        capturedSize += sample.byteLength;
      }
      controller.enqueue(bytes);
    },
  }));

  return {
    stream,
    byteSize: () => byteSize,
    capturedBytes: () => {
      const output = new Uint8Array(capturedSize);
      let offset = 0;
      for (const bytes of captured) {
        output.set(bytes, offset);
        offset += bytes.byteLength;
      }
      return output;
    },
  };
}

function isUploadFile(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.name === "string"
      && Number.isFinite(value.size)
      && typeof value.slice === "function"
      && typeof value.stream === "function",
  );
}

function singleFormText(form, name, { required = false, maxLength = 0 } = {}) {
  const values = form.getAll(name);
  if (values.length === 0) return required ? { error: `${name} is required.` } : { value: "" };
  if (values.length !== 1 || typeof values[0] !== "string") return { error: `${name} must be a single text field.` };
  const value = values[0].trim();
  if (required && !value) return { error: `${name} is required.` };
  if (maxLength > 0 && value.length > maxLength) return { error: `${name} is too long.` };
  return { value };
}

async function readMediaUpload(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) return { error: "Expected multipart form data.", status: 415 };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > mediaUploadMaxBytes + multipartOverheadMaxBytes) {
    return { error: "Upload is too large.", status: 413 };
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return { error: "Invalid multipart form data.", status: 400 };
  }

  const allowedFields = new Set(["file", "collection", "contentId", "alt"]);
  for (const [name] of form.entries()) {
    if (!allowedFields.has(name)) return { error: `${name} is not an allowed upload field.`, status: 400 };
  }

  const collectionField = singleFormText(form, "collection", { required: true, maxLength: 24 });
  if (collectionField.error) return { error: collectionField.error, status: 400 };
  const collection = canonicalCollection(collectionField.value);
  if (!collection || !contentCollections.has(collection)) return { error: "collection is invalid.", status: 422 };

  const contentIdField = singleFormText(form, "contentId", { maxLength: 64 });
  if (contentIdField.error) return { error: contentIdField.error, status: 400 };
  const contentId = contentIdField.value || null;
  if (contentId && !contentIdPattern.test(contentId)) return { error: "contentId is invalid.", status: 422 };

  const altField = singleFormText(form, "alt", { maxLength: 500 });
  if (altField.error) return { error: altField.error, status: 400 };

  const files = form.getAll("file");
  if (files.length !== 1 || !isUploadFile(files[0])) return { error: "file must be a single uploaded file.", status: 400 };
  const file = files[0];
  if (file.size <= 0) return { error: "file cannot be empty.", status: 422 };
  if (file.size > mediaUploadMaxBytes) return { error: "Upload is too large.", status: 413 };

  let signature;
  try {
    signature = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  } catch {
    return { error: "Unable to inspect the uploaded file.", status: 400 };
  }
  const mimeType = sniffMediaMime(signature);
  if (!mimeType || !mediaMimeDetails.has(mimeType)) return { error: "Unsupported or invalid media file.", status: 415 };
  if (!compatibleDeclaredMime(file.type, mimeType)) return { error: "The declared file type does not match the file contents.", status: 415 };

  const details = mediaMimeDetails.get(mimeType);
  if (collection !== "music" && details.kind !== "image") {
    return { error: "Only image uploads are allowed for this collection.", status: 422 };
  }

  return {
    value: {
      collection,
      contentId: contentId?.toLowerCase() ?? null,
      alt: altField.value,
      file,
      mimeType,
      kind: details.kind,
      extension: details.extension,
    },
  };
}

function getPathSegments(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const remainder = pathname.slice(prefix.length);
  return remainder ? remainder.split("/") : [];
}

function isMusicTrack(url) {
  return url.pathname.startsWith(musicTrackPath) && url.pathname.endsWith(".mp3");
}

function cacheMusicTrack(response) {
  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", musicCacheControl);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleVisitorApi(request, env) {
  if (!["GET", "POST"].includes(request.method)) {
    return methodNotAllowed("GET, POST");
  }

  if (request.method === "POST" && !isSameOrigin(request)) {
    return jsonResponse({ error: "Invalid origin." }, 403);
  }

  const counter = env.VISITOR_COUNTER?.getByName(visitorCounterName);
  if (!counter) return jsonResponse({ error: "Visitor service unavailable." }, 503);

  try {
    const headers = new Headers();
    if (request.method === "POST") {
      const country = request.cf?.country;
      const userAgent = request.headers.get("user-agent") ?? "";
      const device = /tablet|ipad/iu.test(userAgent)
        ? "tablet"
        : /mobi|android|iphone|ipod/iu.test(userAgent)
          ? "mobile"
          : "desktop";
      if (typeof country === "string" && /^[A-Z]{2}$/u.test(country)) headers.set("x-visitor-country", country);
      headers.set("x-visitor-device", device);
    }
    const counterResponse = await counter.fetch(
      new Request("https://visitor-counter.internal/visitors", { method: request.method, headers }),
    );

    if (!counterResponse.ok) throw new Error("Visitor counter unavailable");
    return new Response(counterResponse.body, {
      status: counterResponse.status,
      headers: jsonHeaders,
    });
  } catch {
    return jsonResponse({ error: "Visitor service unavailable." }, 503);
  }
}

function normalizeContactText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").trim().slice(0, maxLength);
}

function normalizeCiaGuideHistory(value) {
  if (value === undefined) return { value: [] };
  if (!Array.isArray(value) || value.length > ciaGuideHistoryMaxMessages) {
    return { error: "Invalid conversation context." };
  }

  const history = [];
  for (const item of value) {
    if (!isPlainObject(item) || Object.keys(item).some((key) => !["role", "body"].includes(key))) {
      return { error: "Invalid conversation context." };
    }
    if (!["visitor", "cia"].includes(item.role) || typeof item.body !== "string" || item.body.length > ciaGuideHistoryMessageMaxLength) {
      return { error: "Invalid conversation context." };
    }
    const body = normalizeContactText(item.body, ciaGuideHistoryMessageMaxLength);
    if (!body) return { error: "Invalid conversation context." };
    history.push({ role: item.role, body });
  }

  return { value: history };
}

function normalizeCiaGuideContext(value) {
  if (value === undefined) return { value: null };
  if (typeof value !== "string" || !ciaGuideContexts.has(value)) return { error: "Invalid page context." };
  return { value };
}

function validContactEmail(value) {
  return value.length <= contactEmailMaxLength
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
    && !/[\r\n]/u.test(value);
}

async function verifyTurnstile(request, env, token) {
  const secret = typeof env.TURNSTILE_SECRET_KEY === "string" ? env.TURNSTILE_SECRET_KEY.trim() : "";
  if (!secret) return { configured: false, valid: true };
  if (!token || token.length > 2048) return { configured: true, valid: false };

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: request.headers.get("cf-connecting-ip") ?? undefined,
      }),
    });
    if (!response.ok) return { configured: true, valid: false };
    const result = await response.json();
    return { configured: true, valid: result?.success === true };
  } catch {
    return { configured: true, valid: false };
  }
}

async function sendContactEmail(env, { name, email, message }) {
  const to = normalizeContactText(env.CONTACT_TO_EMAIL ?? env.ADMIN_EMAIL, contactEmailMaxLength);
  const from = normalizeContactText(env.CONTACT_FROM_EMAIL, contactEmailMaxLength);
  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  const sendgridKey = typeof env.SENDGRID_API_KEY === "string" ? env.SENDGRID_API_KEY.trim() : "";
  if (!to || !from || (!resendKey && !sendgridKey)) return { configured: false };

  const subject = `PHRNONO contact · ${name || "Visitor"}`.replace(/[\r\n]/gu, " ").slice(0, 180);
  const text = [
    `Name: ${name || "(not provided)"}`,
    `Email: ${email}`,
    "",
    message,
  ].join("\n");

  try {
    const response = resendKey
      ? await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [to], reply_to: email, subject, text }),
      })
      : await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { authorization: `Bearer ${sendgridKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          reply_to: { email },
          subject,
          content: [{ type: "text/plain", value: text }],
        }),
      });

    return response.ok ? { configured: true, sent: true } : { configured: true, sent: false };
  } catch {
    return { configured: true, sent: false };
  }
}

async function handleContact(request, env) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Invalid origin." }, 403);

  const body = await readJsonRequest(request, contactBodyMaxBytes);
  if (body.error || !isPlainObject(body.value)) return jsonResponse({ error: body.error ?? "Invalid request." }, body.status ?? 400);

  const name = normalizeContactText(body.value.name, contactNameMaxLength);
  const email = normalizeContactText(body.value.email, contactEmailMaxLength).toLowerCase();
  const message = normalizeContactText(body.value.message, contactMessageMaxLength);
  const website = normalizeContactText(body.value.website, 120);
  const captchaToken = normalizeContactText(body.value.captchaToken, 2048);
  if (website) {
    await recordSecurityEvent(env, "suspiciousRequests");
    return jsonResponse({ accepted: true });
  }
  if (!message || message.length < 10) return jsonResponse({ error: "Message must be at least 10 characters." }, 422);
  if (!validContactEmail(email)) return jsonResponse({ error: "A valid email address is required." }, 422);

  const turnstile = await verifyTurnstile(request, env, captchaToken);
  if (!turnstile.valid) {
    await recordSecurityEvent(env, "turnstileBlocked");
    return jsonResponse({ error: "Please complete the anti-spam check and try again." }, 403);
  }

  const preflight = await useAuthLimiter(request, env, "check", "contact");
  if (!preflight) return jsonResponse({ error: "Contact service unavailable." }, 503);
  if (!preflight.allowed) return jsonResponse({ error: "Too many messages. Please try again later." }, 429, { "retry-after": String(Math.max(1, Number(preflight.retryAfter) || 1)) });
  const consumed = await useAuthLimiter(request, env, "consume", "contact");
  if (!consumed?.allowed) return jsonResponse({ error: "Too many messages. Please try again later." }, 429);

  const contactId = await saveContactSubmission(env, { name, email, message });
  const result = await sendContactEmail(env, { name, email, message });
  await completeContactDelivery(env, contactId, result);
  if (!result.configured) return jsonResponse({ error: "Email forwarding is not configured yet. Please use the email link instead." }, 503);
  if (!result.sent) return jsonResponse({ error: "The message could not be sent. Please try again later." }, 502);
  return jsonResponse({ sent: true });
}

function ciaGuideUnavailableReply(locale, { upstream = false } = {}) {
  const replies = {
    zh: upstream
      ? "抱歉，档案暂时没有回应。过一会儿再问我吧。"
      : "希娅导览还在准备中。等档案连接完成后，我就可以回答了。",
    en: upstream
      ? "Sorry—the archive is not answering right now. Please ask me again in a little while."
      : "Cia's guide is still being prepared. I will be able to answer once the archive connection is ready.",
    ja: upstream
      ? "ごめんなさい。今はアーカイブから返事がありません。少し時間をおいて、もう一度聞いてください。"
      : "シアの案内はまだ準備中です。アーカイブの接続が整ったら、お答えできます。",
  };
  return replies[locale] ?? replies.zh;
}

function ciaGuideRateLimitedReply(locale) {
  const replies = {
    zh: "这一段时间的查询已经满了。稍后再试就好。",
    en: "This guide has reached its short query limit. Please try again a little later.",
    ja: "この時間帯の照会回数が上限に達しました。少し時間をおいて、もう一度試してください。",
  };
  return replies[locale] ?? replies.zh;
}

function ciaGuideFreeQuotaReply(locale) {
  const replies = {
    zh: "这一天的免费导览额度已经用完了。额度每天在台北时间 08:00 重置，之后再来找我吧。",
    en: "The free guide allowance is used up for now. It resets daily at 08:00 Taipei time (00:00 UTC). Come back after that.",
    ja: "今の無料案内枠を使い切りました。毎日、台北時間の 08:00（UTC 00:00）にリセットされます。その後、また来てください。",
  };
  return replies[locale] ?? replies.zh;
}

function ciaGuideDailyLimitReply(locale) {
  const replies = {
    zh: "这一轮的希娅导览名额已经满了。每天台北时间 08:00 会重新开放。",
    en: "Cia's guide has reached its protected daily limit. It reopens daily at 08:00 Taipei time (00:00 UTC).",
    ja: "今回のシア案内枠は上限に達しました。毎日、台北時間の 08:00（UTC 00:00）に再開します。",
  };
  return replies[locale] ?? replies.zh;
}

function extractCiaGuideReply(payload) {
  if (typeof payload?.response === "string" && payload.response.trim()) return payload.response.trim();
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const completionContent = payload?.choices?.[0]?.message?.content;
  if (typeof completionContent === "string" && completionContent.trim()) return completionContent.trim();
  if (Array.isArray(completionContent)) {
    const content = completionContent.map((item) => typeof item?.text === "string" ? item.text : "").join("\n").trim();
    if (content) return content;
  }
  if (!Array.isArray(payload?.output)) return "";

  return payload.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((item) => item?.type === "output_text")
    .map((item) => typeof item.text === "string" ? item.text : "")
    .join("\n")
    .trim();
}

export async function withCiaGuideTimeout(infer, timeoutMs = ciaGuideResponseTimeoutMs) {
  let timer;
  try {
    // A timeout releases the HTTP/UI request, but never retries inference or
    // spends a second allowance. The binding does not expose cancellation of
    // an inference already accepted by the provider.
    return await Promise.race([
      Promise.resolve().then(infer),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Cia guide response timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function handleCiaGuide(request, env) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Invalid origin." }, 403);

  const body = await readJsonRequest(request, ciaGuideBodyMaxBytes);
  if (body.error || !isPlainObject(body.value)) return jsonResponse({ error: body.error ?? "Invalid request." }, body.status ?? 400);
  if (Object.keys(body.value).some((key) => !["message", "locale", "context", "history"].includes(key))) {
    return jsonResponse({ error: "Invalid request." }, 422);
  }

  if (typeof body.value.message !== "string" || body.value.message.length > ciaGuideMessageMaxLength) {
    return jsonResponse({ error: "A valid message is required." }, 422);
  }
  if (body.value.locale !== undefined && !ciaGuideLocales.has(body.value.locale)) {
    return jsonResponse({ error: "Invalid locale." }, 422);
  }
  const history = normalizeCiaGuideHistory(body.value.history);
  if (history.error) return jsonResponse({ error: history.error }, 422);
  const context = normalizeCiaGuideContext(body.value.context);
  if (context.error) return jsonResponse({ error: context.error }, 422);
  const message = normalizeContactText(body.value.message, ciaGuideMessageMaxLength);
  const locale = body.value.locale ?? "zh";
  if (!message) return jsonResponse({ error: "A message is required." }, 422);
  const replyLocale = getCiaReplyLocale(message, locale, history.value);

  if (!ciaGuideConfigured(env)) {
    return jsonResponse({ available: false, reply: ciaGuideUnavailableReply(replyLocale) }, 503);
  }

  const limit = await useCiaGuideLimiter(request, env);
  if (!limit) return jsonResponse({ available: false, reply: ciaGuideUnavailableReply(replyLocale, { upstream: true }) }, 503);
  if (!limit.allowed) {
    return jsonResponse(
      { available: false, reply: ciaGuideRateLimitedReply(replyLocale) },
      429,
      { "retry-after": String(Math.max(1, Number(limit.retryAfter) || 1)) },
    );
  }

  const dailyLimit = await useCiaGuideDailyLimiter(env);
  if (!dailyLimit) return jsonResponse({ available: false, reply: ciaGuideUnavailableReply(replyLocale, { upstream: true }) }, 503);
  if (!dailyLimit.allowed) {
    return jsonResponse(
      { available: false, reply: ciaGuideDailyLimitReply(replyLocale) },
      429,
      { "retry-after": String(Math.max(1, Number(dailyLimit.retryAfter) || 1)) },
    );
  }

  let payload;
  try {
    payload = await withCiaGuideTimeout(() => env.AI.run(ciaGuideModel, {
      messages: [
        {
          role: "system",
          content: getCiaGuideInstructions(replyLocale, context.value, { message, history: history.value }),
        },
        ...history.value.map((turn) => ({
          role: turn.role === "cia" ? "assistant" : "user",
          content: turn.body,
        })),
        {
          role: "user",
          content: message,
        },
      ],
      max_completion_tokens: 260,
      temperature: 0.48,
      // This model supports a reasoning pass. The guide only needs a concise,
      // grounded archive reply, so keep the entire output allowance available
      // for the visitor-facing answer.
      chat_template_kwargs: { enable_thinking: false },
      store: false,
    }));
  } catch (error) {
    // 3036 is Cloudflare's specific "free allocation depleted" code. Other
    // 429s can be transient capacity throttling, not a visitor's daily quota.
    if (Number(error?.code) === 3036) {
      return jsonResponse({ available: false, reply: ciaGuideFreeQuotaReply(replyLocale) }, 429);
    }
    return jsonResponse({ available: false, reply: ciaGuideUnavailableReply(replyLocale, { upstream: true }) }, 503);
  }

  const reply = extractCiaGuideReply(payload).slice(0, ciaGuideOutputMaxLength);
  if (!reply) return jsonResponse({ available: false, reply: ciaGuideUnavailableReply(replyLocale, { upstream: true }) }, 502);
  return jsonResponse({ available: true, reply });
}

async function handleAnalyticsEvents(request, env) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Invalid origin." }, 403);
  const body = await readJsonRequest(request, analyticsEventMaxBytes);
  if (body.error || !isPlainObject(body.value)) return jsonResponse({ error: body.error ?? "Invalid request." }, body.status ?? 400);

  const type = typeof body.value.type === "string" ? body.value.type : "";
  const slug = typeof body.value.slug === "string" ? body.value.slug.trim().toLowerCase() : "";
  const duration = Number(body.value.duration);
  if (!analyticsEventTypes.has(type)) return jsonResponse({ error: "Unsupported analytics event." }, 422);
  if (["work_click", "work_dwell"].includes(type) && (!slug || !analyticsSlugPattern.test(slug))) return jsonResponse({ error: "A valid work slug is required." }, 422);
  if (type === "work_dwell" && (!Number.isSafeInteger(duration) || duration < 1 || duration > analyticsDwellMaxSeconds)) {
    return jsonResponse({ error: "A valid dwell duration is required." }, 422);
  }

  const counter = env.VISITOR_COUNTER?.getByName(visitorCounterName);
  if (!counter) return jsonResponse({ error: "Analytics service unavailable." }, 503);
  try {
    const counterResponse = await counter.fetch(new Request("https://visitor-counter.internal/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, slug: slug || null, duration: type === "work_dwell" ? duration : null }),
    }));
    if (!counterResponse.ok) throw new Error("Analytics counter unavailable");
    return jsonResponse({ recorded: true });
  } catch {
    return jsonResponse({ error: "Analytics service unavailable." }, 503);
  }
}

async function handleAuthLogin(request, env) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Invalid origin." }, 403);
  if (!adminConfigured(env)) return jsonResponse({ error: "Admin login is unavailable." }, 503);

  const preflight = await useAuthLimiter(request, env, "check");
  if (!preflight) return jsonResponse({ error: "Admin login is unavailable." }, 503);
  if (!preflight.allowed) {
    return jsonResponse(
      { error: "Too many login attempts. Try again later." },
      429,
      { "retry-after": String(Math.max(1, Number(preflight.retryAfter) || 1)) },
    );
  }

  const body = await readJsonRequest(request);
  const email = typeof body.value?.email === "string" ? body.value.email.trim().toLowerCase() : "";
  const password = typeof body.value?.password === "string" ? body.value.password : "";
  const validInput = !body.error && email.length <= 320 && password.length > 0 && password.length <= 1024;
  const validCredentials = validInput && await credentialsMatch(env, email, password);
  const attempt = await useAuthLimiter(request, env, validCredentials ? "success" : "failure");
  if (!attempt) return jsonResponse({ error: "Admin login is unavailable." }, 503);

  if (!validCredentials) {
    if (!attempt.allowed) {
      return jsonResponse(
        { error: "Too many login attempts. Try again later." },
        429,
        { "retry-after": String(Math.max(1, Number(attempt.retryAfter) || 1)) },
      );
    }
    return jsonResponse({ error: "Invalid email or password." }, 401);
  }

  const token = await createAdminSession(env);
  return jsonResponse({ authenticated: true }, 200, { "set-cookie": buildSessionCookie(token) });
}

async function handleAuthSession(request, env) {
  if (request.method !== "GET") return methodNotAllowed("GET");
  if (!adminConfigured(env)) return jsonResponse({ authenticated: false, configured: false }, 503);

  const session = await readAdminSession(request, env);
  return jsonResponse({
    authenticated: Boolean(session),
    ...(session ? { expiresAt: session.exp } : {}),
  });
}

async function handleAuthLogout(request) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Invalid origin." }, 403);
  return jsonResponse({ authenticated: false }, 200, { "set-cookie": clearSessionCookie() });
}

async function handleAdminOverview(request, env) {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const session = await readAdminSession(request, env);
  if (!session) return jsonResponse({ error: "Authentication required." }, 401);

  const counter = env.VISITOR_COUNTER?.getByName(visitorCounterName);
  if (!counter) return jsonResponse({ error: "Dashboard service unavailable." }, 503);

  try {
    const [visitorResponse, analyticsResponse] = await Promise.all([
      counter.fetch(new Request("https://visitor-counter.internal/visitors")),
      counter.fetch(new Request("https://visitor-counter.internal/analytics")),
    ]);
    if (!visitorResponse.ok || !analyticsResponse.ok) throw new Error("Visitor counter unavailable");
    const [visitors, analytics, operations] = await Promise.all([
      visitorResponse.json(),
      analyticsResponse.json(),
      getOperationsOverview(env, { storageLimitBytes: mediaStorageQuotaBytes }),
    ]);
    return jsonResponse({
      visitors: {
        total: counterValue(visitors.total),
        today: counterValue(visitors.today),
        day: typeof visitors.day === "string" ? visitors.day : getCounterDay(),
      },
      analytics: {
        cvDownloads: {
          total: counterValue(analytics.cvDownloads?.total),
          today: counterValue(analytics.cvDownloads?.today),
        },
        workClicks: {
          total: counterValue(analytics.workClicks?.total),
          today: counterValue(analytics.workClicks?.today),
          bySlug: isPlainObject(analytics.workClicks?.bySlug) ? analytics.workClicks.bySlug : {},
        },
        workDwell: {
          seconds: counterValue(analytics.workDwell?.seconds),
          events: counterValue(analytics.workDwell?.events),
        },
        countries: Array.isArray(analytics.countries) ? analytics.countries : [],
        devices: Array.isArray(analytics.devices) ? analytics.devices : [],
      },
      integrations: {
        emailForwarding: Boolean(
          (env.RESEND_API_KEY || env.SENDGRID_API_KEY)
          && (env.CONTACT_FROM_EMAIL || "")
          && (env.CONTACT_TO_EMAIL || env.ADMIN_EMAIL || ""),
        ),
        captcha: Boolean(env.TURNSTILE_SECRET_KEY),
      },
      operations,
      updatedAt: new Date().toISOString(),
      sessionExpiresAt: session.exp,
    });
  } catch {
    return jsonResponse({ error: "Dashboard service unavailable." }, 503);
  }
}

async function handleAdminAnalyticsReset(request, env) {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const auth = await requireAdmin(request, env, { write: true });
  if (auth.response) return auth.response;

  const body = await readJsonRequest(request, authBodyMaxBytes);
  if (body.error || !isPlainObject(body.value)) return jsonResponse({ error: body.error ?? "Invalid request." }, body.status ?? 400);
  if (Object.keys(body.value).length !== 1 || body.value.confirm !== "RESET_ANALYTICS") {
    return jsonResponse({ error: "A reset confirmation is required." }, 422);
  }

  const counter = env.VISITOR_COUNTER?.getByName(visitorCounterName);
  if (!counter) return jsonResponse({ error: "Dashboard service unavailable." }, 503);

  try {
    const resetResponse = await counter.fetch(new Request("https://visitor-counter.internal/reset", { method: "POST" }));
    if (!resetResponse.ok) throw new Error("Visitor counter unavailable");
    const result = await resetResponse.json();
    if (result?.reset !== true) throw new Error("Visitor counter reset failed");
    return jsonResponse({ reset: true });
  } catch {
    return jsonResponse({ error: "Dashboard service unavailable." }, 503);
  }
}

const contentItemColumns = [
  "id",
  "collection",
  "slug",
  "status",
  "title",
  "summary",
  "body",
  "metadata_json",
  "cover_media_id",
  "sort_order",
  "published_at",
  "created_at",
  "updated_at",
].join(", ");

const contentMediaColumns = [
  "id",
  "content_id",
  "collection",
  "kind",
  "mime_type",
  "byte_size",
  "storage_key",
  "alt_text",
  "visibility",
  "created_at",
  "updated_at",
].join(", ");

const contentUploadSessionColumns = [
  "id",
  "upload_id",
  "content_id",
  "collection",
  "kind",
  "mime_type",
  "byte_size",
  "part_size",
  "part_count",
  "storage_key",
  "alt_text",
  "status",
  "reserved_bytes",
  "expires_at",
  "created_at",
  "updated_at",
].join(", ");

const contentUploadPartColumns = [
  "session_id",
  "part_number",
  "etag",
  "byte_size",
  "created_at",
  "updated_at",
].join(", ");

function contentUpdatedAt(rows) {
  const dates = rows.map((row) => row.updated_at).filter((value) => typeof value === "string").sort();
  return dates.at(-1) ?? new Date().toISOString();
}

async function getContentMediaRows(database, contentIds, { publicOnly = false } = {}) {
  if (contentIds.length === 0) return [];
  const placeholders = contentIds.map(() => "?").join(", ");
  const values = [...contentIds];
  const visibility = publicOnly ? " AND visibility = 'public'" : "";
  return d1All(
    database,
    `SELECT ${contentMediaColumns} FROM content_media WHERE content_id IN (${placeholders})${visibility} ORDER BY created_at ASC`,
    values,
  );
}

async function getMediaRowsById(database, mediaIds) {
  if (mediaIds.length === 0) return [];
  const placeholders = mediaIds.map(() => "?").join(", ");
  return d1All(database, `SELECT ${contentMediaColumns} FROM content_media WHERE id IN (${placeholders})`, mediaIds);
}

async function getMediaStorageBytes(database) {
  const row = await d1First(database, "SELECT COALESCE(SUM(byte_size), 0) AS total FROM content_media");
  const total = Number(row?.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

async function expireMultipartSessions(database, now = new Date().toISOString()) {
  await d1Run(
    database,
    `UPDATE content_upload_sessions
     SET status = 'expired', updated_at = ?
     WHERE status = 'active' AND expires_at <= ?`,
    [now, now],
  );
}

async function getMultipartReservedBytes(database, now = new Date().toISOString()) {
  const row = await d1First(
    database,
    `SELECT COALESCE(SUM(reserved_bytes), 0) AS total
     FROM content_upload_sessions
     -- An expired R2 multipart upload may still hold private parts.  Keep its
     -- reservation until an authenticated abort succeeds rather than letting
     -- a stale session quietly bypass the portfolio's storage safety cap.
     WHERE status IN ('active', 'expired')`,
  );
  const total = Number(row?.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

async function getMediaCapacityUsage(database, now = new Date().toISOString()) {
  await expireMultipartSessions(database, now);
  const [storedBytes, reservedBytes] = await Promise.all([
    getMediaStorageBytes(database),
    getMultipartReservedBytes(database, now),
  ]);
  return { storedBytes, reservedBytes, total: storedBytes + reservedBytes };
}

function contentAdminShape(row, mediaRows) {
  return {
    id: row.id,
    collection: row.collection,
    slug: row.slug,
    status: row.status,
    title: row.title,
    summary: row.summary,
    body: row.body,
    data: parseContentData(row.metadata_json),
    coverMediaId: row.cover_media_id || null,
    media: mediaRows.map((media) => mediaResponseShape(media, { admin: true })),
    sortOrder: Number(row.sort_order) || 0,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mediaById(mediaRows) {
  return new Map(mediaRows.map((media) => [media.id, mediaResponseShape(media)]));
}

function firstMediaOfKind(mediaRows, kind) {
  return mediaRows.map((media) => mediaResponseShape(media)).find((media) => media.kind === kind) ?? null;
}

function chooseMedia(mediaMap, id, fallback, kind) {
  const selected = id ? mediaMap.get(id) : null;
  if (selected?.kind === kind) return selected;
  return fallback?.kind === kind ? fallback : null;
}

function publicContentShape(row, mediaRows) {
  const data = parseContentData(row.metadata_json);
  const byId = mediaById(mediaRows);
  const cover = row.cover_media_id ? byId.get(row.cover_media_id) ?? null : null;
  const imageFallback = cover?.kind === "image" ? cover : firstMediaOfKind(mediaRows, "image");

  if (row.collection === "works") {
    const image = chooseMedia(byId, data.imageMediaId, imageFallback, "image");
    const item = {
      id: row.id,
      title: row.title,
      category: data.category,
      year: data.year,
      imageUrl: image?.url ?? "",
      sortOrder: Number(row.sort_order) || 0,
      publishedAt: row.published_at,
    };
    if (data.alt || image?.alt) item.alt = data.alt || image.alt;
    if (data.discipline) item.discipline = data.discipline;
    if (data.externalUrl) item.externalUrl = data.externalUrl;
    if (data.sourceMediaId) {
      item.previewOnly = true;
      item.watermarkText = data.watermarkText || "PHRNONO / PREVIEW ONLY";
    }
    return item;
  }

  if (row.collection === "game-wall") {
    const image = chooseMedia(byId, data.imageMediaId, imageFallback, "image");
    const thumbnail = chooseMedia(byId, data.thumbnailMediaId, image, "image");
    const item = {
      id: row.id,
      title: row.title,
      group: data.group,
      number: data.number,
      shape: data.shape,
      letterboxed: Boolean(data.letterboxed),
      thumbnailUrl: thumbnail?.url ?? "",
      imageUrl: image?.url ?? "",
      sortOrder: Number(row.sort_order) || 0,
    };
    if (data.sourceMediaId) {
      item.previewOnly = true;
      item.watermarkText = data.watermarkText || "PHRNONO / PREVIEW ONLY";
    }
    return item;
  }

  const audio = chooseMedia(byId, data.audioMediaId, firstMediaOfKind(mediaRows, "audio"), "audio");
  const artwork = chooseMedia(byId, data.artworkMediaId, imageFallback, "image");
  const item = {
    id: row.id,
    title: row.title,
    artist: data.artist,
    release: data.release,
    duration: data.duration,
    audioUrl: audio?.url ?? "",
    artworkUrl: artwork?.url ?? "",
    sortOrder: Number(row.sort_order) || 0,
    publishedAt: row.published_at,
  };
  if (data.lyrics) item.lyrics = data.lyrics;
  if (data.genre) item.genre = data.genre;
  return item;
}

async function getContentItem(database, collection, id) {
  return d1First(
    database,
    `SELECT ${contentItemColumns} FROM content_items WHERE collection = ? AND id = ?`,
    [collection, id],
  );
}

async function getAdminContentItem(database, collection, id) {
  const row = await getContentItem(database, collection, id);
  if (!row) return null;
  const mediaRows = await getContentMediaRows(database, [row.id]);
  return contentAdminShape(row, mediaRows);
}

function contentWriteState(existing, collection, input) {
  const currentData = existing ? parseContentData(existing.metadata_json) : {};
  const data = mergeContentData(currentData, input.data);
  if (collection === "game-wall" && typeof data.letterboxed !== "boolean") data.letterboxed = false;
  const status = input.status ?? existing?.status ?? "draft";
  const publishedAt = status === "published"
    ? input.publishedAt ?? existing?.published_at ?? new Date().toISOString()
    : null;

  return {
    id: existing?.id ?? uuid(),
    collection,
    slug: input.slug ?? existing?.slug,
    status,
    title: input.title ?? existing?.title ?? "",
    summary: input.summary ?? existing?.summary ?? "",
    body: input.body ?? existing?.body ?? "",
    data,
    coverMediaId: hasOwn(input, "coverMediaId") ? input.coverMediaId : existing?.cover_media_id ?? null,
    sortOrder: input.sortOrder ?? (Number.isSafeInteger(existing?.sort_order) ? existing.sort_order : 0),
    publishedAt,
  };
}

function requestedMediaIds(collection, state, input, currentMediaRows) {
  const ids = new Set(hasOwn(input, "mediaIds") ? input.mediaIds : currentMediaRows.map((media) => media.id));
  if (state.coverMediaId) ids.add(state.coverMediaId);
  for (const id of collectionMediaIds(collection, state.data)) ids.add(id);
  return [...ids];
}

function validateMediaAttachments(rows, ids, contentId, collection) {
  if (rows.length !== ids.length) return { error: "One or more selected media files do not exist." };
  const media = new Map(rows.map((row) => [row.id, row]));
  for (const id of ids) {
    const row = media.get(id);
    if (!row) return { error: "One or more selected media files do not exist." };
    if (row.collection !== collection) return { error: "Media must stay in the same content collection." };
    if (row.content_id && row.content_id !== contentId) return { error: "A selected media file is attached to a different item.", status: 409 };
  }
  return { value: media };
}

function validatePublishedContent(state, selectedMedia) {
  const selected = (id, kind, field) => {
    const row = selectedMedia.get(id);
    if (!row || row.kind !== kind) return `${field} must reference an attached ${kind} upload.`;
    return null;
  };

  if (state.collection === "works") {
    if (!state.title) return "title is required before publishing a work.";
    if (!workCategories.has(state.data.category)) return "data.category is required before publishing a work.";
    if (typeof state.data.year !== "string" || !/^(19|20)\d{2}$/u.test(state.data.year)) return "data.year is required before publishing a work.";
    const imageId = state.data.imageMediaId ?? state.coverMediaId;
    if (!imageId) return "An image upload is required before publishing a work.";
    const imageError = selected(imageId, "image", "data.imageMediaId");
    if (imageError) return imageError;
    if (!state.data.sourceMediaId) return null;
    if (state.data.sourceMediaId === imageId || state.data.sourceMediaId === state.coverMediaId) {
      return "data.sourceMediaId must be a separate private source file, not the public preview.";
    }
    return selected(state.data.sourceMediaId, "image", "data.sourceMediaId");
  }

  if (state.collection === "game-wall") {
    if (!gameWallGroups.has(state.data.group)) return "data.group is required before publishing a game-wall image.";
    if (!Number.isSafeInteger(state.data.number) || state.data.number < 0) return "data.number is required before publishing a game-wall image.";
    if (!gameWallShapes.has(state.data.shape)) return "data.shape is required before publishing a game-wall image.";
    const imageId = state.data.imageMediaId ?? state.coverMediaId;
    if (!imageId) return "An image upload is required before publishing a game-wall image.";
    const imageError = selected(imageId, "image", "data.imageMediaId");
    if (imageError) return imageError;
    const thumbnailError = state.data.thumbnailMediaId ? selected(state.data.thumbnailMediaId, "image", "data.thumbnailMediaId") : null;
    if (thumbnailError) return thumbnailError;
    if (!state.data.sourceMediaId) return null;
    if (state.data.sourceMediaId === imageId || state.data.sourceMediaId === state.data.thumbnailMediaId || state.data.sourceMediaId === state.coverMediaId) {
      return "data.sourceMediaId must be a separate private source file, not a public preview.";
    }
    return selected(state.data.sourceMediaId, "image", "data.sourceMediaId");
  }

  if (!state.title) return "title is required before publishing music.";
  if (!state.data.artist) return "data.artist is required before publishing music.";
  if (!state.data.release) return "data.release is required before publishing music.";
  if (!/^\d{1,3}:[0-5]\d$/u.test(state.data.duration ?? "")) return "data.duration is required before publishing music.";
  if (!state.data.audioMediaId) return "An audio upload is required before publishing music.";
  if (!state.data.artworkMediaId && !state.coverMediaId) return "Artwork is required before publishing music.";
  return selected(state.data.audioMediaId, "audio", "data.audioMediaId")
    ?? selected(state.data.artworkMediaId ?? state.coverMediaId, "image", "data.artworkMediaId");
}

async function saveContentItem(database, collection, existing, input) {
  const state = contentWriteState(existing, collection, input);
  const currentMediaRows = existing ? await getContentMediaRows(database, [existing.id]) : [];
  const attachmentIds = requestedMediaIds(collection, state, input, currentMediaRows);
  const attachmentRows = await getMediaRowsById(database, attachmentIds);
  const attachmentCheck = validateMediaAttachments(attachmentRows, attachmentIds, state.id, collection);
  if (attachmentCheck.error) return attachmentCheck;

  if (state.status === "published") {
    const publishingError = validatePublishedContent(state, attachmentCheck.value);
    if (publishingError) return { error: publishingError };
  }

  const now = new Date().toISOString();
  const publicMediaIds = state.status === "published"
    ? publicCollectionMediaIds(collection, state.data, state.coverMediaId)
    : new Set();
  const metadata = JSON.stringify(state.data);
  const statements = [];

  if (existing) {
    statements.push(d1BatchStatement(
      database,
      `UPDATE content_items
       SET slug = ?, status = ?, title = ?, summary = ?, body = ?, metadata_json = ?, cover_media_id = ?, sort_order = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND collection = ?`,
      [
        state.slug,
        state.status,
        state.title,
        state.summary,
        state.body,
        metadata,
        state.coverMediaId,
        state.sortOrder,
        state.publishedAt,
        now,
        state.id,
        collection,
      ],
    ));
  } else {
    statements.push(d1BatchStatement(
      database,
      `INSERT INTO content_items
       (id, collection, slug, status, title, summary, body, metadata_json, cover_media_id, sort_order, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        state.id,
        collection,
        state.slug,
        state.status,
        state.title,
        state.summary,
        state.body,
        metadata,
        state.coverMediaId,
        state.sortOrder,
        state.publishedAt,
        now,
        now,
      ],
    ));
  }

  const attachmentIdSet = new Set(attachmentIds);
  for (const media of currentMediaRows) {
    if (attachmentIdSet.has(media.id)) continue;
    statements.push(d1BatchStatement(
      database,
      "UPDATE content_media SET content_id = NULL, visibility = 'private', updated_at = ? WHERE id = ? AND content_id = ?",
      [now, media.id, state.id],
    ));
  }

  for (const mediaId of attachmentIds) {
    const visibility = publicMediaIds.has(mediaId) ? "public" : "private";
    statements.push(d1BatchStatement(
      database,
      "UPDATE content_media SET content_id = ?, visibility = ?, updated_at = ? WHERE id = ? AND (content_id IS NULL OR content_id = ?)",
      [state.id, visibility, now, mediaId, state.id],
    ));
  }

  if (typeof database.batch === "function") await database.batch(statements);
  else {
    for (const statement of statements) await statement.run();
  }

  return { value: await getAdminContentItem(database, collection, state.id) };
}

function cmsDatabaseErrorResponse(error) {
  const message = String(error?.message ?? "");
  if (message.includes("UNIQUE constraint failed: content_items.collection, content_items.slug")) {
    return jsonResponse({ error: "That slug is already in use in this collection." }, 409);
  }
  return cmsUnavailableResponse();
}

function notFoundResponse() {
  return jsonResponse({ error: "Not found." }, 404);
}

async function runDurableObjectExclusive(state, task) {
  if (typeof state?.blockConcurrencyWhile === "function") return state.blockConcurrencyWhile(task);
  return task();
}

function requestLimit(url, max) {
  const requested = Number(url.searchParams.get("limit"));
  if (!Number.isSafeInteger(requested) || requested < 1) return max;
  return Math.min(requested, max);
}

async function requireAdmin(request, env, { write = false } = {}) {
  if (write && !isSameOrigin(request)) return { response: jsonResponse({ error: "Invalid origin." }, 403) };
  const session = await readAdminSession(request, env);
  if (!session) return { response: jsonResponse({ error: "Authentication required." }, 401) };
  return { session };
}

function groupRawMediaByContent(mediaRows) {
  const byContent = new Map();
  for (const row of mediaRows) {
    const rows = byContent.get(row.content_id) ?? [];
    rows.push(row);
    byContent.set(row.content_id, rows);
  }
  return byContent;
}

async function handlePublicContent(request, env, url) {
  if (request.method !== "GET") return methodNotAllowed("GET");
  if (!contentDatabaseAvailable(env)) return cmsUnavailableResponse();

  const segments = getPathSegments(url.pathname, publicContentPath);
  if (!segments || ![1, 2].includes(segments.length)) return notFoundResponse();
  const collection = canonicalCollection(segments[0]);
  if (!collection) return notFoundResponse();
  const slug = segments[1];
  if (slug && (!contentSlugPattern.test(slug) || slug.length > 120)) return notFoundResponse();

  try {
    let rows;
    if (slug) {
      const row = await d1First(
        env.CONTENT_DB,
        `SELECT ${contentItemColumns} FROM content_items WHERE collection = ? AND slug = ? AND status = 'published'`,
        [collection, slug],
      );
      rows = row ? [row] : [];
      if (rows.length === 0) return notFoundResponse();
    } else {
      rows = await d1All(
        env.CONTENT_DB,
        `SELECT ${contentItemColumns} FROM content_items
         WHERE collection = ? AND status = 'published'
         ORDER BY sort_order ASC, published_at DESC, created_at DESC LIMIT ?`,
        [collection, requestLimit(url, contentListMax)],
      );
    }

    const mediaRows = await getContentMediaRows(env.CONTENT_DB, rows.map((row) => row.id), { publicOnly: true });
    const mediaByContent = groupRawMediaByContent(mediaRows);
    const items = rows.map((row) => publicContentShape(row, mediaByContent.get(row.id) ?? []));
    return publicJsonResponse({ items, updatedAt: contentUpdatedAt(rows) });
  } catch (error) {
    return cmsDatabaseErrorResponse(error);
  }
}

function parseByteRange(header) {
  if (!header) return { requested: false };
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return { invalid: true };
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return { invalid: true };
    return { requested: true, range: { suffix } };
  }
  const offset = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(offset) || offset < 0 || (end !== null && (!Number.isSafeInteger(end) || end < offset))) {
    return { invalid: true };
  }
  return {
    requested: true,
    range: end === null ? { offset } : { offset, length: end - offset + 1 },
  };
}

function mediaHeaders(object, mimeType, cacheControl, { download = false, fileName = "source-file" } = {}) {
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  headers.set("content-type", mimeType);
  headers.set("cache-control", cacheControl);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "same-origin");
  if (download) headers.set("content-disposition", `attachment; filename="${fileName.replaceAll(/[^A-Za-z0-9._-]/gu, "-")}"`);
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return headers;
}

async function serveMediaObject(request, bucket, media, { cacheControl, download = false } = {}) {
  const range = parseByteRange(request.headers.get("range"));
  if (range.invalid) return new Response(null, { status: 416, headers: { "content-range": "bytes */*" } });

  try {
    if (request.method === "HEAD") {
      const object = await bucket.head(media.storage_key);
      if (!object) return notFoundResponse();
      const headers = mediaHeaders(object, media.mime_type, cacheControl, { download, fileName: media.storage_key.split("/").at(-1) ?? "source-file" });
      if (Number.isSafeInteger(object.size)) headers.set("content-length", String(object.size));
      return new Response(null, { status: 200, headers });
    }

    const object = await bucket.get(media.storage_key, range.requested ? { range: range.range } : undefined);
    if (!object) return notFoundResponse();
    const headers = mediaHeaders(object, media.mime_type, cacheControl, { download, fileName: media.storage_key.split("/").at(-1) ?? "source-file" });
    if (range.requested) {
      const rangeInfo = object.range ?? range.range;
      const offset = Number(rangeInfo?.offset ?? 0);
      const length = Number(rangeInfo?.length ?? object.size - offset);
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || length < 0) {
        return new Response(null, { status: 416, headers: { "content-range": `bytes */${object.size ?? "*"}` } });
      }
      if (Number.isSafeInteger(object.size)) headers.set("content-range", `bytes ${offset}-${offset + Math.max(0, length - 1)}/${object.size}`);
      headers.set("content-length", String(length));
      return new Response(object.body, { status: 206, headers });
    }

    if (Number.isSafeInteger(object.size)) headers.set("content-length", String(object.size));
    return new Response(object.body, { status: 200, headers });
  } catch {
    return jsonResponse({ error: "Media storage is unavailable." }, 503);
  }
}

async function handlePublicMedia(request, env, url) {
  if (!["GET", "HEAD"].includes(request.method)) return methodNotAllowed("GET, HEAD");
  if (!contentDatabaseAvailable(env)) return cmsUnavailableResponse();
  if (!mediaBucketAvailable(env)) return jsonResponse({ error: "Media storage is unavailable." }, 503);

  const segments = getPathSegments(url.pathname, publicMediaPath);
  if (!segments || segments.length !== 1 || !contentIdPattern.test(segments[0])) return notFoundResponse();

  try {
    const media = await d1First(
      env.CONTENT_DB,
      `SELECT m.id, m.content_id, m.collection, m.kind, m.mime_type, m.byte_size, m.storage_key, m.alt_text, m.visibility, m.created_at, m.updated_at
       FROM content_media AS m
       INNER JOIN content_items AS c ON c.id = m.content_id
       WHERE m.id = ? AND m.visibility = 'public' AND c.status = 'published'`,
      [segments[0].toLowerCase()],
    );
    if (!media) return notFoundResponse();
    return serveMediaObject(request, env.MEDIA_BUCKET, media, { cacheControl: publicMediaCacheControl });
  } catch (error) {
    return cmsDatabaseErrorResponse(error);
  }
}

async function handleAdminContent(request, env, url) {
  const segments = getPathSegments(url.pathname, adminContentPath);
  if (!segments || ![1, 2].includes(segments.length)) return notFoundResponse();
  const collection = canonicalCollection(segments[0]);
  if (!collection) return notFoundResponse();

  const isWrite = ["POST", "PATCH", "DELETE"].includes(request.method);
  const auth = await requireAdmin(request, env, { write: isWrite });
  if (auth.response) return auth.response;
  if (!contentDatabaseAvailable(env)) return cmsUnavailableResponse();

  const id = segments[1]?.toLowerCase();
  if (id && !contentIdPattern.test(id)) return notFoundResponse();

  try {
    if (!id && request.method === "GET") {
      const rows = await d1All(
        env.CONTENT_DB,
        `SELECT ${contentItemColumns} FROM content_items WHERE collection = ? ORDER BY updated_at DESC LIMIT ?`,
        [collection, requestLimit(url, adminContentListMax)],
      );
      const mediaRows = await getContentMediaRows(env.CONTENT_DB, rows.map((row) => row.id));
      const mediaByContent = groupRawMediaByContent(mediaRows);
      return jsonResponse({ items: rows.map((row) => contentAdminShape(row, mediaByContent.get(row.id) ?? [])), updatedAt: contentUpdatedAt(rows) });
    }

    if (!id && request.method === "POST") {
      const body = await readJsonRequest(request, contentBodyMaxBytes);
      if (body.error) return jsonResponse({ error: body.error }, body.status);
      const input = validateContentInput(body.value, collection, "create");
      if (input.error) return jsonResponse({ error: input.error }, 422);
      const result = await saveContentItem(env.CONTENT_DB, collection, null, input.value);
      if (result.error) return jsonResponse({ error: result.error }, result.status ?? 422);
      return jsonResponse({ item: result.value }, 201);
    }

    if (id && request.method === "GET") {
      const item = await getAdminContentItem(env.CONTENT_DB, collection, id);
      return item ? jsonResponse({ item }) : notFoundResponse();
    }

    if (id && request.method === "PATCH") {
      const existing = await getContentItem(env.CONTENT_DB, collection, id);
      if (!existing) return notFoundResponse();
      const body = await readJsonRequest(request, contentBodyMaxBytes);
      if (body.error) return jsonResponse({ error: body.error }, body.status);
      const input = validateContentInput(body.value, collection, "update");
      if (input.error) return jsonResponse({ error: input.error }, 422);
      const result = await saveContentItem(env.CONTENT_DB, collection, existing, input.value);
      if (result.error) return jsonResponse({ error: result.error }, result.status ?? 422);
      return jsonResponse({ item: result.value });
    }

    if (id && request.method === "DELETE") {
      const existing = await getContentItem(env.CONTENT_DB, collection, id);
      if (!existing) return notFoundResponse();
      const now = new Date().toISOString();
      const statements = [
        d1BatchStatement(
          env.CONTENT_DB,
          "UPDATE content_media SET content_id = NULL, visibility = 'private', updated_at = ? WHERE content_id = ?",
          [now, id],
        ),
        d1BatchStatement(env.CONTENT_DB, "DELETE FROM content_items WHERE id = ? AND collection = ?", [id, collection]),
      ];
      if (typeof env.CONTENT_DB.batch === "function") await env.CONTENT_DB.batch(statements);
      else for (const statement of statements) await statement.run();
      return jsonResponse({ deleted: true });
    }
  } catch (error) {
    return cmsDatabaseErrorResponse(error);
  }

  return methodNotAllowed(id ? "GET, PATCH, DELETE" : "GET, POST");
}

async function readAdminMedia(database, id) {
  return d1First(database, `SELECT ${contentMediaColumns} FROM content_media WHERE id = ?`, [id]);
}

async function readMultipartUploadSession(database, id) {
  return d1First(database, `SELECT ${contentUploadSessionColumns} FROM content_upload_sessions WHERE id = ?`, [id]);
}

async function readMultipartUploadParts(database, sessionId) {
  return d1All(
    database,
    `SELECT ${contentUploadPartColumns}
     FROM content_upload_parts
     WHERE session_id = ?
     ORDER BY part_number ASC`,
    [sessionId],
  );
}

async function expireMultipartUploadSession(database, session, now = new Date().toISOString()) {
  if (session.status !== "active" || session.expires_at > now) return session;
  await d1Run(
    database,
    "UPDATE content_upload_sessions SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'active'",
    [now, session.id],
  );
  return { ...session, status: "expired", updated_at: now };
}

async function multipartSessionResponse(database, session, status = 200) {
  const parts = await readMultipartUploadParts(database, session.id);
  return jsonResponse({ upload: multipartSessionShape(session, parts) }, status);
}

function multipartUnavailableResponse() {
  return jsonResponse({
    error: "Multipart media storage is unavailable. Enable the MEDIA_BUCKET R2 binding to upload files.",
  }, 503);
}

async function handleAdminMultipartStart(request, env) {
  if (!multipartMediaBucketAvailable(env)) return multipartUnavailableResponse();
  const body = await readJsonRequest(request, authBodyMaxBytes);
  if (body.error) return jsonResponse({ error: body.error }, body.status);
  const inputResult = multipartFileMetadataInput(body.value);
  if (inputResult.error) return jsonResponse({ error: inputResult.error }, 422);
  const input = inputResult.value;

  try {
    let parent = null;
    if (input.contentId) {
      parent = await getContentItem(env.CONTENT_DB, input.collection, input.contentId);
      if (!parent) return jsonResponse({ error: "contentId does not match an existing item in this collection." }, 422);
    }

    const now = new Date().toISOString();
    const capacity = await getMediaCapacityUsage(env.CONTENT_DB, now);
    if (capacity.total + input.byteSize > mediaStorageQuotaBytes) {
      return jsonResponse({ error: "The portfolio media safety limit (8 GB) would be exceeded by this upload. Delete unused media or wait for pending uploads to expire." }, 413);
    }

    const id = uuid();
    const storageKey = createMediaKey(input.collection, input.kind, id, input.extension);
    const upload = await env.MEDIA_BUCKET.createMultipartUpload(storageKey, {
      httpMetadata: {
        contentType: input.mimeType,
        cacheControl: publicMediaCacheControl,
      },
      customMetadata: {
        contentId: input.contentId ?? "",
        collection: input.collection,
        kind: input.kind,
      },
    });
    if (!upload || typeof upload.uploadId !== "string" || !upload.uploadId) {
      return jsonResponse({ error: "Unable to start multipart media upload." }, 503);
    }

    const session = {
      id,
      upload_id: upload.uploadId,
      content_id: input.contentId,
      collection: input.collection,
      kind: input.kind,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      part_size: input.partSize,
      part_count: input.partCount,
      storage_key: storageKey,
      alt_text: input.alt,
      status: "active",
      reserved_bytes: input.byteSize,
      expires_at: multipartSessionExpiry(),
      created_at: now,
      updated_at: now,
    };

    try {
      await d1Run(
        env.CONTENT_DB,
        `INSERT INTO content_upload_sessions
         (id, upload_id, content_id, collection, kind, mime_type, byte_size, part_size, part_count, storage_key, alt_text, status, reserved_bytes, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.upload_id,
          session.content_id,
          session.collection,
          session.kind,
          session.mime_type,
          session.byte_size,
          session.part_size,
          session.part_count,
          session.storage_key,
          session.alt_text,
          session.status,
          session.reserved_bytes,
          session.expires_at,
          session.created_at,
          session.updated_at,
        ],
      );
    } catch (error) {
      try {
        await upload.abort();
      } catch {
        // The incomplete upload is private and R2 expires it automatically.
      }
      throw error;
    }

    return multipartSessionResponse(env.CONTENT_DB, session, 201);
  } catch (error) {
    return cmsDatabaseErrorResponse(error);
  }
}

function requestContentLength(request) {
  const header = request.headers.get("content-length");
  if (!header) return null;
  if (!/^\d{1,10}$/u.test(header)) return Number.NaN;
  const value = Number(header);
  return Number.isSafeInteger(value) && value >= 0 ? value : Number.NaN;
}

async function handleAdminMultipartPart(request, env, id, partNumber) {
  if (!multipartMediaBucketAvailable(env)) return multipartUnavailableResponse();
  if (!request.body) return jsonResponse({ error: "A binary upload part is required." }, 400);

  try {
    let session = await readMultipartUploadSession(env.CONTENT_DB, id);
    if (!session) return notFoundResponse();
    session = await expireMultipartUploadSession(env.CONTENT_DB, session);
    if (session.status !== "active") {
      return jsonResponse({ error: session.status === "expired" ? "This upload session has expired. Start a new upload." : "This upload session is no longer active." }, session.status === "expired" ? 410 : 409);
    }

    const expectedBytes = expectedMultipartPartBytes(session, partNumber);
    if (!expectedBytes) return notFoundResponse();
    const declaredPartSize = parseMultipartPartSize(request);
    if (declaredPartSize !== expectedBytes) {
      return jsonResponse({ error: `x-phrnono-part-size must equal ${expectedBytes} for this part.` }, 422);
    }
    const contentLength = requestContentLength(request);
    if (Number.isNaN(contentLength) || (contentLength !== null && contentLength !== expectedBytes)) {
      return jsonResponse({ error: "The part Content-Length does not match its expected size." }, 422);
    }
    if (!compatibleDeclaredMime(request.headers.get("content-type"), session.mime_type)) {
      return jsonResponse({ error: "The declared part Content-Type does not match this upload." }, 415);
    }

    const bounded = createBoundedUploadStream(request.body, expectedBytes, partNumber === 1 ? 64 : 0);
    const upload = env.MEDIA_BUCKET.resumeMultipartUpload(session.storage_key, session.upload_id);
    const uploaded = await upload.uploadPart(partNumber, bounded.stream);
    const receivedBytes = bounded.byteSize();
    if (receivedBytes !== expectedBytes) {
      return jsonResponse({ error: `This part must contain exactly ${expectedBytes} bytes.` }, 422);
    }
    if (partNumber === 1) {
      const detectedMime = sniffMediaMime(bounded.capturedBytes());
      if (!detectedMime || !compatibleDeclaredMime(session.mime_type, detectedMime)) {
        return jsonResponse({ error: "The first upload part does not match the declared supported file type." }, 415);
      }
    }
    if (!uploaded || typeof uploaded.etag !== "string" || !uploaded.etag) {
      return jsonResponse({ error: "Media storage did not return an upload part ETag." }, 503);
    }

    const now = new Date().toISOString();
    const statements = [
      d1BatchStatement(
        env.CONTENT_DB,
        `INSERT INTO content_upload_parts (session_id, part_number, etag, byte_size, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id, part_number) DO UPDATE SET etag = excluded.etag, byte_size = excluded.byte_size, updated_at = excluded.updated_at`,
        [session.id, partNumber, uploaded.etag, receivedBytes, now, now],
      ),
      d1BatchStatement(
        env.CONTENT_DB,
        "UPDATE content_upload_sessions SET updated_at = ? WHERE id = ? AND status = 'active'",
        [now, session.id],
      ),
    ];
    if (typeof env.CONTENT_DB.batch === "function") await env.CONTENT_DB.batch(statements);
    else for (const statement of statements) await statement.run();

    session = { ...session, updated_at: now };
    const parts = await readMultipartUploadParts(env.CONTENT_DB, session.id);
    return jsonResponse({
      part: { number: partNumber, etag: uploaded.etag, byteSize: receivedBytes },
      upload: multipartSessionShape(session, parts),
    });
  } catch (error) {
    return jsonResponse({ error: "Multipart media storage is unavailable. Retry this part or start a new upload." }, 503);
  }
}

function multipartPartsComplete(session, parts) {
  if (parts.length !== session.part_count) return false;
  return parts.every((part, index) => (
    Number(part.part_number) === index + 1
      && typeof part.etag === "string"
      && part.etag.length > 0
      && Number(part.byte_size) === expectedMultipartPartBytes(session, index + 1)
  ));
}

async function markMultipartSession(database, id, status, now = new Date().toISOString()) {
  await d1Run(
    database,
    "UPDATE content_upload_sessions SET status = ?, reserved_bytes = 0, updated_at = ? WHERE id = ?",
    [status, now, id],
  );
}

async function completeMultipartSession(database, session, media, now) {
  const statements = [
    d1BatchStatement(
      database,
      `INSERT INTO content_media
       (id, content_id, collection, kind, mime_type, byte_size, storage_key, alt_text, visibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        media.id,
        media.content_id,
        media.collection,
        media.kind,
        media.mime_type,
        media.byte_size,
        media.storage_key,
        media.alt_text,
        media.visibility,
        media.created_at,
        media.updated_at,
      ],
    ),
    d1BatchStatement(
      database,
      "UPDATE content_upload_sessions SET status = 'completed', reserved_bytes = 0, updated_at = ? WHERE id = ? AND status = 'active'",
      [now, session.id],
    ),
  ];
  if (typeof database.batch === "function") await database.batch(statements);
  else for (const statement of statements) await statement.run();
}

async function handleAdminMultipartComplete(request, env, id) {
  if (!multipartMediaBucketAvailable(env)) return multipartUnavailableResponse();

  try {
    let session = await readMultipartUploadSession(env.CONTENT_DB, id);
    if (!session) return notFoundResponse();
    const existingMedia = await readAdminMedia(env.CONTENT_DB, session.id);
    if (existingMedia) {
      if (session.status !== "completed") await markMultipartSession(env.CONTENT_DB, session.id, "completed");
      return jsonResponse({ media: mediaResponseShape(existingMedia, { admin: true }) });
    }

    session = await expireMultipartUploadSession(env.CONTENT_DB, session);
    if (session.status !== "active") {
      return jsonResponse({ error: session.status === "expired" ? "This upload session has expired. Start a new upload." : "This upload session is no longer active." }, session.status === "expired" ? 410 : 409);
    }
    const parts = await readMultipartUploadParts(env.CONTENT_DB, session.id);
    if (!multipartPartsComplete(session, parts)) {
      const uploadedPartNumbers = new Set(parts.map((part) => Number(part.part_number)));
      const missingParts = Array.from({ length: session.part_count }, (_, index) => index + 1).filter((partNumber) => !uploadedPartNumbers.has(partNumber));
      return jsonResponse({ error: "All multipart upload parts must finish before completing.", missingParts }, 409);
    }

    const upload = env.MEDIA_BUCKET.resumeMultipartUpload(session.storage_key, session.upload_id);
    const object = await upload.complete(parts.map((part) => ({
      partNumber: Number(part.part_number),
      etag: part.etag,
    })));
    if (Number.isSafeInteger(object?.size) && object.size !== session.byte_size) {
      try {
        await env.MEDIA_BUCKET.delete(session.storage_key);
      } catch {
        // The object is not referenced by D1, so it cannot be served publicly.
      }
      await markMultipartSession(env.CONTENT_DB, session.id, "failed");
      return jsonResponse({ error: "Completed file size did not match the upload session." }, 422);
    }

    const parent = session.content_id
      ? await getContentItem(env.CONTENT_DB, session.collection, session.content_id)
      : null;
    const now = new Date().toISOString();
    const media = {
      id: session.id,
      content_id: parent?.id ?? null,
      collection: session.collection,
      kind: session.kind,
      mime_type: session.mime_type,
      byte_size: session.byte_size,
      storage_key: session.storage_key,
      alt_text: session.alt_text,
      // R2 finished first; this row is the sole thing that can make an object
      // public, so an in-progress object is never publicly readable.
      visibility: parent?.status === "published" ? "public" : "private",
      created_at: now,
      updated_at: now,
    };

    try {
      await completeMultipartSession(env.CONTENT_DB, session, media, now);
    } catch (error) {
      const inserted = await readAdminMedia(env.CONTENT_DB, session.id);
      if (inserted) return jsonResponse({ media: mediaResponseShape(inserted, { admin: true }) });
      try {
        await env.MEDIA_BUCKET.delete(session.storage_key);
      } catch {
        // It remains private without a D1 row even if immediate cleanup fails.
      }
      await markMultipartSession(env.CONTENT_DB, session.id, "failed");
      throw error;
    }

    return jsonResponse({ media: mediaResponseShape(media, { admin: true }) }, 201);
  } catch (error) {
    return jsonResponse({ error: "Multipart media storage is unavailable. Retry completion or start a new upload." }, 503);
  }
}

async function handleAdminMultipartAbort(env, id) {
  if (!multipartMediaBucketAvailable(env)) return multipartUnavailableResponse();

  try {
    const session = await readMultipartUploadSession(env.CONTENT_DB, id);
    if (!session) return notFoundResponse();
    if (session.status === "completed") return jsonResponse({ error: "A completed media upload cannot be aborted." }, 409);
    if (["aborted", "failed", "expired"].includes(session.status)) {
      if (session.status !== "aborted") await markMultipartSession(env.CONTENT_DB, session.id, "aborted");
      return jsonResponse({ aborted: true });
    }

    const upload = env.MEDIA_BUCKET.resumeMultipartUpload(session.storage_key, session.upload_id);
    await upload.abort();
    await markMultipartSession(env.CONTENT_DB, session.id, "aborted");
    return jsonResponse({ aborted: true });
  } catch (error) {
    return jsonResponse({ error: "Multipart media storage is unavailable. Retry abort before starting another upload." }, 503);
  }
}

async function handleAdminMultipartMedia(request, env, url) {
  const segments = url.pathname === adminMultipartMediaPath
    ? []
    : getPathSegments(url.pathname, `${adminMultipartMediaPath}/`);
  if (segments === null) return notFoundResponse();
  const isWrite = ["POST", "PUT"].includes(request.method);
  const auth = await requireAdmin(request, env, { write: isWrite });
  if (auth.response) return auth.response;
  if (!contentDatabaseAvailable(env)) return cmsUnavailableResponse();

  if (segments.length === 1 && segments[0] === "start") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    return handleAdminMultipartStart(request, env);
  }

  const id = segments[0]?.toLowerCase();
  if (!id || !contentIdPattern.test(id)) return notFoundResponse();
  if (segments.length === 1) {
    if (request.method !== "GET") return methodNotAllowed("GET");
    try {
      let session = await readMultipartUploadSession(env.CONTENT_DB, id);
      if (!session) return notFoundResponse();
      session = await expireMultipartUploadSession(env.CONTENT_DB, session);
      return multipartSessionResponse(env.CONTENT_DB, session);
    } catch (error) {
      return cmsDatabaseErrorResponse(error);
    }
  }

  if (segments.length === 3 && segments[1] === "part" && /^\d{1,5}$/u.test(segments[2])) {
    if (request.method !== "PUT") return methodNotAllowed("PUT");
    const partNumber = Number(segments[2]);
    return handleAdminMultipartPart(request, env, id, partNumber);
  }

  if (segments.length === 2 && segments[1] === "complete") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    return handleAdminMultipartComplete(request, env, id);
  }

  if (segments.length === 2 && segments[1] === "abort") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    return handleAdminMultipartAbort(env, id);
  }

  return notFoundResponse();
}

async function handleAdminMediaUpload(request, env) {
  if (!mediaBucketAvailable(env)) return jsonResponse({ error: "Media storage is unavailable. Enable the MEDIA_BUCKET R2 binding to upload files." }, 503);
  const upload = await readMediaUpload(request);
  if (upload.error) return jsonResponse({ error: upload.error }, upload.status ?? 400);
  const input = upload.value;

  try {
    let parent = null;
    if (input.contentId) {
      parent = await getContentItem(env.CONTENT_DB, input.collection, input.contentId);
      if (!parent) return jsonResponse({ error: "contentId does not match an existing item in this collection." }, 422);
    }

    const capacity = await getMediaCapacityUsage(env.CONTENT_DB);
    if (capacity.total + input.file.size > mediaStorageQuotaBytes) {
      return jsonResponse({ error: "The portfolio media safety limit (8 GB) has been reached. Delete unused media before uploading more." }, 413);
    }

    const id = uuid();
    const now = new Date().toISOString();
    const storageKey = createMediaKey(input.collection, input.kind, id, input.extension);
    const visibility = parent?.status === "published" ? "public" : "private";
    const row = {
      id,
      content_id: input.contentId,
      collection: input.collection,
      kind: input.kind,
      mime_type: input.mimeType,
      byte_size: input.file.size,
      storage_key: storageKey,
      alt_text: input.alt,
      visibility,
      created_at: now,
      updated_at: now,
    };

    await env.MEDIA_BUCKET.put(storageKey, input.file.stream(), {
      httpMetadata: {
        contentType: input.mimeType,
        cacheControl: publicMediaCacheControl,
      },
      customMetadata: {
        contentId: input.contentId ?? "",
        collection: input.collection,
        kind: input.kind,
      },
    });

    try {
      await d1Run(
        env.CONTENT_DB,
        `INSERT INTO content_media
         (id, content_id, collection, kind, mime_type, byte_size, storage_key, alt_text, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.content_id,
          row.collection,
          row.kind,
          row.mime_type,
          row.byte_size,
          row.storage_key,
          row.alt_text,
          row.visibility,
          row.created_at,
          row.updated_at,
        ],
      );
    } catch (error) {
      try {
        await env.MEDIA_BUCKET.delete(storageKey);
      } catch {
        // The object is inaccessible without a D1 media row, and can be removed later by bucket lifecycle tooling.
      }
      throw error;
    }

    return jsonResponse({ media: mediaResponseShape(row, { admin: true }) }, 201);
  } catch (error) {
    return cmsDatabaseErrorResponse(error);
  }
}

async function handleAdminMedia(request, env, url) {
  const segments = url.pathname === adminMediaPath ? [] : getPathSegments(url.pathname, `${adminMediaPath}/`);
  if (segments === null || segments.length > 2) return notFoundResponse();
  const isWrite = ["POST", "PATCH", "DELETE"].includes(request.method);
  const auth = await requireAdmin(request, env, { write: isWrite });
  if (auth.response) return auth.response;
  if (!contentDatabaseAvailable(env)) return cmsUnavailableResponse();

  if (segments.length === 0) {
    if (request.method === "POST") return handleAdminMediaUpload(request, env);
    if (request.method !== "GET") return methodNotAllowed("GET, POST");

    const suppliedCollection = url.searchParams.get("collection");
    const collection = suppliedCollection ? canonicalCollection(suppliedCollection) : null;
    if (suppliedCollection && !collection) return jsonResponse({ error: "collection is invalid." }, 422);
    const contentId = url.searchParams.get("contentId");
    if (contentId && !contentIdPattern.test(contentId)) return jsonResponse({ error: "contentId is invalid." }, 422);
    const clauses = [];
    const values = [];
    if (collection) {
      clauses.push("collection = ?");
      values.push(collection);
    }
    if (contentId) {
      clauses.push("content_id = ?");
      values.push(contentId.toLowerCase());
    }
    values.push(requestLimit(url, adminContentListMax));
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    try {
      const rows = await d1All(env.CONTENT_DB, `SELECT ${contentMediaColumns} FROM content_media ${where} ORDER BY updated_at DESC LIMIT ?`, values);
      return jsonResponse({ items: rows.map((row) => mediaResponseShape(row, { admin: true })), updatedAt: contentUpdatedAt(rows) });
    } catch (error) {
      return cmsDatabaseErrorResponse(error);
    }
  }

  const id = segments[0]?.toLowerCase();
  if (!contentIdPattern.test(id)) return notFoundResponse();
  const isFileRoute = segments.length === 2 && segments[1] === "file";
  if (segments.length === 2 && !isFileRoute) return notFoundResponse();

  try {
    const media = await readAdminMedia(env.CONTENT_DB, id);
    if (!media) return notFoundResponse();

    if (isFileRoute) {
      if (!["GET", "HEAD"].includes(request.method)) return methodNotAllowed("GET, HEAD");
      if (!mediaBucketAvailable(env)) return jsonResponse({ error: "Media storage is unavailable. Enable the MEDIA_BUCKET R2 binding to preview files." }, 503);
      return serveMediaObject(request, env.MEDIA_BUCKET, media, {
        cacheControl: "no-store",
        // The source download is an authenticated owner action. All other
        // admin previews remain inline so the owner can inspect assets.
        download: url.searchParams.get("download") === "1",
      });
    }

    if (request.method === "GET") return jsonResponse({ media: mediaResponseShape(media, { admin: true }) });

    if (request.method === "PATCH") {
      const body = await readJsonRequest(request, authBodyMaxBytes);
      if (body.error) return jsonResponse({ error: body.error }, body.status);
      if (!isPlainObject(body.value) || Object.keys(body.value).some((key) => key !== "alt")) {
        return jsonResponse({ error: "Only alt may be updated for media." }, 422);
      }
      const alt = normalizeOptionalText(body.value.alt, "alt", 500, { allowEmpty: true });
      if (alt.error || alt.value === null) return jsonResponse({ error: alt.error ?? "alt must be text." }, 422);
      const now = new Date().toISOString();
      await d1Run(env.CONTENT_DB, "UPDATE content_media SET alt_text = ?, updated_at = ? WHERE id = ?", [alt.value, now, id]);
      return jsonResponse({ media: mediaResponseShape({ ...media, alt_text: alt.value, updated_at: now }, { admin: true }) });
    }

    if (request.method === "DELETE") {
      if (media.content_id) return jsonResponse({ error: "Detach this media from its content item before deleting it." }, 409);
      if (!mediaBucketAvailable(env) || typeof env.MEDIA_BUCKET.delete !== "function") {
        return jsonResponse({ error: "Media storage is unavailable. Enable the MEDIA_BUCKET R2 binding to delete files." }, 503);
      }
      await env.MEDIA_BUCKET.delete(media.storage_key);
      await d1Run(env.CONTENT_DB, "DELETE FROM content_media WHERE id = ?", [id]);
      return jsonResponse({ deleted: true });
    }
  } catch (error) {
    return cmsDatabaseErrorResponse(error);
  }

  return methodNotAllowed(isFileRoute ? "GET, HEAD" : "GET, PATCH, DELETE");
}

export class CiaGuideLimiter {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (!["/consume", "/daily"].includes(url.pathname)) return jsonResponse({ error: "Not found." }, 404);
    if (request.method !== "POST") return methodNotAllowed("POST");

    if (url.pathname === "/consume") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid request." }, 400);
      }
      if (!/^[A-Za-z0-9_-]{20,}$/u.test(body?.key)) return jsonResponse({ error: "Invalid request." }, 400);
    }

    let result;
    await runDurableObjectExclusive(this.state, async () => {
      const now = Date.now();
      const isDaily = url.pathname === "/daily";
      const storageKey = isDaily ? "daily" : "bucket";
      const resetAt = isDaily
        ? Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1)
        : now + ciaGuideWindowMs;
      const existing = await this.storage.get(storageKey);
      const record = existing && Number.isSafeInteger(existing.count) && Number.isSafeInteger(existing.resetAt) && existing.resetAt > now
        ? existing
        : { count: 0, resetAt };

      record.count += 1;
      await this.storage.put(storageKey, record);
      if (typeof this.storage.setAlarm === "function") await this.storage.setAlarm(record.resetAt);
      const allowed = record.count <= (isDaily ? ciaGuideDailyMaxRequests : ciaGuideMaxRequests);
      result = {
        allowed,
        retryAfter: allowed ? 0 : Math.ceil((record.resetAt - now) / 1000),
      };
    });

    return jsonResponse(result);
  }

  async alarm() {
    await runDurableObjectExclusive(this.state, async () => {
      const now = Date.now();
      for (const key of ["bucket", "daily"]) {
        const record = await this.storage.get(key);
        if (record && (!Number.isSafeInteger(record.resetAt) || record.resetAt <= now)) {
          await this.storage.delete(key);
        }
      }
    });
  }
}

export class AuthLimiter {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/attempt") return jsonResponse({ error: "Not found." }, 404);
    if (request.method !== "POST") return methodNotAllowed("POST");

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid request." }, 400);
    }

    if (!/^[A-Za-z0-9_-]{20,}$/u.test(body?.key) || !["check", "failure", "consume", "success"].includes(body?.outcome)) {
      return jsonResponse({ error: "Invalid request." }, 400);
    }

    let result;
    await runDurableObjectExclusive(this.state, async () => {
      const storageKey = `rate:${body.key}`;
      const now = Date.now();
      const existing = await this.storage.get(storageKey);
      const record = existing && Number.isSafeInteger(existing.failures) && Number.isSafeInteger(existing.resetAt) && existing.resetAt > now
        ? existing
        : { failures: 0, resetAt: now + authWindowMs };

      if (body.outcome === "success") {
        await this.storage.delete(storageKey);
        result = { allowed: true, retryAfter: 0 };
        return;
      }

      if (body.outcome === "failure" || body.outcome === "consume") {
        record.failures += 1;
        await this.storage.put(storageKey, record);
      }

      const allowed = record.failures < authMaxFailures;
      result = {
        allowed,
        retryAfter: allowed ? 0 : Math.ceil((record.resetAt - now) / 1000),
      };
    });

    return jsonResponse(result);
  }
}

export class VisitorCounter {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  async getStats(now = new Date()) {
    const day = getCounterDay(now);
    const [total, today] = await Promise.all([
      this.storage.get("total"),
      this.storage.get(`day:${day}`),
    ]);

    return { total: counterValue(total), today: counterValue(today), day };
  }

  async listCounts(prefix, limit = 200) {
    if (typeof this.storage.list !== "function") return [];
    try {
      const entries = await this.storage.list({ prefix, limit });
      return Array.from(entries, ([key, value]) => ({
        key: key.slice(prefix.length),
        count: counterValue(value),
      })).sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
    } catch {
      return [];
    }
  }

  async getAnalytics(now = new Date()) {
    const day = getCounterDay(now);
    const [cvTotal, cvToday, workTotal, workToday, dwellSeconds, dwellEvents, workClicks, countries, devices] = await Promise.all([
      this.storage.get("event:cv_download:total"),
      this.storage.get(`event:cv_download:day:${day}`),
      this.storage.get("event:work_click:total"),
      this.storage.get(`event:work_click:day:${day}`),
      this.storage.get("event:work_dwell:seconds:total"),
      this.storage.get("event:work_dwell:total"),
      this.listCounts("event:work_click:slug:"),
      this.listCounts("visitor:country:"),
      this.listCounts("visitor:device:"),
    ]);

    return {
      day,
      cvDownloads: { total: counterValue(cvTotal), today: counterValue(cvToday) },
      workClicks: {
        total: counterValue(workTotal),
        today: counterValue(workToday),
        bySlug: Object.fromEntries(workClicks.map(({ key, count }) => [key, count])),
      },
      workDwell: {
        seconds: counterValue(dwellSeconds),
        events: counterValue(dwellEvents),
      },
      countries,
      devices,
    };
  }

  async record(now = new Date(), dimensions = {}) {
    let next;
    await runDurableObjectExclusive(this.state, async () => {
      const current = await this.getStats(now);
      next = {
        ...current,
        total: current.total + 1,
        today: current.today + 1,
      };

      const writes = [
        this.storage.put("total", next.total),
        this.storage.put(`day:${next.day}`, next.today),
      ];
      const country = typeof dimensions.country === "string" && /^[A-Z]{2}$/u.test(dimensions.country) ? dimensions.country : "XX";
      const device = ["desktop", "mobile", "tablet"].includes(dimensions.device) ? dimensions.device : "desktop";
      const countryKey = `visitor:country:${country}`;
      const deviceKey = `visitor:device:${device}`;
      const [countryCount, deviceCount] = await Promise.all([this.storage.get(countryKey), this.storage.get(deviceKey)]);
      writes.push(this.storage.put(countryKey, counterValue(countryCount) + 1));
      writes.push(this.storage.put(deviceKey, counterValue(deviceCount) + 1));
      await Promise.all(writes);
    });
    return next;
  }

  async recordEvent(type, slug, duration = 0, now = new Date()) {
    let result;
    await runDurableObjectExclusive(this.state, async () => {
      const day = getCounterDay(now);
      const totalKey = `event:${type}:total`;
      const dayKey = `event:${type}:day:${day}`;
      const [total, today] = await Promise.all([this.storage.get(totalKey), this.storage.get(dayKey)]);
      const nextTotal = counterValue(total) + 1;
      const nextToday = counterValue(today) + 1;
      const writes = [this.storage.put(totalKey, nextTotal), this.storage.put(dayKey, nextToday)];
      if (type === "work_click" && slug) {
        const slugKey = `event:work_click:slug:${slug}`;
        const slugCount = await this.storage.get(slugKey);
        writes.push(this.storage.put(slugKey, counterValue(slugCount) + 1));
      }
      if (type === "work_dwell" && slug) {
        const seconds = Number.isSafeInteger(duration) && duration > 0 ? duration : 0;
        const totalSecondsKey = "event:work_dwell:seconds:total";
        const slugSecondsKey = `event:work_dwell:seconds:${slug}`;
        const [totalSeconds, slugSeconds] = await Promise.all([
          this.storage.get(totalSecondsKey),
          this.storage.get(slugSecondsKey),
        ]);
        writes.push(this.storage.put(totalSecondsKey, counterValue(totalSeconds) + seconds));
        writes.push(this.storage.put(slugSecondsKey, counterValue(slugSeconds) + seconds));
      }
      await Promise.all(writes);
      result = { total: nextTotal, today: nextToday, day };
    });
    return result;
  }

  async reset() {
    if (typeof this.storage.list !== "function" || typeof this.storage.delete !== "function") {
      throw new Error("Visitor counter storage reset is unavailable");
    }

    await runDurableObjectExclusive(this.state, async () => {
      await this.storage.delete("total");

      for (const prefix of visitorAnalyticsStoragePrefixes) {
        let startAfter = "";
        while (true) {
          const options = { prefix, limit: visitorAnalyticsResetPageSize };
          if (startAfter) options.startAfter = startAfter;
          const entries = await this.storage.list(options);
          const keys = Array.from(entries.keys()).sort();
          if (keys.length === 0) break;

          await Promise.all(keys.map((key) => this.storage.delete(key)));
          if (keys.length < visitorAnalyticsResetPageSize) break;
          startAfter = keys.at(-1);
        }
      }
    });

    return { reset: true };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (!["/visitors", "/event", "/analytics", "/reset"].includes(url.pathname)) return jsonResponse({ error: "Not found." }, 404);

    if (url.pathname === "/visitors") {
      if (request.method === "GET") return jsonResponse(await this.getStats());
      if (request.method === "POST") {
        return jsonResponse(await this.record(new Date(), {
          country: request.headers.get("x-visitor-country"),
          device: request.headers.get("x-visitor-device"),
        }));
      }
    }

    if (url.pathname === "/analytics") {
      if (request.method === "GET") return jsonResponse(await this.getAnalytics());
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      return jsonResponse(await this.reset());
    }

    if (url.pathname === "/event" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid request." }, 400);
      }
      if (!analyticsEventTypes.has(body?.type) || (["work_click", "work_dwell"].includes(body.type) && (!body.slug || !analyticsSlugPattern.test(body.slug)))) {
        return jsonResponse({ error: "Invalid analytics event." }, 422);
      }
      return jsonResponse({ recorded: true, ...(await this.recordEvent(body.type, body.slug || null, body.duration)) });
    }

    return new Response(null, {
      status: 405,
      headers: { ...jsonHeaders, allow: url.pathname === "/analytics" ? "GET" : "GET, POST" },
    });
  }
}

async function handleRequest(request, env) {
    const url = new URL(request.url);
    if (url.pathname === visitorApiPath) return handleVisitorApi(request, env);
    if (url.pathname === analyticsEventsPath) return handleAnalyticsEvents(request, env);
    if (url.pathname === contactApiPath) return handleContact(request, env);
    if (url.pathname === ciaGuideApiPath) return handleCiaGuide(request, env);
    if (url.pathname === authLoginPath) return handleAuthLogin(request, env);
    if (url.pathname === authSessionPath) return handleAuthSession(request, env);
    if (url.pathname === authLogoutPath) return handleAuthLogout(request);
    if (url.pathname === adminOverviewPath) return handleAdminOverview(request, env);
    if (url.pathname === adminAnalyticsResetPath) return handleAdminAnalyticsReset(request, env);
    if (url.pathname === "/api/admin/tasks" || url.pathname.startsWith("/api/admin/tasks/") || url.pathname.startsWith("/api/admin/contacts/")) {
      return handleAdminOperations(request, env, url, { requireAdmin, readJsonRequest, jsonResponse, methodNotAllowed, isPlainObject });
    }
    if (url.pathname.startsWith(publicContentPath)) return handlePublicContent(request, env, url);
    if (url.pathname.startsWith(publicMediaPath)) return handlePublicMedia(request, env, url);
    if (url.pathname.startsWith(adminContentPath)) return handleAdminContent(request, env, url);
    if (url.pathname === adminMultipartMediaPath || url.pathname.startsWith(`${adminMultipartMediaPath}/`)) {
      return handleAdminMultipartMedia(request, env, url);
    }
    if (url.pathname === adminMediaPath || url.pathname.startsWith(`${adminMediaPath}/`)) return handleAdminMedia(request, env, url);

    const assets = env.SITE_ASSETS ?? env.ASSETS;
    if (isMusicTrack(url)) return cacheMusicTrack(await assets.fetch(request));

    const response = await assets.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return assets.fetch(new Request(indexUrl, request));
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isSameOrigin(request)) {
      await recordSecurityEvent(env, "suspiciousRequests");
      return withSecurityHeaders(jsonResponse({ error: "Invalid origin." }, 403));
    }
    const response = await handleRequest(request, env);
    if (response.status === 429 && [authLoginPath, contactApiPath, ciaGuideApiPath].includes(pathname)) {
      await recordSecurityEvent(env, "rateLimited");
    }
    return withSecurityHeaders(response);
  },
};
