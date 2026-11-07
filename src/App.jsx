import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Compass,
  EnvelopeSimple,
  FilePdf,
  House,
  ImagesSquare,
  List,
  Plus,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from "@phosphor-icons/react";
import tacticalGrid from "./assets/tactical-grid.webp";
import AccordionGallery from "./components/AccordionGallery";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import CiaArchiveAssistant from "./components/CiaArchiveAssistant";
import LocalizedDecryptedText from "./components/LocalizedDecryptedText";
import FlowingMenu from "./components/FlowingMenu";
import GamePhotoWall from "./components/GamePhotoWall";
import LineSidebar from "./components/LineSidebar";
import MusicPage from "./components/MusicPage";
import RouteTransition from "./components/RouteTransition";
import ShapeGrid from "./components/ShapeGrid";
import TerminalSequence from "./components/TerminalSequence";
import { normalizeWorkContent, usePublishedContent } from "./contentApi";
import { localeOptions, translations } from "./i18n";
import { ciaAIProjectCopy } from "./ciaAIProjectData";
import {
  detailProjectOrder,
  detailProjects,
  projects,
} from "./projectData";

const profileUrl = "https://www.artstation.com/phrolova";
const CharacterArchive = lazy(() => import("./components/CharacterArchive"));
const CiaAIProject = lazy(() => import("./components/CiaAIProject"));
const introSessionStorageKey = "phrnono-terminal-intro-v3";
const routeTransitionStorageKey = "phrnono-route-transition";
const visitorCountedDayStorageKey = "phrnono-visitor-counted-day";
const visitorAttemptDayStorageKey = "phrnono-visitor-attempt-day";
let siteAudioContext;
let visitorStatsRequest;
let turnstileScriptPromise;

function getVisitorDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A private browser mode can block storage. The page still works without it.
  }
}

function readSessionStorage(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // The counter remains functional if session storage is unavailable.
  }
}

function validVisitorStats(value) {
  if (!value || !Number.isSafeInteger(value.total) || !Number.isSafeInteger(value.today)) return null;
  if (value.total < 0 || value.today < 0) return null;
  return { total: value.total, today: value.today };
}

function loadVisitorStats() {
  const day = getVisitorDay();
  if (visitorStatsRequest?.day === day) return visitorStatsRequest.promise;

  const promise = (async () => {
    let shouldRecord = readStorage(visitorCountedDayStorageKey) !== day;

    if (shouldRecord && readSessionStorage(visitorAttemptDayStorageKey) === day) {
      shouldRecord = false;
    }

    if (shouldRecord) writeSessionStorage(visitorAttemptDayStorageKey, day);

    const response = await fetch("/api/visitors", {
      method: shouldRecord ? "POST" : "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;

    const stats = validVisitorStats(await response.json());
    if (stats && shouldRecord) writeStorage(visitorCountedDayStorageKey, day);
    return stats;
  })();

  visitorStatsRequest = { day, promise };
  promise.catch(() => {
    if (visitorStatsRequest?.promise === promise) visitorStatsRequest = null;
  });
  return promise;
}

function formatVisitorCount(value, locale) {
  const language = locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "zh-CN";
  return new Intl.NumberFormat(language).format(value);
}

function trackAnalyticsEvent(type, slug = "", duration) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ type, ...(slug ? { slug } : {}), ...(Number.isSafeInteger(duration) ? { duration } : {}) });
  try {
    if (typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(
        "/api/analytics/events",
        new Blob([payload], { type: "application/json" }),
      );
      if (sent) return;
    }
  } catch {
    // Fall back to fetch when Beacon is unavailable or blocked.
  }
  void fetch("/api/analytics/events", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: payload,
  }).catch(() => {});
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile is browser-only."));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-phrnono-turnstile]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.phrnonoTurnstile = "true";
    script.addEventListener("load", () => resolve(window.turnstile), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

function getInitialLocale() {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem("phrolova-locale");
  return localeOptions.some((option) => option.code === saved) ? saved : "zh";
}

function getInitialIntroVisible() {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin" || path === "/admin/login") return false;
  return readSessionStorage(introSessionStorageKey) !== "true";
}

function getInitialRouteTransitionPhase() {
  if (typeof window === "undefined") return "idle";
  try {
    const marker = JSON.parse(window.sessionStorage.getItem(routeTransitionStorageKey) || "null");
    const age = Date.now() - marker?.at;
    if (
      marker && Number.isFinite(age) && age >= 0 && age < 10000 &&
      marker.pathname === window.location.pathname && marker.search === window.location.search
    ) return "arriving";
    window.sessionStorage.removeItem(routeTransitionStorageKey);
  } catch {
    return "idle";
  }
  return "idle";
}

function getInitialSoundEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("phrolova-sound-enabled") === "true";
}

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { kind: "home", path };
  if (path === "/admin" || path === "/admin/login") return { kind: "admin", path };
  if (path === "/work") return { kind: "work", path };
  if (path === "/work/cia-ai") return { kind: "ciaAI", path };
  if (path === "/game-wall") return { kind: "gameWall", path };
  if (path === "/music") return { kind: "music", path };
  if (path === "/character-design") return { kind: "character", path };
  if (path === "/work/3d-props") return { kind: "work", path };
  if (path.startsWith("/work/")) {
    const slug = path.slice("/work/".length);
    if (detailProjects[slug]) return { kind: "detail", path, slug, project: detailProjects[slug] };
  }
  return { kind: "notFound", path };
}

function getHashTargetId(hash) {
  const encodedId = hash.replace(/^#/, "");
  if (!encodedId) return "";

  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}

function playSiteSound(kind = "click") {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  siteAudioContext ??= new AudioContextClass();
  if (siteAudioContext.state === "suspended") void siteAudioContext.resume();

  const oscillator = siteAudioContext.createOscillator();
  const gain = siteAudioContext.createGain();
  const now = siteAudioContext.currentTime;
  const frequencies = { click: 420, switch: 560, on: 700, off: 320 };

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequencies[kind] ?? frequencies.click, now);
  if (kind === "on") oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.075);
  if (kind === "off") oscillator.frequency.exponentialRampToValueAtTime(240, now + 0.075);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  oscillator.connect(gain);
  gain.connect(siteAudioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.095);
}

function LanguageSwitcher({ copy, locale, onChange, variant = "desktop" }) {
  return (
    <div className={`language-switcher language-switcher-${variant}`} role="group" aria-label={copy.languageLabel}>
      {localeOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.documentLang}
          className={locale === option.code ? "active" : ""}
          aria-pressed={locale === option.code}
          aria-label={`${copy.switchLanguage} ${option.name}`}
          onClick={() => onChange(option.code)}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}

function SoundToggle({ copy, enabled, onToggle, variant = "desktop" }) {
  const label = enabled ? copy.sound.disableAria : copy.sound.enableAria;

  return (
    <button
      className={`sound-toggle sound-toggle-${variant}`}
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      onClick={onToggle}
    >
      {enabled ? <SpeakerHigh size={17} weight="bold" /> : <SpeakerSlash size={17} weight="bold" />}
      <span>{enabled ? copy.sound.on : copy.sound.off}</span>
    </button>
  );
}


async function readAdminApiResponse(response, fallbackMessage) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // The Worker always returns JSON for these endpoints, but the interface
    // should remain useful if an intermediary returns an unexpected response.
  }

  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : fallbackMessage);
  return body;
}

const adminContentCollections = ["music", "game-wall", "works"];
const directMediaUploadMaxBytes = 20 * 1024 * 1024;
const maximumMediaUploadBytes = 500 * 1024 * 1024;
const defaultMultipartPartBytes = 16 * 1024 * 1024;
const minimumMultipartPartBytes = 5 * 1024 * 1024;
const maximumMultipartPartBytes = 32 * 1024 * 1024;

/**
 * Authenticated R2 multipart contract (all requests stay same-origin):
 * POST /api/admin/media/multipart/start -> { upload: { id, partSize, partCount } }
 * PUT /api/admin/media/multipart/{id}/part/{partNumber} sends one raw Blob, then
 * POST /api/admin/media/multipart/{id}/complete with {} -> { media }.
 * The Worker stores part ETags itself; the browser never sends an object-storage credential.
 */

function isContentRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function reportMediaUploadProgress(onProgress, detail) {
  if (typeof onProgress !== "function") return;
  onProgress(detail);
}

