import { useEffect, useMemo, useState } from "react";

const collectionCache = new Map();

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicItem(value) {
  if (!isRecord(value) || !text(value.id)) return null;
  return value;
}

function sortRemoteItems(items) {
  return [...items].sort((left, right) => {
    const orderDifference = number(left.sortOrder) - number(right.sortOrder);
    if (orderDifference) return orderDifference;
    return text(right.publishedAt).localeCompare(text(left.publishedAt));
  });
}

export function mergePublishedContent(seed, remote) {
  const byId = new Map(seed.map((item) => [item.id, item]));
  const additions = [];

  for (const item of sortRemoteItems(remote)) {
    if (byId.has(item.id)) {
      byId.set(item.id, { ...byId.get(item.id), ...item });
    } else {
      byId.set(item.id, item);
      additions.push(item.id);
    }
  }

  return [
    ...seed.map((item) => byId.get(item.id)),
    ...additions.map((id) => byId.get(id)),
  ];
}

async function fetchPublishedCollection(collection, signal) {
  const response = await fetch(`/api/content/${encodeURIComponent(collection)}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Published content is unavailable.");

  const body = await response.json();
  if (!Array.isArray(body?.items)) throw new Error("Published content is invalid.");

  return body.items.map(publicItem).filter(Boolean);
}

/**
 * Keeps the built-in portfolio content available immediately and augments it
 * with published CMS entries once the lightweight public endpoint responds.
 */
export function usePublishedContent(collection, seed, normalize = (item) => item) {
  const [remote, setRemote] = useState(() => collectionCache.get(collection) ?? []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    fetchPublishedCollection(collection, controller.signal)
      .then((items) => {
        collectionCache.set(collection, items);
        if (current) setRemote(items);
      })
      .catch(() => {
        // The public pages intentionally keep their built-in content if the
        // CMS is offline, unconfigured, or temporarily unreachable.
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [collection]);

  return useMemo(
    () => mergePublishedContent(seed, remote.map(normalize).filter((item) => item?.id)),
    [normalize, remote, seed],
  );
}

export function normalizeMusicContent(item) {
  return {
    id: text(item.id),
    title: text(item.title, "Untitled track"),
    artist: text(item.artist, "Unknown artist"),
    release: text(item.release),
    genre: text(item.genre),
    duration: text(item.duration, "0:00"),
    audioSrc: text(item.audioUrl || item.audioSrc),
    artwork: text(item.artworkUrl || item.artwork),
    lyrics: text(item.lyrics),
    sortOrder: number(item.sortOrder),
    publishedAt: text(item.publishedAt),
  };
}

export function normalizeGameWallContent(item) {
  return {
    id: text(item.id),
    title: text(item.title),
    group: text(item.group, "collection"),
    number: number(item.number),
    shape: text(item.shape, "standard"),
    letterboxed: Boolean(item.letterboxed),
    thumb: text(item.thumbnailUrl || item.thumbUrl || item.imageUrl),
    full: text(item.imageUrl || item.fullUrl || item.thumbnailUrl),
    previewOnly: Boolean(item.previewOnly),
    watermarkText: text(item.watermarkText, "PHRNONO / PREVIEW ONLY"),
    sortOrder: number(item.sortOrder),
    publishedAt: text(item.publishedAt),
  };
}

export function normalizeWorkContent(item) {
  return {
    id: text(item.id),
    title: text(item.title, "Untitled work"),
    category: text(item.category, "ILLUSTRATION"),
    year: text(item.year),
    image: text(item.imageUrl || item.image),
    discipline: text(item.discipline),
    alt: text(item.alt),
    artstationUrl: text(item.externalUrl || item.artstationUrl),
    previewOnly: Boolean(item.previewOnly),
    watermarkText: text(item.watermarkText, "PHRNONO / PREVIEW ONLY"),
    sortOrder: number(item.sortOrder),
    publishedAt: text(item.publishedAt),
  };
}