function validMultipartPartSize(value) {
  const partSize = Number(value);
  if (!Number.isSafeInteger(partSize)) return defaultMultipartPartBytes;
  if (partSize < minimumMultipartPartBytes || partSize > maximumMultipartPartBytes) {
    throw new Error("上传服务返回了无效的分段大小，请重新开始上传。");
  }
  return partSize;
}

function requireUploadedMedia(body) {
  const media = body?.media;
  if (!media?.id || !media?.url) throw new Error("上传服务没有返回媒体地址。");
  return media;
}

function mediaSourceUrl(media) {
  if (!media || typeof media !== "object") return "";
  return [media.fileUrl, media.url].find((value) => typeof value === "string" && value.trim()) ?? "";
}

function multipartUploadPath(uploadId, suffix = "") {
  return `/api/admin/media/multipart/${encodeURIComponent(uploadId)}${suffix}`;
}

async function abortMultipartUpload(uploadId) {
  if (!textValue(uploadId)) return;

  try {
    await fetch(multipartUploadPath(uploadId, "/abort"), {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: "{}",
    });
  } catch {
    // A failed abort only leaves an incomplete R2 upload, which the Worker expires.
  }
}

async function uploadDirectMedia({ type, id, field, file, item, onProgress }) {
  reportMediaUploadProgress(onProgress, { phase: "uploading", totalBytes: file.size });

  const form = new FormData();
  form.set("collection", type);
  form.set("file", file);
  if (id) form.set("contentId", id);
  if (field === "cover" && textValue(item?.alt)) form.set("alt", textValue(item.alt));

  const response = await fetch("/api/admin/media", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    body: form,
  });
  return requireUploadedMedia(await readAdminApiResponse(response, "无法上传媒体文件。"));
}

async function uploadMultipartMedia({ type, id, field, file, item, onProgress }) {
  const mimeType = textValue(file.type) || "application/octet-stream";
  const startPayload = {
    collection: type,
    contentId: id,
    fileName: file.name,
    fileSize: file.size,
    mimeType,
  };
  if (field === "cover" && textValue(item?.alt)) startPayload.alt = textValue(item.alt);

  reportMediaUploadProgress(onProgress, { phase: "preparing", loadedBytes: 0, totalBytes: file.size });

  const startResponse = await fetch("/api/admin/media/multipart/start", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(startPayload),
  });
  const startData = await readAdminApiResponse(startResponse, "无法建立分段上传。");
  const upload = startData?.upload;
  const uploadId = textValue(upload?.id);
  if (!uploadId) throw new Error("上传服务没有返回分段上传编号。");

  try {
    const partSize = validMultipartPartSize(upload?.partSize);
    const partCount = Math.ceil(file.size / partSize);
    if (!Number.isSafeInteger(partCount) || partCount < 1) throw new Error("无法计算上传分段，请重新选择文件。");
    if (Number.isSafeInteger(upload?.partCount) && upload.partCount !== partCount) {
      throw new Error("上传服务的分段信息不一致，请重新开始上传。");
    }

    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      const offset = (partNumber - 1) * partSize;
      const end = Math.min(offset + partSize, file.size);
      const part = file.slice(offset, end, mimeType);
      const response = await fetch(multipartUploadPath(uploadId, `/part/${partNumber}`), {
        method: "PUT",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": mimeType,
          "x-phrnono-part-size": String(part.size),
        },
        body: part,
      });
      await readAdminApiResponse(response, `无法上传第 ${partNumber} 个分段。`);
      reportMediaUploadProgress(onProgress, {
        phase: "uploading",
        loadedBytes: end,
        totalBytes: file.size,
        partNumber,
        partCount,
      });
    }

    reportMediaUploadProgress(onProgress, { phase: "finalizing", loadedBytes: file.size, totalBytes: file.size, partCount });
    const completeResponse = await fetch(multipartUploadPath(uploadId, "/complete"), {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: "{}",
    });
    return requireUploadedMedia(await readAdminApiResponse(completeResponse, "无法完成分段上传。"));
  } catch (error) {
    await abortMultipartUpload(uploadId);
    throw error;
  }
}

function mediaForId(media, id, kind) {
  if (!id) return null;
  return media.find((item) => item?.id === id && (!kind || item.kind === kind)) ?? null;
}

function firstMediaOfKind(media, kind) {
  return media.find((item) => item?.kind === kind) ?? null;
}

function normalizeAdminContentItem(item) {
  if (!isContentRecord(item)) return item;

  const data = isContentRecord(item.data) ? item.data : {};
  const media = Array.isArray(item.media) ? item.media.filter(isContentRecord) : [];
  const cover = mediaForId(media, item.coverMediaId, "image") ?? firstMediaOfKind(media, "image");
  const image = mediaForId(media, data.imageMediaId, "image") ?? cover;
  const artwork = mediaForId(media, data.artworkMediaId, "image") ?? cover;
  const audio = mediaForId(media, data.audioMediaId, "audio") ?? firstMediaOfKind(media, "audio");

  return {
    ...item,
    data,
    media,
    description: item.summary ?? "",
    artist: data.artist ?? "",
    release: data.release ?? "",
    duration: data.duration ?? "",
    lyrics: data.lyrics ?? "",
    category: data.category ?? data.genre ?? "",
    group: data.group ?? "",
    number: data.number ?? "",
    shape: data.shape ?? "standard",
    letterboxed: Boolean(data.letterboxed),
    discipline: data.discipline ?? "",
    year: data.year ?? "",
    alt: data.alt ?? image?.alt ?? "",
    externalUrl: data.externalUrl ?? "",
    // Draft media is private, so the admin editor must use its authenticated
    // file URL for previews. Published pages continue to use the public URL.
    cover: mediaSourceUrl(item.collection === "music" ? artwork : image) || mediaSourceUrl(cover),
    audio: mediaSourceUrl(audio),
  };
}

function adminContentItems(body) {
  return Array.isArray(body?.items) ? body.items.map(normalizeAdminContentItem) : [];
}

function createContentSlug(title, collection) {
  const base = textValue(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 88);
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `${base || collection}-${suffix}`.slice(0, 120);
}

function optionalContentText(value) {
  const normalized = textValue(value);
  return normalized || null;
}

function resolveUploadedMediaId(value, previous, fallbackId, uploadedMediaByUrl) {
  const url = textValue(value);
  if (url) {
    const uploaded = uploadedMediaByUrl.current.get(url);
    if (uploaded?.id) return uploaded.id;
    const existing = Array.isArray(previous?.media) ? previous.media.find((media) => media?.url === url) : null;
    if (existing?.id) return existing.id;
  }

  return fallbackId || null;
}

function toAdminContentPayload(collection, item, previous, uploadedMediaByUrl) {
  const previousData = isContentRecord(previous?.data) ? previous.data : {};
  const title = textValue(item?.title);
  const status = item?.status === "published" ? "published" : "draft";
  const coverMediaId = resolveUploadedMediaId(item?.cover, previous, previous?.coverMediaId, uploadedMediaByUrl);
  const payload = {
    title,
    summary: typeof item?.description === "string" ? item.description.trim() : "",
    status,
    data: {},
  };

  if (!previous) payload.slug = createContentSlug(title, collection);
  if (coverMediaId) payload.coverMediaId = coverMediaId;

  if (collection === "music") {
    payload.data = {
      artist: optionalContentText(item?.artist),
      release: optionalContentText(item?.release),
      genre: optionalContentText(item?.category),
      duration: optionalContentText(item?.duration),
      lyrics: typeof item?.lyrics === "string" ? item.lyrics : null,
      artworkMediaId: resolveUploadedMediaId(item?.cover, previous, previousData.artworkMediaId ?? coverMediaId, uploadedMediaByUrl),
      audioMediaId: resolveUploadedMediaId(item?.audio, previous, previousData.audioMediaId, uploadedMediaByUrl),
    };
  } else if (collection === "game-wall") {
    const numberText = textValue(item?.number);
    payload.data = {
      group: optionalContentText(item?.group),
      number: numberText ? Number(numberText) : null,
      shape: optionalContentText(item?.shape),
      letterboxed: Boolean(item?.letterboxed),
      imageMediaId: resolveUploadedMediaId(item?.cover, previous, previousData.imageMediaId ?? coverMediaId, uploadedMediaByUrl),
      thumbnailMediaId: previousData.thumbnailMediaId ?? null,
    };
  } else {
    payload.data = {
      category: optionalContentText(item?.category),
      year: optionalContentText(item?.year),
      discipline: optionalContentText(item?.discipline),
      alt: optionalContentText(item?.alt),
      externalUrl: optionalContentText(item?.externalUrl),
      imageMediaId: resolveUploadedMediaId(item?.cover, previous, previousData.imageMediaId ?? coverMediaId, uploadedMediaByUrl),
    };
  }

  return payload;
}


function AdminControlRoom({ onExitToHome, locale, openingEnabled = true }) {
  const [adminOpeningVisible, setAdminOpeningVisible] = useState(true);
  const [adminOpeningBlocking, setAdminOpeningBlocking] = useState(true);
  const [adminBuildStep, setAdminBuildStep] = useState(0);
  const [authorizationVisible, setAuthorizationVisible] = useState(false);
  const [authorizationBlocking, setAuthorizationBlocking] = useState(false);
  const [authState, setAuthState] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [analyticsResetting, setAnalyticsResetting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminContent, setAdminContent] = useState({ music: [], "game-wall": [], works: [] });
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const uploadedMediaByUrl = useRef(new Map());
  const finishAdminOpening = useCallback(() => {
    setAdminBuildStep(4);
    setAdminOpeningVisible(false);
  }, []);
  const advanceAdminBuild = useCallback((step) => setAdminBuildStep(step), []);
  const finishAuthorization = useCallback(() => setAuthorizationVisible(false), []);
  const showAuthorizedControlRoom = useCallback(() => {
    setAuthorizationBlocking(false);
    setAuthState((currentState) => (currentState === "authorizing" ? "authenticated" : currentState));
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError("");

    try {
      const response = await fetch("/api/admin/overview", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });

      if (response.status === 401) {
        setAuthState("signed-out");
        setOverview(null);
        return false;
      }

      const data = await readAdminApiResponse(response, "无法读取后台摘要。");
      setOverview(data);
      return true;
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "无法读取后台摘要。");
      return false;
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadAdminContent = useCallback(async () => {
    setContentLoading(true);
    setContentError("");

    try {
      const entries = await Promise.all(adminContentCollections.map(async (collection) => {
        const response = await fetch(`/api/admin/content/${collection}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const data = await readAdminApiResponse(response, "无法读取内容管理数据。");
        return [collection, adminContentItems(data)];
      }));

      setAdminContent(Object.fromEntries(entries));
      return true;
    } catch (error) {
      setContentError(error instanceof Error ? error.message : "无法读取内容管理数据。");
      return false;
    } finally {
      setContentLoading(false);
    }
  }, []);

  const resetAnalytics = useCallback(async () => {
    setAnalyticsResetting(true);
    setOverviewError("");

    try {
      const response = await fetch("/api/admin/analytics/reset", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirm: "RESET_ANALYTICS" }),
      });
      const data = await readAdminApiResponse(response, "无法重置统计数据。");
      if (data?.reset !== true) throw new Error("无法重置统计数据。");

      const refreshed = await loadOverview();
      if (!refreshed) throw new Error("统计数据已重置，但无法刷新摘要。");
      return true;
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "无法重置统计数据。");
      return false;
    } finally {
      setAnalyticsResetting(false);
    }
  }, [loadOverview]);

  const saveAdminOperation = useCallback(async (path, method, payload, fallbackMessage) => {
    const response = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      setAuthState("signed-out");
      setOverview(null);
      throw new Error("登录已过期，请重新登录。");
    }
    const result = await readAdminApiResponse(response, fallbackMessage);
    const refreshed = await loadOverview();
    if (!refreshed) throw new Error("更改已保存，但摘要刷新失败。请刷新数据后查看。");
    return result;
  }, [loadOverview]);

  const createAdminTask = useCallback(({ title }) => saveAdminOperation(
    "/api/admin/tasks", "POST", { title }, "无法添加维护任务。",
  ), [saveAdminOperation]);

  const updateAdminTask = useCallback(({ id, ...changes }) => saveAdminOperation(
    `/api/admin/tasks/${encodeURIComponent(id)}`, "PATCH", changes, "无法保存维护任务。",
  ), [saveAdminOperation]);

  const updateAdminContact = useCallback(({ id, status }) => saveAdminOperation(
    `/api/admin/contacts/${encodeURIComponent(id)}`, "PATCH", { status }, "无法保存联系表单状态。",
  ), [saveAdminOperation]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const data = await readAdminApiResponse(response, "管理员登录服务暂时无法使用。");
        if (!active) return;

        if (data.authenticated) {
          setAuthState("authenticated");
          void loadOverview();
          void loadAdminContent();
        } else {
          setAuthState("signed-out");
        }
      } catch (error) {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : "管理员登录服务暂时无法使用。");
        setAuthState("signed-out");
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [loadAdminContent, loadOverview]);

  const authenticate = useCallback(async ({ email, password }) => {
    setAuthError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    await readAdminApiResponse(response, "无法完成登录，请检查账号和密码后重试。");
    setAuthState("authorizing");
    setAuthorizationBlocking(true);
    setAuthorizationVisible(true);
    void Promise.all([loadOverview(), loadAdminContent()]);
  }, [loadAdminContent, loadOverview]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      await readAdminApiResponse(response, "无法结束登录会话。");
      setAuthState("signed-out");
      setOverview(null);
      setOverviewError("");
      setAdminContent({ music: [], "game-wall": [], works: [] });
      setContentError("");
      uploadedMediaByUrl.current.clear();
      onExitToHome?.();
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "无法结束登录会话。");
    } finally {
      setLoggingOut(false);
    }
  }, [onExitToHome]);

  const createAdminContent = useCallback(async ({ type, item }) => {
    if (!adminContentCollections.includes(type)) throw new Error("无效的内容分类。");

    const response = await fetch(`/api/admin/content/${type}`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(toAdminContentPayload(type, item, null, uploadedMediaByUrl)),
    });
    const data = await readAdminApiResponse(response, "无法建立内容条目。");
    await loadAdminContent();
    return data.item;
  }, [loadAdminContent]);

  const updateAdminContent = useCallback(async ({ type, id, item, previous }) => {
    if (!adminContentCollections.includes(type) || !textValue(id)) throw new Error("无效的内容条目。");

    const response = await fetch(`/api/admin/content/${type}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(toAdminContentPayload(type, item, previous, uploadedMediaByUrl)),
    });
    const data = await readAdminApiResponse(response, "无法保存内容条目。");
    await loadAdminContent();
    return data.item;
  }, [loadAdminContent]);

  const deleteAdminContent = useCallback(async ({ type, id }) => {
    if (!adminContentCollections.includes(type) || !textValue(id)) throw new Error("无效的内容条目。");

    const response = await fetch(`/api/admin/content/${type}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const data = await readAdminApiResponse(response, "无法删除内容条目。");
    await loadAdminContent();
    return data;
  }, [loadAdminContent]);

  const uploadAdminMedia = useCallback(async ({ type, id, field, file, item, onProgress }) => {
    if (!adminContentCollections.includes(type) || !(file instanceof File)) throw new Error("请选择有效的上传文件。");
    if (file.size <= 0) throw new Error("不能上传空文件。");
    if (file.size > maximumMediaUploadBytes) throw new Error("单个媒体文件不能超过 500 MB。");

    const media = file.size > directMediaUploadMaxBytes
      ? await uploadMultipartMedia({ type, id, field, file, item, onProgress })
      : await uploadDirectMedia({ type, id, field, file, item, onProgress });

    reportMediaUploadProgress(onProgress, {
      phase: "uploading",
      loadedBytes: file.size,
      totalBytes: file.size,
    });

    uploadedMediaByUrl.current.set(media.url, media);
    if (media.fileUrl) uploadedMediaByUrl.current.set(media.fileUrl, media);
    const previewUrl = media.fileUrl || media.url;
    return field === "audio" ? { audio: previewUrl } : { cover: previewUrl };
  }, []);

  // The API has already authenticated 'authorizing'. Mount its destination
  // behind the shutters, but keep it inert until the full overlay has exited.
  const controlRoom = authState === "authenticated" || authState === "authorizing"
    ? (
      <AdminDashboard
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        onLogout={logout}
        loggingOut={loggingOut}
        onResetAnalytics={resetAnalytics}
        resettingAnalytics={analyticsResetting}
        onRefresh={loadOverview}
        onCreateTask={createAdminTask}
        onUpdateTask={updateAdminTask}
        onUpdateContact={updateAdminContact}
      />
    )
    : (
      <AdminLogin
        buildStep={adminBuildStep}
        backgroundMotionEnabled={!adminOpeningVisible}
        error={authError}
        isSubmitting={authState === "checking" || authState === "authorizing"}
        onSubmit={authenticate}
      />
    );

  return (
    <>
      <AnimatePresence onExitComplete={() => setAdminOpeningBlocking(false)}>
        {adminOpeningVisible && openingEnabled && <TerminalSequence mode="access" locale={locale} onBuildStep={advanceAdminBuild} onDone={finishAdminOpening} />}
      </AnimatePresence>
      <AnimatePresence onExitComplete={showAuthorizedControlRoom}>
        {authorizationVisible && <TerminalSequence mode="authorized" locale={locale} onDone={finishAuthorization} />}
      </AnimatePresence>
      <div inert={adminOpeningBlocking || authorizationBlocking ? true : undefined}>{controlRoom}</div>
    </>
  );
}

function Header({ copy, locale, setLocale, workActive, gameWallActive, musicActive, soundEnabled, onSoundToggle }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const firstMobileLinkRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const focusTimer = window.setTimeout(() => firstMobileLinkRef.current?.focus(), 30);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const changeLocale = (nextLocale) => {
    setLocale(nextLocale);
    closeMenu();
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  };

  return (
    <header className="site-header">
      <a className="brand" href="/" onClick={closeMenu} aria-label={copy.homeLabel}>
        <img className="brand-mark" src="/portfolio/asset-175.svg" alt="" aria-hidden="true" />
        <span className="brand-wordmark">PHRNONO</span>
        <span>PORTFOLIO</span>
      </a>

      <div className="desktop-header-tools">
        <nav className="desktop-nav" aria-label={copy.navLabel}>
          <a href="/work" aria-current={workActive ? "page" : undefined}><LocalizedDecryptedText text={copy.navWork} replayOnHover /></a>
          <a href="/game-wall" aria-current={gameWallActive ? "page" : undefined}><LocalizedDecryptedText text={copy.navGameWall} replayOnHover /></a>
          <a href="/music" aria-current={musicActive ? "page" : undefined}><LocalizedDecryptedText text={copy.navMusic} replayOnHover /></a>
          <a href="/#about"><LocalizedDecryptedText text={copy.navAbout} replayOnHover /></a>
          <a href={profileUrl} target="_blank" rel="noreferrer">
            ARTSTATION <ArrowUpRight size={15} weight="bold" />
          </a>
        </nav>
        <SoundToggle copy={copy} enabled={soundEnabled} onToggle={onSoundToggle} />
        <LanguageSwitcher copy={copy} locale={locale} onChange={changeLocale} />
      </div>

      <button
        ref={menuButtonRef}
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
        aria-controls="mobile-navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        {menuOpen ? <X size={23} weight="bold" /> : <List size={24} weight="bold" />}
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label={copy.mobileNavLabel}
            initial={reduceMotion ? false : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
          >
            <a ref={firstMobileLinkRef} href="/work" onClick={closeMenu}><LocalizedDecryptedText text={copy.navWork} replayOnHover /></a>
            <a href="/game-wall" onClick={closeMenu}><LocalizedDecryptedText text={copy.navGameWall} replayOnHover /></a>
            <a href="/music" onClick={closeMenu}><LocalizedDecryptedText text={copy.navMusic} replayOnHover /></a>
            <a href="/#about" onClick={closeMenu}><LocalizedDecryptedText text={copy.navAbout} replayOnHover /></a>
            <a href={profileUrl} target="_blank" rel="noreferrer" onClick={closeMenu}>ArtStation</a>
            <div className="mobile-nav-tools">
              <SoundToggle copy={copy} enabled={soundEnabled} onToggle={onSoundToggle} variant="mobile" />
              <LanguageSwitcher copy={copy} locale={locale} onChange={changeLocale} variant="mobile" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero({ copy }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="hero" id="top" data-cia-context="home">
      <ShapeGrid
        className="hero-shape-grid"
        speed={reduceMotion ? 0 : 0.28}
        squareSize={64}
        direction="diagonal"
        borderColor="rgba(17, 19, 16, 0.1)"
        hoverFillColor="rgba(214, 244, 56, 0.78)"
        shape="square"
        hoverTrailAmount={7}
      />
      <div className="hero-copy">
        <p className="hero-kicker"><LocalizedDecryptedText text="3D / PIXEL / VISUAL DESIGN" /></p>
        <h1 aria-label="PHRNONO"><span>PHR</span><span className="hero-title-accent">NONO</span></h1>
        <p className="hero-summary"><LocalizedDecryptedText text={copy.heroSummary} /></p>
        <a className="primary-action" href="/work">
          {copy.viewWork} <ArrowDown size={18} weight="bold" />
        </a>
      </div>

      <motion.div
        className="hero-visual"
        initial={reduceMotion ? false : { opacity: 0, x: 42, clipPath: "inset(0 0 0 100%)" }}
        animate={{ opacity: 1, x: 0, clipPath: "inset(0 0 0 0%)" }}
        transition={{ delay: reduceMotion ? 0 : 0.25, duration: reduceMotion ? 0.01 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <img className="hero-grid" src={tacticalGrid} alt="" />
        <span className="hero-scanline" aria-hidden="true" />
        <div className="hero-visual-copy" aria-hidden="true">
          <span>PORTFOLIO / 2026</span>
          <strong>3D<br />PIXEL<br />VISUAL</strong>
          <small>PHRNONO / DIGITAL PRACTICE</small>
        </div>
        <img
          className="hero-mascot"
          src="/portfolio/asset-175.svg"
          alt={copy.mascotAlt}
          width="620"
          height="568"
        />
        <div className="hero-visual-index" aria-hidden="true">
          <span>PROFILE</span>
          <strong>PHR</strong>
        </div>
      </motion.div>

      <div className="hero-sideword" aria-hidden="true">PHRNONO</div>
      <div className="hero-meta">
        <span>14 PROJECTS</span>
        <span>ARTSTATION 2026</span>
      </div>
    </section>
  );
}

function Work({ copy }) {
  const categoryOptions = ["3D SCENE", "3D PROP", "ILLUSTRATION", "CHARACTER", "INTERACTIVE"];
  const categoryFromHash = () => categoryOptions.find((category) => window.location.hash === `#category-${category.toLowerCase().replaceAll(" ", "-")}`) || "3D SCENE";
  const [activeCategory, setActiveCategory] = useState(categoryFromHash);
  useEffect(() => {
    const updateCategory = () => setActiveCategory(categoryFromHash());
    window.addEventListener("hashchange", updateCategory);
    return () => window.removeEventListener("hashchange", updateCategory);
  }, []);
  const reduceMotion = useReducedMotion();
  const allProjects = usePublishedContent("works", projects, normalizeWorkContent);
  const visibleProjects = allProjects.filter((project) => project.category === activeCategory);
  const categoryItems = categoryOptions.map((category) => ({
    link: `#category-${category.toLowerCase().replaceAll(" ", "-")}`,
    text: copy.categoryLabels[category],
    image: allProjects.find((project) => project.category === category)?.image ?? allProjects[0]?.image ?? "",
    active: activeCategory === category,
  }));
  const galleryItems = visibleProjects.map((project) => ({
    image: project.image,
    label: `${project.title} / ${project.discipline || copy.projectDisciplines[project.id] || project.category}`,
    link: project.localUrl ?? project.artstationUrl ?? profileUrl,
    slug: project.slug || project.id,
    external: !project.localUrl,
    alt: project.alt || copy.projectAlts[project.id] || project.title,
    previewOnly: project.previewOnly,
    watermarkText: project.watermarkText,
  }));

  return (
    <section className="work-section" id="work">
      <div className="section-heading">
        <h1><LocalizedDecryptedText text={"SELECTED\nWORK"} variant="display" /></h1>
        <p><LocalizedDecryptedText text={copy.workDescription} /></p>
      </div>

      <div className="category-flowing-menu" aria-label={copy.filterLabel}>
        <FlowingMenu
          items={categoryItems}
          speed={18}
          textColor="#fbfbf8"
          bgColor="#0c0e0c"
          marqueeBgColor="#d6f438"
          marqueeTextColor="#0c0e0c"
          borderColor="rgba(251, 251, 248, 0.35)"
          reducedMotion={reduceMotion}
          onItemClick={(index) => {
            const category = categoryOptions[index];
            setActiveCategory(category);
            window.history.replaceState(null, "", `#category-${category.toLowerCase().replaceAll(" ", "-")}`);
          }}
          ariaLabel={copy.filterLabel}
        />
      </div>

      <div className="work-gallery-wrap" data-cia-context="work">
        <AccordionGallery
          key={activeCategory}
          items={galleryItems}
          defaultIndex={0}
          accentColor="#d6f438"
          overlayColor="#0c0e0c"
          textColor="#fbfbf8"
          height={560}
          gap={8}
          radius={0}
          expandRatio={0.56}
          trigger="hover"
          grayscale
          tilt={0}
          ariaLabel={copy.galleryLabel}
          onItemClick={(item) => trackAnalyticsEvent("work_click", item.slug)}
        />
      </div>

    </section>
  );
}

function CharacterFeature({ copy }) {
  const project = projects.find((item) => item.id === "pixelAnimation");

  return (
    <section className="character-feature" aria-labelledby="character-feature-title">
      <div className="character-feature-heading">
        <h2 id="character-feature-title"><LocalizedDecryptedText text={copy.characterFeature.title} variant="display" /></h2>
        <p><LocalizedDecryptedText text={copy.characterFeature.intro} /></p>
      </div>

      <div className="character-feature-layout">
        <figure className="character-feature-design">
          <div className="character-feature-subheading">
            <h3><LocalizedDecryptedText text={copy.characterFeature.designTitle} variant="display" /></h3>
            <p><LocalizedDecryptedText text={copy.characterFeature.designIntro} /></p>
          </div>
          <div className="character-design-grid">
            {[
              ["/portfolio/art-01.webp", copy.characterFeature.designImages[0]],
              ["/portfolio/art-02.webp", copy.characterFeature.designImages[1]],
              ["/portfolio/art-03.webp", copy.characterFeature.designImages[2]],
            ].map(([src, alt]) => (
              <img key={src} src={src} alt={alt} loading="lazy" />
            ))}
          </div>
          <figcaption><LocalizedDecryptedText text={copy.characterFeature.designCaption} /></figcaption>
        </figure>

        <div className="character-feature-animation-stack">
          <figure className="character-feature-media">
            <div className="character-feature-subheading">
              <h3><LocalizedDecryptedText text={copy.characterFeature.animationTitle} variant="display" /></h3>
            </div>
            <video
              src={project.video}
              poster={project.image}
              aria-label={copy.characterFeature.mediaAria}
              controls
              muted
              loop
              playsInline
              preload="metadata"
            />
            <figcaption><LocalizedDecryptedText text={copy.characterFeature.mediaCaption} /></figcaption>
          </figure>

          <article className="character-feature-story">
            <h3><LocalizedDecryptedText text={copy.characterFeature.name} variant="display" /></h3>
            <div className="character-story-copy">
              {copy.characterFeature.story.map((paragraph) => <p key={paragraph}><LocalizedDecryptedText text={paragraph} /></p>)}
            </div>
            <dl>
              {copy.characterFeature.facts.map(([label, value]) => (
                <div key={label}>
                  <dt><LocalizedDecryptedText text={label} /></dt>
                  <dd><LocalizedDecryptedText text={value} /></dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}

function Practice({ copy }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="practice-section" id="practice" aria-labelledby="practice-title">
      <div className="practice-title-wrap">
        <h2 id="practice-title"><LocalizedDecryptedText text={"MULTI-DISCIPLINE\nPRACTICE"} variant="display" /></h2>
        <div className="practice-visual" role="img" aria-label={copy.practiceImageAlt}>
          <img src={tacticalGrid} alt="" aria-hidden="true" loading="lazy" width="1672" height="941" />
          <span className="practice-visual-corner" aria-hidden="true">VISUAL SYSTEM / 04</span>
          <motion.span
            className="practice-visual-scan"
            aria-hidden="true"
            initial={false}
            animate={reduceMotion ? { opacity: 0.35 } : { x: ["-120%", "120%"] }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 3.8, ease: "linear", repeat: Infinity, repeatDelay: 1.4 }}
          />
          <motion.span
            className="practice-visual-orbit"
            aria-hidden="true"
            initial={false}
            animate={reduceMotion ? { opacity: 0.55 } : { rotate: [0, 360] }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 18, ease: "linear", repeat: Infinity }}
          />
          <motion.span
            className="practice-visual-pulse"
            aria-hidden="true"
            initial={false}
            animate={reduceMotion ? { opacity: 0.85, scale: 1 } : { opacity: [0.3, 1, 0.3], scale: [0.78, 1.2, 0.78] }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 2.1, ease: "easeInOut", repeat: Infinity }}
          />
          <span className="practice-visual-status" aria-hidden="true">SYNC <b>READY</b></span>
        </div>
      </div>
      <div className="discipline-list">
        {copy.practiceItems.map(([title, description], index) => (
          <motion.div
            className="discipline-row"
            key={title}
            initial={reduceMotion ? false : { opacity: 0, x: 26 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.08, duration: reduceMotion ? 0.01 : 0.35 }}
          >
            <Plus size={18} weight="bold" aria-hidden="true" />
            <h3><LocalizedDecryptedText text={title} variant="display" /></h3>
            <p><LocalizedDecryptedText text={description} /></p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ContactForm({ copy }) {
  const formCopy = copy.contactForm;
  // Turnstile Site Keys are public by design. Keep the environment override so
  // previews can use a different widget, while production always renders the
  // PHRNONO contact-form challenge.
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "0x4AAAAAAEemT2pUxYKZoFxz";
  const widgetRef = useRef(null);
  const widgetIdRef = useRef(null);
  const captchaTokenRef = useRef("");
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!turnstileSiteKey || !widgetRef.current) return undefined;
    let active = true;
    void loadTurnstileScript()
      .then((turnstile) => {
        if (!active || !turnstile || !widgetRef.current) return;
        widgetIdRef.current = turnstile.render(widgetRef.current, {
          sitekey: turnstileSiteKey,
          theme: "light",
          callback: (token) => { captchaTokenRef.current = token; },
          "expired-callback": () => { captchaTokenRef.current = ""; },
          "error-callback": () => { captchaTokenRef.current = ""; },
        });
      })
      .catch(() => {
        if (active) setStatusMessage(formCopy.captchaUnavailable);
      });

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile?.remove) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      captchaTokenRef.current = "";
    };
  }, [formCopy.captchaUnavailable, turnstileSiteKey]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setStatusMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...form, captchaToken: captchaTokenRef.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || formCopy.error);
      setStatus("sent");
      setStatusMessage(formCopy.success);
      setForm({ name: "", email: "", message: "", website: "" });
      captchaTokenRef.current = "";
      if (widgetIdRef.current !== null && window.turnstile?.reset) window.turnstile.reset(widgetIdRef.current);
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : formCopy.error);
    }
  };

  return (
    <form className="contact-form" onSubmit={submit} aria-label={formCopy.label}>
      <div className="contact-form__head">
        <span>{formCopy.eyebrow}</span>
        <p>{formCopy.description}</p>
      </div>
      <div className="contact-form__fields">
        <label>
          <span>{formCopy.name}</span>
          <input name="name" value={form.name} onChange={updateField} autoComplete="name" maxLength={120} placeholder={formCopy.namePlaceholder} />
        </label>
        <label>
          <span>{formCopy.email}</span>
          <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" maxLength={320} required placeholder={formCopy.emailPlaceholder} />
        </label>
      </div>
      <label>
        <span>{formCopy.message}</span>
        <textarea name="message" value={form.message} onChange={updateField} maxLength={5000} minLength={10} required rows={5} placeholder={formCopy.messagePlaceholder} />
      </label>
      <label className="contact-form__honeypot" aria-hidden="true">
        <span>Website</span>
        <input name="website" value={form.website} onChange={updateField} tabIndex={-1} autoComplete="off" />
      </label>
      {turnstileSiteKey ? <div ref={widgetRef} className="contact-form__captcha" aria-label={formCopy.captchaLabel} /> : null}
      <div className="contact-form__actions">
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? formCopy.sending : formCopy.submit}
          <ArrowRight size={17} weight="bold" />
        </button>
        <span role="status" aria-live="polite" className={`contact-form__status contact-form__status--${status}`}>
          {statusMessage}
        </span>
      </div>
    </form>
  );
}

function About({ copy }) {
  const skillGroups = [
    [copy.skillGroups.softwareTitle, copy.skillGroups.software],
    [copy.skillGroups.skillsTitle, copy.skillGroups.skills],
    [copy.skillGroups.pipelineTitle, copy.skillGroups.pipeline],
    [copy.skillGroups.languagesTitle, copy.skillGroups.languages],
  ];

  return (
    <section className="about-section" id="about" data-cia-context="about">
      <div className="about-profile">
        <img src="/portfolio/asset-175.svg" alt={copy.avatarAlt} loading="lazy" width="620" height="568" />
        <div>
            <span>PHRNONO</span>
          <p><LocalizedDecryptedText text="3D modeling / Digital art" /></p>
        </div>
      </div>
      <h2><LocalizedDecryptedText text={"BUILDING WORLDS\nONE FRAME AT A TIME."} variant="display" /></h2>
      <div className="about-bottom">
        <p><LocalizedDecryptedText text={copy.aboutBody} /></p>
        <a className="primary-action" href={profileUrl} target="_blank" rel="noreferrer">
          {copy.openArtstation} <ArrowUpRight size={18} weight="bold" />
        </a>
      </div>

      <section className="cv-snapshot" aria-labelledby="cv-snapshot-title">
        <div className="cv-snapshot-head">
          <div>
            <span className="cv-snapshot-eyebrow"><LocalizedDecryptedText text={copy.cvSnapshot.eyebrow} /></span>
            <h3 id="cv-snapshot-title"><LocalizedDecryptedText text={copy.cvSnapshot.title} variant="display" /></h3>
          </div>
          <p><LocalizedDecryptedText text={copy.cvSnapshot.summary} /></p>
        </div>
        <div className="cv-snapshot-grid">
          <dl className="cv-snapshot-list">
            {copy.cvSnapshot.rows.map(([label, value]) => (
              <div key={label}>
                <dt><LocalizedDecryptedText text={label} /></dt>
                <dd><LocalizedDecryptedText text={value} /></dd>
              </div>
            ))}
          </dl>
          <a className="cv-snapshot-action" href="/files/PHRNONO-CV.pdf" download="PHRNONO-CV.pdf" title={copy.cvTitle} onClick={() => trackAnalyticsEvent("cv_download")}>
            <FilePdf size={20} weight="bold" />
            {copy.cvSnapshot.action}
            <ArrowUpRight size={18} weight="bold" />
          </a>
        </div>
      </section>

      <div className="skills-contact">
        <div className="skill-groups" aria-label={copy.skillsLabel}>
          {skillGroups.map(([group, items]) => (
            <div className="skill-group" key={group}>
              <h3><LocalizedDecryptedText text={group} variant="display" /></h3>
              <div>
                {items.map((item) => <span key={item}><LocalizedDecryptedText text={item} /></span>)}
              </div>
            </div>
          ))}
        </div>

        <div className="contact-panel" id="contact">
          <h3><LocalizedDecryptedText text={copy.contactTitle} variant="display" /></h3>
          <a href={profileUrl} target="_blank" rel="noreferrer">
            <ArrowUpRight size={20} weight="bold" />
            ARTSTATION PROFILE
          </a>
          <a href="mailto:hoykarpoh740@gmail.com">
            <EnvelopeSimple size={20} weight="bold" />
            <span className="contact-email">
              <small>{copy.email}</small>
              <strong>hoykarpoh740@gmail.com</strong>
            </span>
          </a>
          <a href="/files/PHRNONO-CV.pdf" download="PHRNONO-CV.pdf" title={copy.cvTitle} onClick={() => trackAnalyticsEvent("cv_download")}>
            <FilePdf size={20} weight="bold" />
            {copy.cvDownload}
          </a>
          <ContactForm copy={copy} />
        </div>
      </div>
    </section>
  );
}

function ProjectDetail({ copy, project }) {
  const projectCopy = copy.projectDetails[project.id];
  const ui = copy.projectDetailUi;
  const reduceMotion = useReducedMotion();
  const currentIndex = detailProjectOrder.indexOf(project.slug);
  const previousSlug = detailProjectOrder[(currentIndex - 1 + detailProjectOrder.length) % detailProjectOrder.length];
  const nextSlug = detailProjectOrder[(currentIndex + 1) % detailProjectOrder.length];
  const previousProject = detailProjects[previousSlug];
  const nextProject = detailProjects[nextSlug];
  const dwellSentRef = useRef(false);
  const toolItems = [
    [ui.software, projectCopy.software],
    [ui.timeSpent, projectCopy.timeSpent],
    [ui.role, projectCopy.role],
    [ui.year, projectCopy.year],
  ];

  useEffect(() => {
    dwellSentRef.current = false;
    const startedAt = Date.now();
    const sendDwell = () => {
      if (dwellSentRef.current) return;
      dwellSentRef.current = true;
      const seconds = Math.max(1, Math.min(60 * 60, Math.round((Date.now() - startedAt) / 1000)));
      trackAnalyticsEvent("work_dwell", project.slug, seconds);
    };
    window.addEventListener("pagehide", sendDwell, { once: true });
    return () => {
      window.removeEventListener("pagehide", sendDwell);
      sendDwell();
    };
  }, [project.slug]);

  return (
    <article className="project-detail" data-project={project.slug} data-cia-context="work-case-study">
      <header className="detail-hero">
        <div className="detail-hero-copy">
          <a className="detail-back" href="/work" onClick={() => trackAnalyticsEvent("work_click", project.slug)}>
            <ArrowLeft size={18} weight="bold" /> {ui.backToWork}
          </a>
          <p className="detail-code"><LocalizedDecryptedText text={projectCopy.code} /></p>
          <h1><LocalizedDecryptedText text={projectCopy.title} variant="display" /></h1>
          <p className="detail-summary"><LocalizedDecryptedText text={projectCopy.summary} /></p>
          {project.sketchfabUrl && (
            <div className="detail-actions">
              <a className="secondary-action" href={project.sketchfabUrl} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsEvent("work_click", project.slug)}>
                {ui.interactiveModel} <ArrowUpRight size={18} weight="bold" />
              </a>
            </div>
          )}
        </div>

        <motion.figure
          className="detail-hero-media"
          initial={reduceMotion ? false : { opacity: 0, x: 34 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src={project.hero.src}
            alt={projectCopy.imageAlt}
            width={project.hero.width}
            height={project.hero.height}
          />
          <figcaption><LocalizedDecryptedText text={projectCopy.heroCaption} /></figcaption>
        </motion.figure>
      </header>

      <section className="detail-tools" aria-labelledby="detail-tools-title">
        <h2 id="detail-tools-title"><LocalizedDecryptedText text={ui.creativeTools} variant="display" /></h2>
        <dl>
          {toolItems.map(([label, value]) => (
            <div key={label}>
              <dt><LocalizedDecryptedText text={label} /></dt>
              <dd><LocalizedDecryptedText text={value} /></dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="detail-overview" aria-labelledby="detail-overview-title">
        <div>
          <h2 id="detail-overview-title"><LocalizedDecryptedText text={ui.overview} variant="display" /></h2>
          <p><LocalizedDecryptedText text={projectCopy.description} /></p>
        </div>
        <aside>
          <h3><LocalizedDecryptedText text={ui.coreChallenge} variant="display" /></h3>
          <p><LocalizedDecryptedText text={projectCopy.challenge} /></p>
        </aside>
      </section>

      <section className="detail-evidence" aria-labelledby="detail-evidence-title">
        <div className="detail-evidence-heading">
          <h2 id="detail-evidence-title"><LocalizedDecryptedText text={ui.processMaterialsTitle} variant="display" /></h2>
          <p><LocalizedDecryptedText text={ui.processMaterialsNote} /></p>
        </div>
        <dl className="detail-coverage">
          {ui.coverageLabels.map((label, index) => (
            <div key={label}>
              <dt><LocalizedDecryptedText text={label} /></dt>
              <dd><LocalizedDecryptedText text={projectCopy.processCoverage[index]} /></dd>
            </div>
          ))}
        </dl>
      </section>

      {project.images.length > 0 && (
        <section className="detail-published" aria-labelledby="detail-published-title">
          <div className="detail-published-heading">
            <h2 id="detail-published-title"><LocalizedDecryptedText text={ui.publishedAssets} variant="display" /></h2>
            <p><LocalizedDecryptedText text={projectCopy.publishedAssets} /></p>
          </div>
          <div className="detail-view-grid">
            {project.images.map((image, index) => {
              const viewCopy = projectCopy.views[index];
              return (
                <motion.figure
                  key={image.src}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.5, delay: reduceMotion ? 0 : index * 0.08 }}
                >
                  <img src={image.src} alt={viewCopy.alt} width={image.width} height={image.height} loading="lazy" />
                  <figcaption>
                    <h3><LocalizedDecryptedText text={viewCopy.title} variant="display" /></h3>
                    <p><LocalizedDecryptedText text={viewCopy.body} /></p>
                  </figcaption>
                </motion.figure>
              );
            })}
          </div>
        </section>
      )}

      {project.modelPreview && (
        <section className="detail-model" aria-labelledby="detail-model-title">
          <a href={project.sketchfabUrl} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsEvent("work_click", project.slug)}>
            <img
              src={project.modelPreview.src}
              alt={projectCopy.modelAlt}
              width={project.modelPreview.width}
              height={project.modelPreview.height}
              loading="lazy"
            />
          </a>
          <div>
            <h2 id="detail-model-title"><LocalizedDecryptedText text={ui.interactiveModel} variant="display" /></h2>
            <p><LocalizedDecryptedText text={projectCopy.modelDescription} /></p>
            <a href={project.sketchfabUrl} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsEvent("work_click", project.slug)}>
              {ui.openInteractiveModel} <ArrowUpRight size={18} weight="bold" />
            </a>
          </div>
        </section>
      )}

      <nav className="detail-pagination" aria-label={ui.projectNavigation}>
        <a href={`/work/${previousProject.slug}`}>
          <ArrowLeft size={20} weight="bold" />
          <span><small>{ui.previousProject}</small>{previousProject.title}</span>
        </a>
        <a href={`/work/${nextProject.slug}`}>
          <span><small>{ui.nextProject}</small>{nextProject.title}</span>
          <ArrowRight size={20} weight="bold" />
        </a>
      </nav>
    </article>
  );
}

function NotFoundPage({ copy }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="not-found-page">
      <div className="not-found-copy">
        <p><LocalizedDecryptedText text={copy.notFound.eyebrow} /></p>
        <h1><LocalizedDecryptedText text={copy.notFound.title} variant="display" /></h1>
        <span><LocalizedDecryptedText text={copy.notFound.body} /></span>
        <div className="not-found-actions">
          <a className="primary-action" href="/">
            <House size={18} weight="bold" /> {copy.notFound.homeAction}
          </a>
          <a className="secondary-action" href="/work">
            <ImagesSquare size={18} weight="bold" /> {copy.notFound.workAction}
          </a>
        </div>
      </div>

      <div className="not-found-visual">
        <img className="not-found-grid" src={tacticalGrid} alt="" aria-hidden="true" />
        <motion.div
          className="not-found-mascot-wrap"
          animate={reduceMotion ? undefined : { y: [0, -14, 0], rotate: [-1.5, 1.5, -1.5] }}
          transition={reduceMotion ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src="/portfolio/asset-175.svg"
            alt={copy.notFound.characterAlt}
            width="620"
            height="568"
          />
        </motion.div>
        <motion.div
          className="not-found-compass"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { rotate: [0, 18, -12, 0] }}
          transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Compass size={72} weight="thin" />
        </motion.div>
        <strong aria-hidden="true">404</strong>
      </div>
    </section>
  );
}

function VisitorStats({ copy, locale }) {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    void loadVisitorStats()
      .then((nextStats) => {
        if (!mounted) return;
        setStats(nextStats);
        setStatus(nextStats ? "ready" : "error");
      })
      .catch(() => {
        if (!mounted) return;
        setStats(null);
        setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loading = status === "loading";
  const total = stats ? formatVisitorCount(stats.total, locale) : "-";
  const today = stats ? formatVisitorCount(stats.today, locale) : "-";

  return (
    <div className="visitor-stats" aria-label={copy.visitorStats.label} aria-live="polite" aria-busy={loading}>
      <span className="visitor-stats__item">
        <span className="visitor-stats__label">{copy.visitorStats.total}</span>
        {loading
          ? <strong className="visitor-stats__value-skeleton" aria-hidden="true" />
          : <strong>{total}</strong>}
      </span>
      <span className="visitor-stats__item">
        <span className="visitor-stats__label">{copy.visitorStats.today}</span>
        {loading
          ? <strong className="visitor-stats__value-skeleton" aria-hidden="true" />
          : <strong>{today}</strong>}
      </span>
    </div>
  );
}

function Footer({ copy, locale }) {
  return (
    <footer>
      <a href="/">PHRNONO</a>
      <p><LocalizedDecryptedText text={copy.footerDiscipline} /></p>
      <VisitorStats copy={copy} locale={locale} />
      <span className="footer-year">© 2026</span>
    </footer>
  );
}

function SiteRail({ copy, workActive, gameWallActive, musicActive, onNavigate }) {
  const items = [copy.navHome, copy.navWork, copy.navGameWall, copy.navMusic, copy.navAbout, copy.navContact];
  const routes = ["/", "/work", "/game-wall", "/music", "/#about", "/#contact"];
  const initialIndex = musicActive ? 3 : gameWallActive ? 2 : workActive ? 1 : window.location.hash === "#contact" ? 5 : window.location.hash === "#about" ? 4 : 0;
  const colors = gameWallActive || musicActive
    ? { accent: "#d6f438", text: "#f2f1eb", marker: "#a3a89a" }
    : { accent: "#425000", text: "#51544d", marker: "#8d9088" };

  return (
    <div className="site-rail">
      <LineSidebar
        items={items}
        accentColor={colors.accent}
        textColor={colors.text}
        markerColor={colors.marker}
        showIndex
        showMarker
        proximityRadius={100}
        maxShift={18}
        markerLength={44}
        itemGap={16}
        fontSize={1.05}
        smoothing={100}
        defaultActive={initialIndex}
        ariaLabel={copy.navLabel}
        onItemClick={(index) => onNavigate(routes[index])}
      />
    </div>
  );
}

function getPageMeta(copy, route, locale = "zh") {
  if (route.kind === "ciaAI") {
    const projectCopy = ciaAIProjectCopy[locale] || ciaAIProjectCopy.zh;
    return { title: projectCopy.metaTitle, description: projectCopy.metaDescription };
  }
  if (route.kind === "admin") {
    return { title: "PHRNONO | Admin", description: "Private PHRNONO administration." };
  }
  if (route.kind === "detail") {
    const projectCopy = copy.projectDetails[route.project.id];
    return { title: `${projectCopy.title} | PHRNONO`, description: projectCopy.summary };
  }
  if (route.kind === "notFound") {
    return { title: `404 | PHRNONO`, description: copy.notFound.body };
  }
  if (route.kind === "work") {
    return { title: `PHRNONO | ${copy.navWork}`, description: copy.workDescription };
  }
  if (route.kind === "gameWall") {
    return { title: `PHRNONO | ${copy.navGameWall}`, description: copy.gameWall.intro };
  }
  if (route.kind === "music") {
    return { title: `PHRNONO | ${copy.navMusic}`, description: copy.music.intro };
  }
  if (route.kind === "character") {
    return { title: `${copy.characterFeature.title} | PHRNONO`, description: copy.characterFeature.intro };
  }
  return { title: copy.metaTitle, description: copy.metaDescription };
}

export function App() {
  const [locale, setLocale] = useState(getInitialLocale);
  const [introVisible, setIntroVisible] = useState(getInitialIntroVisible);
  const [introBlocking, setIntroBlocking] = useState(getInitialIntroVisible);
  const [characterEntryBlocking, setCharacterEntryBlocking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundEnabled);
  const [soundAnnouncement, setSoundAnnouncement] = useState("");
  const [routeTransitionPhase, setRouteTransitionPhase] = useState(getInitialRouteTransitionPhase);
  const [routeTransitionBlocking, setRouteTransitionBlocking] = useState(() => routeTransitionPhase !== "idle");
  const [transitionDestination, setTransitionDestination] = useState(() => typeof window === "undefined" ? "/" : window.location.href);
  const pendingNavigationRef = useRef("");
  const reduceMotion = useReducedMotion();
  const copy = translations[locale];
  const route = getRoute();
  const workActive = route.kind === "work" || route.kind === "detail" || route.kind === "character" || route.kind === "ciaAI";
  const gameWallActive = route.kind === "gameWall";
  const musicActive = route.kind === "music";
  const scrollToSectionHash = useCallback((hash) => {
    const targetId = getHashTargetId(hash);
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return false;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    if (target.id === "main-content") target.focus({ preventScroll: true });
    return true;
  }, [reduceMotion]);

  useEffect(() => {
    const localeOption = localeOptions.find((option) => option.code === locale);
    const meta = getPageMeta(copy, route, locale);
    document.documentElement.lang = localeOption?.documentLang ?? "zh-CN";
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", meta.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", meta.description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", meta.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", meta.description);
    const canonicalUrl = `https://phrnono.com${route.path}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
    document.querySelector('meta[name="robots"]')?.setAttribute(
      "content",
      route.kind === "notFound" || route.kind === "admin" ? "noindex, nofollow" : "index, follow",
    );
    window.localStorage.setItem("phrolova-locale", locale);
  }, [copy, locale, route.kind, route.path]);

  useEffect(() => {
    window.localStorage.setItem("phrolova-sound-enabled", String(soundEnabled));
    if (!soundEnabled) return undefined;

    const handleInteractiveClick = (event) => {
      if (!(event.target instanceof Element)) return;
      const interactive = event.target.closest("a, button, [role='tab']");
      if (!interactive || interactive.closest(".sound-toggle") || interactive.hasAttribute("disabled")) return;
      const isSwitch = interactive.matches("[role='tab']") || Boolean(interactive.closest(".language-switcher"));
      playSiteSound(isSwitch ? "switch" : "click");
    };

    document.addEventListener("click", handleInteractiveClick);
    return () => document.removeEventListener("click", handleInteractiveClick);
  }, [soundEnabled]);

  useEffect(() => {
    if (routeTransitionPhase !== "arriving") return undefined;
    try {
      window.sessionStorage.removeItem(routeTransitionStorageKey);
    } catch {
      // The visual transition can complete without session storage.
    }
    const timer = window.setTimeout(() => setRouteTransitionPhase("idle"), reduceMotion ? 10 : 180);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, routeTransitionPhase]);

  useEffect(() => {
    const restorePage = (event) => {
      if (!event.persisted) return;
      pendingNavigationRef.current = "";
      try { window.sessionStorage.removeItem(routeTransitionStorageKey); } catch { /* Storage is optional. */ }
      setRouteTransitionPhase("idle");
      // An outgoing cover is dismissed through its normal exit callback.
      if (routeTransitionPhase === "idle") setRouteTransitionBlocking(false);
    };
    window.addEventListener("pageshow", restorePage);
    return () => window.removeEventListener("pageshow", restorePage);
  }, [routeTransitionPhase]);

  useEffect(() => {
    if (route.kind !== "home" || introVisible) return undefined;

    const scrollToCurrentHash = () => {
      if (window.location.hash) scrollToSectionHash(window.location.hash);
    };
    const frame = window.requestAnimationFrame(scrollToCurrentHash);
    window.addEventListener("hashchange", scrollToCurrentHash);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scrollToCurrentHash);
    };
  }, [introVisible, route.kind, scrollToSectionHash]);

  const requestNavigation = useCallback((href) => {
    if (pendingNavigationRef.current) return;
    const destination = new URL(href, window.location.href);
    const current = new URL(window.location.href);
    const sameDocument = destination.pathname === current.pathname && destination.search === current.search;

    if (destination.href === current.href) return;
    if (sameDocument && destination.hash && scrollToSectionHash(destination.hash)) {
      window.history.pushState({}, "", `${destination.pathname}${destination.search}${destination.hash}`);
      return;
    }
    if (reduceMotion || (sameDocument && destination.hash)) {
      window.location.assign(destination.href);
      return;
    }

    pendingNavigationRef.current = destination.href;
    setTransitionDestination(destination.href);
    setRouteTransitionBlocking(true);
    setRouteTransitionPhase("leaving");
  }, [reduceMotion, scrollToSectionHash]);

  useEffect(() => {
    const handleInternalNavigation = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        introVisible ||
        routeTransitionPhase !== "idle"
      ) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.getAttribute("target") && anchor.getAttribute("target") !== "_self")
      ) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || !["http:", "https:"].includes(destination.protocol)) return;

      event.preventDefault();
      requestNavigation(destination.href);
    };

    document.addEventListener("click", handleInternalNavigation);
    return () => document.removeEventListener("click", handleInternalNavigation);
  }, [introVisible, requestNavigation, routeTransitionPhase]);

  const finishIntro = useCallback(() => {
    writeSessionStorage(introSessionStorageKey, "true");
    setIntroVisible(false);
  }, []);

  const toggleSound = () => {
    const nextEnabled = !soundEnabled;
    playSiteSound(nextEnabled ? "on" : "off");
    setSoundEnabled(nextEnabled);
    setSoundAnnouncement(nextEnabled ? copy.sound.enabledAnnouncement : copy.sound.disabledAnnouncement);
  };

  const completeRouteTransition = useCallback(() => {
    const destination = pendingNavigationRef.current;
    if (!destination) return;
    pendingNavigationRef.current = "";
    try {
      const url = new URL(destination);
      window.sessionStorage.setItem(routeTransitionStorageKey, JSON.stringify({
        at: Date.now(), pathname: url.pathname, search: url.search,
      }));
    } catch {
      // Navigation still proceeds when session storage is unavailable.
    }
    window.location.assign(destination);
  }, []);

  let pageContent;
  let mainClassName;
  if (route.kind === "admin") {
    mainClassName = "admin-page-shell";
    pageContent = <AdminControlRoom locale={locale} openingEnabled={!routeTransitionBlocking} onExitToHome={() => requestNavigation("/")} />;
  } else if (route.kind === "work") {
    mainClassName = "work-page";
    pageContent = <Work copy={copy} />;
  } else if (route.kind === "ciaAI") {
    mainClassName = "cia-project-page";
    pageContent = <Suspense fallback={<div className="character-page-loading" role="status">Cia AI<span aria-hidden="true" /></div>}><CiaAIProject locale={locale} openingEnabled={!introBlocking && !routeTransitionBlocking} /></Suspense>;
  } else if (route.kind === "gameWall") {
    mainClassName = "game-wall-page-shell";
    pageContent = <GamePhotoWall copy={copy} />;
  } else if (route.kind === "music") {
    mainClassName = "music-page-shell";
    pageContent = <MusicPage copy={copy} />;
  } else if (route.kind === "character") {
    mainClassName = "character-page";
    pageContent = <Suspense fallback={<div className="character-page-loading" role="status">{copy.characterFeature.title}<span aria-hidden="true" /></div>}><CharacterArchive copy={copy} locale={locale} openingEnabled={!introBlocking && !routeTransitionBlocking} onEntryBlockingChange={setCharacterEntryBlocking} /></Suspense>;
  } else if (route.kind === "detail") {
    mainClassName = "detail-page-shell";
    pageContent = <ProjectDetail copy={copy} project={route.project} />;
  } else if (route.kind === "notFound") {
    mainClassName = "not-found-shell";
    pageContent = <NotFoundPage copy={copy} />;
  } else {
    mainClassName = "home-page";
    pageContent = (
      <>
        <Hero copy={copy} />
        <Practice copy={copy} />
        <About copy={copy} />
      </>
    );
  }

  return (
    <>
      <AnimatePresence onExitComplete={() => setIntroBlocking(false)}>
        {introVisible && !routeTransitionBlocking && <TerminalSequence locale={locale} onDone={finishIntro} />}
      </AnimatePresence>
      <RouteTransition
        phase={routeTransitionPhase}
        destination={transitionDestination}
        locale={locale}
        onCovered={completeRouteTransition}
        onExitComplete={() => setRouteTransitionBlocking(false)}
      />
      {route.kind === "admin" ? (
        <div className="admin-page-shell" inert={introBlocking || routeTransitionBlocking ? true : undefined}>
          {pageContent}
        </div>
      ) : (
        <div className={`site-shell${gameWallActive ? " site-shell-game-wall" : musicActive ? " site-shell-music" : route.kind === "character" ? " site-shell-character" : ""}`} inert={introBlocking || routeTransitionBlocking || characterEntryBlocking ? true : undefined}>
          <a className="skip-link" href="#main-content">{copy.skipToContent}</a>
          <Header
            copy={copy}
            locale={locale}
            setLocale={setLocale}
            workActive={workActive}
            gameWallActive={gameWallActive}
            musicActive={musicActive}
            soundEnabled={soundEnabled}
            onSoundToggle={toggleSound}
          />
          {route.kind !== "character" && route.kind !== "ciaAI" && <SiteRail copy={copy} workActive={workActive} gameWallActive={gameWallActive} musicActive={musicActive} onNavigate={requestNavigation} />}
          <CiaArchiveAssistant
            copy={copy.ciaGuide}
            locale={locale}
            pageKind={route.kind}
            blocked={introBlocking || routeTransitionBlocking || characterEntryBlocking}
            onNavigate={requestNavigation}
          />
          <main id="main-content" className={mainClassName} tabIndex="-1">{pageContent}</main>
          <Footer copy={copy} locale={locale} />
        </div>
      )}
      <span className="sr-only" aria-live="polite">{soundAnnouncement}</span>
    </>
  );
}
