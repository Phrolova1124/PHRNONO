import { useEffect, useId, useMemo, useState } from "react";
import { gameWallImages } from "../gameWallData";
import "./AdminContentManager.css";

const CONTENT_TYPES = [
  {
    id: "music",
    label: "音乐",
    englishLabel: "MUSIC",
    itemLabel: "歌曲",
    newLabel: "新建歌曲",
    helper: "填写音频、封面与歌曲资料，媒体文件由站长代为加入。",
  },
  {
    id: "game-wall",
    label: "游戏墙",
    englishLabel: "GAME WALL",
    itemLabel: "图片",
    newLabel: "新建图片",
    helper: "整理游戏截图、同人作品与收藏图像。",
  },
  {
    id: "works",
    label: "作品",
    englishLabel: "WORKS",
    itemLabel: "作品",
    newLabel: "新建作品",
    helper: "维护公开作品、封面和项目资料。",
  },
];

const STATUS_LABELS = {
  draft: "草稿",
  published: "已发布",
};

const GAME_WALL_GROUPS = [
  { value: "collection", label: "收藏 / COLLECTION" },
  { value: "shoreline", label: "海岸 / SHORELINE" },
  { value: "scarlet", label: "猩红 / SCARLET" },
  { value: "garden", label: "花园 / GARDEN" },
  { value: "starlight", label: "星光 / STARLIGHT" },
  { value: "sunlit", label: "晴光 / SUNLIT" },
];

const AUTO_GAME_WALL_TITLE_PATTERN = /^[A-Z][A-Z -]*\s*\/\s*\d{1,3}$/iu;

function gameWallAutoTitle(group, number) {
  const definition = GAME_WALL_GROUPS.find((entry) => entry.value === group);
  const englishLabel = definition?.label.split("/").at(-1)?.trim() || String(group || "GAME WALL").toUpperCase();
  return `${englishLabel.toUpperCase()} / ${String(number).padStart(2, "0")}`;
}

function nextGameWallNumber(items, group) {
  const numbers = [...gameWallImages, ...(Array.isArray(items) ? items : [])]
    .filter((item) => item?.group === group)
    .map((item) => Number(item?.number))
    .filter((number) => Number.isSafeInteger(number) && number >= 0);
  const next = Math.max(0, ...numbers) + 1;
  return String(next).padStart(2, "0");
}

const WORK_CATEGORIES = [
  { value: "3D SCENE", label: "3D 场景 / 3D SCENE" },
  { value: "3D PROP", label: "3D 道具 / 3D PROP" },
  { value: "ILLUSTRATION", label: "插画 / ILLUSTRATION" },
  { value: "CHARACTER", label: "角色 / CHARACTER" },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCollections(content) {
  const source = content && typeof content === "object" && !Array.isArray(content) ? content : {};

  return {
    music: asArray(source.music ?? source.tracks),
    "game-wall": asArray(source["game-wall"] ?? source.gameWall ?? source.gameWallItems ?? source.games ?? source.images),
    works: asArray(source.works ?? source.projects ?? source.portfolio),
  };
}

function itemKey(item, index) {
  const candidate = item?.id ?? item?.slug ?? item?.key ?? item?.uuid;
  return candidate === undefined || candidate === null || candidate === "" ? `item-${index}` : String(candidate);
}

function itemTitle(item, fallback) {
  if (item?.title || item?.name || item?.label) return item.title || item.name || item.label;
  if (item?.group && item?.number !== undefined && item?.number !== null) return `${item.group} / ${String(item.number).padStart(2, "0")}`;
  return fallback;
}

function itemAsset(item) {
  const candidate = item?.cover ?? item?.artwork ?? item?.image ?? item?.thumbnail ?? item?.thumb ?? item?.full ?? item?.src;
  return typeof candidate === "string" && candidate.trim() ? candidate : "";
}

function itemStatus(item) {
  if (item?.status === "published" || item?.published === true) return "published";
  return "draft";
}

function itemMeta(item, type) {
  if (type === "music") return item?.artist || item?.release || item?.category || "未填写歌手与分类";
  if (type === "game-wall") return item?.group || item?.collection || item?.game || item?.category || "未分类图像";
  return item?.discipline || item?.role || item?.category || item?.year || "未填写作品资料";
}

function emptyForm(type) {
  return {
    title: "",
    description: "",
    category: "",
    status: "draft",
    artist: "",
    release: "",
    duration: "",
    lyrics: "",
    group: "",
    number: "",
    shape: "standard",
    letterboxed: false,
    collection: "",
    discipline: "",
    year: "",
    alt: "",
    externalUrl: "",
    cover: "",
    audio: "",
    type,
  };
}

function formFromItem(item, type) {
  if (!item || typeof item !== "object") return emptyForm(type);

  return {
    title: item.title ?? item.name ?? item.label ?? "",
    description: item.description ?? item.summary ?? item.intro ?? "",
    category: item.category ?? item.group ?? item.genre ?? "",
    status: itemStatus(item),
    artist: item.artist ?? item.creator ?? "",
    release: item.release ?? item.album ?? "",
    duration: item.duration === undefined || item.duration === null ? "" : String(item.duration),
    lyrics: item.lyrics ?? "",
    group: item.group ?? item.collection ?? "",
    number: item.number === undefined || item.number === null ? "" : String(item.number),
    shape: ["feature", "wide", "standard", "tall"].includes(item.shape) ? item.shape : "standard",
    letterboxed: item.letterboxed === true || item.letterboxed === "true" || item.letterboxed === 1,
    collection: item.collection ?? item.game ?? item.source ?? "",
    discipline: item.discipline ?? item.role ?? "",
    year: item.year === undefined || item.year === null ? "" : String(item.year),
    alt: item.alt ?? item.altText ?? "",
    externalUrl: item.externalUrl ?? item.url ?? item.link ?? item.href ?? "",
    cover: item.cover ?? item.artwork ?? item.image ?? item.thumbnail ?? item.thumb ?? item.full ?? "",
    audio: item.audio ?? item.audioSrc ?? item.media ?? "",
    type,
  };
}

function readableError(error, fallback) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function responseAsset(result, field) {
  if (!result || typeof result !== "object") return typeof result === "string" ? result : "";

  const nested = result.item ?? result.data ?? result.asset ?? result;
  const candidates = field === "audio"
    ? [nested.audio, nested.audioSrc, nested.fileUrl, nested.url, nested.src]
    : [nested.cover, nested.artwork, nested.image, nested.thumb, nested.full, nested.fileUrl, nested.url, nested.src];

  return candidates.find((value) => typeof value === "string" && value.trim()) ?? "";
}

function detailFields(type) {
  if (type === "music") {
    return [
      { name: "artist", label: "歌手 / ARTIST", placeholder: "演出者或作曲者" },
      { name: "release", label: "专辑 / RELEASE", placeholder: "专辑、发行版本或年份" },
      { name: "duration", label: "时长 / DURATION", placeholder: "例如：3:42" },
    ];
  }

  if (type === "game-wall") {
    return [
      { name: "number", label: "编号 / NUMBER", placeholder: "例如：023" },
    ];
  }

  return [
    { name: "year", label: "年份 / YEAR", placeholder: "2026" },
    { name: "discipline", label: "方向 / DISCIPLINE", placeholder: "例如：3D 建模、像素艺术" },
    { name: "alt", label: "替代文字 / ALT", placeholder: "用于图片无障碍描述" },
    { name: "externalUrl", label: "项目链接 / EXTERNAL URL", placeholder: "https://" },
  ];
}

/**
 * Reusable, API-agnostic owner content manager.
 *
 * `content` may use `{ music, "game-wall", works }`; `gameWall`, `tracks`, `games`, `images`,
 * `projects`, and `portfolio` are accepted aliases for easier integration.
 * Callbacks receive a plain request object:
 * - onCreate({ type, item })
 * - onUpdate({ type, id, item, previous })
 * - onDelete({ type, id, item })
 * - onUpload({ type, id, field, file, item, onProgress })
 *
 * They may return a promise. An upload may optionally return a string URL or an
 * object containing `url`, `image`, `cover`, `artwork`, `audio`, or `audioSrc`.
 */
export default function AdminContentManager({
  content = {},
  loading = false,
  error = "",
  onCreate,
  onUpdate,
  onDelete,
  onUpload,
}) {
  const tabListId = useId();
  const titleId = useId();
  const [activeType, setActiveType] = useState("music");
  const [selection, setSelection] = useState({ type: "music", id: null, isNew: false });
  const [hasExplicitNewDraft, setHasExplicitNewDraft] = useState(false);
  const [form, setForm] = useState(() => emptyForm("music"));
  const [action, setAction] = useState({ state: "idle", message: "" });
  const [uploads, setUploads] = useState({});
  const [deleteArmed, setDeleteArmed] = useState(false);

  const collections = useMemo(() => normalizeCollections(content), [content]);
  const activeDefinition = CONTENT_TYPES.find((type) => type.id === activeType) ?? CONTENT_TYPES[0];
  const activeItems = collections[activeType] ?? [];
  const selectedIndex = selection.type === activeType
    ? activeItems.findIndex((item, index) => itemKey(item, index) === selection.id)
    : -1;
  const selectedItem = selectedIndex >= 0 ? activeItems[selectedIndex] : null;
  const isNew = selection.type !== activeType || selection.isNew || !selectedItem;
  const remoteError = readableError(error, "");
  const pending = action.state === "pending";
  const uploading = Object.values(uploads).some((upload) => upload?.state === "pending");
  const busy = pending || uploading;

  useEffect(() => {
    const hasSelectedItem = selection.type === activeType
      && !selection.isNew
      && activeItems.some((item, index) => itemKey(item, index) === selection.id);

    if (hasSelectedItem || (selection.type === activeType && selection.isNew && (hasExplicitNewDraft || activeItems.length === 0))) return;

    const firstItem = activeItems[0];
    if (firstItem) {
      setHasExplicitNewDraft(false);
      setSelection({ type: activeType, id: itemKey(firstItem, 0), isNew: false });
      return;
    }

    setHasExplicitNewDraft(false);
    setSelection({ type: activeType, id: null, isNew: true });
  }, [activeItems, activeType, hasExplicitNewDraft, selection]);

  useEffect(() => {
    if (selection.type !== activeType) return;

    setForm(isNew ? emptyForm(activeType) : formFromItem(selectedItem, activeType));
    setUploads({});
    setAction({ state: "idle", message: "" });
    setDeleteArmed(false);
  }, [activeType, isNew, selectedItem, selection.type]);

  function chooseType(type) {
    if (type === activeType) return;

    const items = collections[type] ?? [];
    const firstItem = items[0];
    setActiveType(type);
    setHasExplicitNewDraft(false);
    setSelection(firstItem
      ? { type, id: itemKey(firstItem, 0), isNew: false }
      : { type, id: null, isNew: true });
  }

  function handleTabKeyDown(event, index) {
    let nextIndex = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % CONTENT_TYPES.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + CONTENT_TYPES.length) % CONTENT_TYPES.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = CONTENT_TYPES.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextType = CONTENT_TYPES[nextIndex];
    chooseType(nextType.id);

    window.requestAnimationFrame(() => {
      document.getElementById(`${tabListId}-tab-${nextType.id}`)?.focus();
    });
  }

  function chooseItem(item, index) {
    setHasExplicitNewDraft(false);
    setSelection({ type: activeType, id: itemKey(item, index), isNew: false });
  }

  function createNew() {
    setHasExplicitNewDraft(true);
    setSelection({ type: activeType, id: null, isNew: true });
    setForm(emptyForm(activeType));
    setUploads({});
    setAction({ state: "idle", message: "" });
    setDeleteArmed(false);
  }

  function changeField(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: type === "checkbox" ? checked : value };

      if (activeType === "game-wall" && isNew && name === "group" && value) {
        const generatedTitle = !current.title.trim() || AUTO_GAME_WALL_TITLE_PATTERN.test(current.title.trim());
        const number = generatedTitle ? nextGameWallNumber(activeItems, value) : (current.number.trim() || nextGameWallNumber(activeItems, value));
        if (!current.number.trim() || generatedTitle) next.number = number;
        if (generatedTitle) next.title = gameWallAutoTitle(value, number);
      }

      if (activeType === "game-wall" && isNew && name === "number" && current.group && (!current.title.trim() || AUTO_GAME_WALL_TITLE_PATTERN.test(current.title.trim()))) {
        next.title = value.trim() ? gameWallAutoTitle(current.group, value.trim()) : "";
      }

      return next;
    });
  }

  async function saveItem(event) {
    event.preventDefault();

    const hasGameWallIdentity = Boolean(form.title.trim() || (form.group.trim() && form.number.trim()));
    if ((activeType === "game-wall" && !hasGameWallIdentity) || (activeType !== "game-wall" && !form.title.trim())) {
      setAction({ state: "error", message: activeType === "game-wall" ? "请填写标题，或同时填写群组与编号。" : "请先填写标题，再保存内容。" });
      return;
    }

    const payload = { ...form, title: form.title.trim(), type: activeType };
    const handler = isNew ? onCreate : onUpdate;

    if (typeof handler !== "function") {
      setAction({ state: "error", message: isNew ? "新建功能尚未连接。" : "更新功能尚未连接。" });
      return;
    }

    setAction({ state: "pending", message: isNew ? "正在建立内容条目…" : "正在保存修改…" });

    try {
      let result;
      if (isNew) {
        result = await handler({ type: activeType, item: payload });
        if (result?.id) {
          setHasExplicitNewDraft(false);
          setSelection({ type: activeType, id: String(result.id), isNew: false });
        }
      } else {
        result = await handler({
          type: activeType,
          id: itemKey(selectedItem, selectedIndex),
          item: payload,
          previous: selectedItem,
        });
      }

      setAction({
        state: "success",
        message: isNew ? "已提交新条目；同步后会出现在左侧清单。" : "修改已提交；正在等待内容同步。",
      });
    } catch (saveError) {
      setAction({ state: "error", message: readableError(saveError, "无法保存内容，请稍后重试。") });
    }
  }

  async function uploadFile(event, field) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (isNew) {
      setUploads((current) => ({
        ...current,
        [field]: { state: "error", message: "请先保存草稿，再上传媒体文件。", fileName: file.name },
      }));
      return;
    }

    if (typeof onUpload !== "function") {
      setUploads((current) => ({
        ...current,
        [field]: { state: "error", message: "上传功能尚未连接。", fileName: file.name },
      }));
      return;
    }

    const uploadToken = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const reportProgress = ({ loadedBytes, totalBytes, phase, partNumber, partCount } = {}) => {
      setUploads((current) => {
        if (current[field]?.token !== uploadToken) return current;

        const total = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : file.size;
        const loaded = Number.isFinite(loadedBytes) ? Math.min(Math.max(loadedBytes, 0), total) : null;
        const progress = loaded === null || !total ? null : Math.round((loaded / total) * 100);
        let message = "正在上传文件…";
        if (phase === "preparing") message = "正在建立分段上传…";
        if (phase === "uploading" && partNumber && partCount) message = `正在上传第 ${partNumber} / ${partCount} 段…`;
        if (phase === "finalizing") message = "文件已传输，正在完成发布…";

        return {
          ...current,
          [field]: {
            ...current[field],
            state: "pending",
            message,
            loadedBytes: loaded,
            totalBytes: total,
            progress,
          },
        };
      });
    };

    setUploads((current) => ({
      ...current,
      [field]: {
        state: "pending",
        message: "正在准备上传…",
        fileName: file.name,
        totalBytes: file.size,
        progress: 0,
        token: uploadToken,
      },
    }));

    try {
      const result = await onUpload({
        type: activeType,
        id: isNew ? null : itemKey(selectedItem, selectedIndex),
        field,
        file,
        item: { ...form, type: activeType },
        onProgress: reportProgress,
      });
      const asset = responseAsset(result, field);

      if (asset) setForm((current) => ({ ...current, [field === "audio" ? "audio" : "cover"]: asset }));

      setUploads((current) => ({
        ...current,
        [field]: {
          state: "success",
            message: asset ? "文件已上传并写入当前条目。" : "上传已提交；保存后会同步媒体地址。",
            fileName: file.name,
            totalBytes: file.size,
            loadedBytes: file.size,
            progress: 100,
          },
      }));
    } catch (uploadError) {
      setUploads((current) => ({
        ...current,
        [field]: {
          state: "error",
          message: readableError(uploadError, "文件上传失败，请选择文件后重试。"),
          fileName: file.name,
          totalBytes: file.size,
        },
      }));
    }
  }

  async function deleteItem() {
    if (isNew) {
      createNew();
      return;
    }

    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }

    if (typeof onDelete !== "function") {
      setAction({ state: "error", message: "删除功能尚未连接。" });
      return;
    }

    setAction({ state: "pending", message: "正在删除条目…" });

    try {
      await onDelete({
        type: activeType,
        id: itemKey(selectedItem, selectedIndex),
        item: selectedItem,
      });
      setAction({ state: "success", message: "删除已提交；同步后条目会从清单移除。" });
      setDeleteArmed(false);
    } catch (deleteError) {
      setAction({ state: "error", message: readableError(deleteError, "无法删除条目，请稍后重试。") });
      setDeleteArmed(false);
    }
  }

  const coverUpload = uploads.cover;
  const audioUpload = uploads.audio;
  const shownCover = form.cover || itemAsset(selectedItem);
  const panelId = `${tabListId}-panel`;

  return (
    <section className="admin-content-manager" aria-labelledby={titleId} aria-busy={loading || busy}>
      <div className="admin-content-manager__topline" aria-hidden="true" />

      <header className="admin-content-manager__header">
        <div>
          <p className="admin-content-manager__eyebrow">CONTENT CONTROL / OWNER ONLY</p>
          <h2 id={titleId}>内容管理</h2>
          <p className="admin-content-manager__intro">管理公开的音乐、游戏墙和作品。媒体文件由站长代为加入；先保存草稿，再发送文件即可。</p>
        </div>
        <div className="admin-content-manager__header-readout" aria-label="当前内容分类">
          <span>CHANNEL</span>
          <strong>{activeDefinition.englishLabel}</strong>
        </div>
      </header>

      <div className="admin-content-manager__tabs" role="tablist" aria-label="内容分类" id={tabListId}>
        {CONTENT_TYPES.map((type, index) => {
          const active = type.id === activeType;
          const tabId = `${tabListId}-tab-${type.id}`;
          return (
            <button
              key={type.id}
              id={tabId}
              className="admin-content-manager__tab"
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => chooseType(type.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{type.label}</strong>
              <small>{type.englishLabel}</small>
            </button>
          );
        })}
      </div>

      {remoteError ? <p className="admin-content-manager__notice admin-content-manager__notice--error" role="alert">{remoteError}</p> : null}

      <div className="admin-content-manager__workspace" id={panelId} role="tabpanel" aria-labelledby={`${tabListId}-tab-${activeType}`}>
        <aside className="admin-content-manager__archive" aria-label={`${activeDefinition.label}条目清单`}>
          <div className="admin-content-manager__archive-header">
            <div>
              <p>{activeDefinition.englishLabel} ARCHIVE</p>
              <h3>{activeDefinition.label}清单</h3>
            </div>
            <span>{String(activeItems.length).padStart(2, "0")}</span>
          </div>

          <button className="admin-content-manager__new" type="button" onClick={createNew} disabled={busy}>
            <span aria-hidden="true">＋</span>
            {activeDefinition.newLabel}
          </button>

          {loading ? (
            <div className="admin-content-manager__item-skeletons" aria-label="正在读取内容" aria-live="polite">
              {[0, 1, 2].map((index) => <span key={index} />)}
              <span className="sr-only">正在读取内容清单。</span>
            </div>
          ) : activeItems.length ? (
            <ol className="admin-content-manager__item-list">
              {activeItems.map((item, index) => {
                const key = itemKey(item, index);
                const selected = !isNew && key === selection.id;
                const artwork = itemAsset(item);
                const status = itemStatus(item);
                return (
                  <li key={key}>
                    <button
                      className="admin-content-manager__item"
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => chooseItem(item, index)}
                      disabled={busy}
                    >
                      {artwork ? <img src={artwork} alt="" /> : <span className="admin-content-manager__item-placeholder" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
                      <span className="admin-content-manager__item-copy">
                        <strong>{itemTitle(item, `未命名${activeDefinition.itemLabel}`)}</strong>
                        <small>{itemMeta(item, activeType)}</small>
                      </span>
                      <span className={`admin-content-manager__status admin-content-manager__status--${status}`} role="img" aria-label={STATUS_LABELS[status]} />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="admin-content-manager__empty">
              <p>这里还没有{activeDefinition.itemLabel}。</p>
              <small>使用“{activeDefinition.newLabel}”建立第一个条目。</small>
            </div>
          )}
        </aside>

        <form className="admin-content-manager__editor" onSubmit={saveItem}>
          <div className="admin-content-manager__editor-header">
            <div>
              <p>{isNew ? `NEW ${activeDefinition.englishLabel} ENTRY` : `EDIT ${activeDefinition.englishLabel} ENTRY`}</p>
              <h3>{isNew ? activeDefinition.newLabel : itemTitle(selectedItem, `编辑${activeDefinition.itemLabel}`)}</h3>
            </div>
            <label className="admin-content-manager__status-control">
              <span>可见状态</span>
              <select name="status" value={form.status} onChange={changeField} disabled={loading || busy}>
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
              </select>
            </label>
          </div>

          <p className="admin-content-manager__editor-helper">{activeDefinition.helper}</p>

          <fieldset className="admin-content-manager__fields" disabled={loading || busy}>
            <label className="admin-content-manager__field admin-content-manager__field--wide">
              <span>{activeType === "game-wall" ? "标题或标签 / TITLE OR LABEL" : "标题 / TITLE"}</span>
              <input name="title" value={form.title} onChange={changeField} placeholder={activeType === "game-wall" ? "可选：为图片添加标题或标签" : `输入${activeDefinition.itemLabel}标题`} required={activeType !== "game-wall"} />
            </label>

            {activeType === "game-wall" ? (
              <>
                <label className="admin-content-manager__field">
                  <span>群组 / GROUP</span>
                  <select name="group" value={form.group} onChange={changeField}>
                    <option value="">请选择群组</option>
                    {GAME_WALL_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
                  </select>
                </label>
                {detailFields(activeType).map((field) => (
                  <label className="admin-content-manager__field" key={field.name}>
                    <span>{field.label}</span>
                    <input name={field.name} value={form[field.name]} onChange={changeField} placeholder={field.placeholder} inputMode={field.name === "number" ? "numeric" : undefined} />
                  </label>
                ))}
                <label className="admin-content-manager__field">
                  <span>形状 / SHAPE</span>
                  <select name="shape" value={form.shape} onChange={changeField}>
                    <option value="feature">焦点 / FEATURE</option>
                    <option value="wide">横幅 / WIDE</option>
                    <option value="standard">标准 / STANDARD</option>
                    <option value="tall">竖幅 / TALL</option>
                  </select>
                </label>
                <label className="admin-content-manager__field admin-content-manager__field--toggle">
                  <span>上下黑边 / LETTERBOXED</span>
                  <span className="admin-content-manager__toggle-row">
                    <input name="letterboxed" type="checkbox" checked={form.letterboxed} onChange={changeField} />
                    <b>{form.letterboxed ? "启用" : "关闭"}</b>
                  </span>
                </label>
              </>
            ) : (
              <>
                <label className="admin-content-manager__field">
                  <span>分类 / CATEGORY</span>
                  <select name="category" value={form.category} onChange={changeField}>
                    <option value="">请选择公开分类</option>
                    {WORK_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </label>
                {detailFields(activeType).map((field) => (
                  <label className="admin-content-manager__field" key={field.name}>
                    <span>{field.label}</span>
                    <input name={field.name} type={field.name === "externalUrl" ? "url" : "text"} value={form[field.name]} onChange={changeField} placeholder={field.placeholder} />
                  </label>
                ))}
              </>
            )}

            {activeType === "music" ? (
              <label className="admin-content-manager__field">
                <span>曲风 / CATEGORY</span>
                <input name="category" value={form.category} onChange={changeField} placeholder="例如：OST、电子、流行" />
              </label>
            ) : null}

            {activeType === "music" ? (
              <label className="admin-content-manager__field admin-content-manager__field--wide">
                <span>歌词 / LYRICS</span>
                <textarea name="lyrics" value={form.lyrics} onChange={changeField} placeholder="可贴上完整歌词；公开页会按换行显示。" rows="7" />
              </label>
            ) : null}

            <label className="admin-content-manager__field admin-content-manager__field--wide">
              <span>说明 / DESCRIPTION</span>
              <textarea name="description" value={form.description} onChange={changeField} placeholder="简洁说明这项内容会如何显示在公开页面。" rows="4" />
            </label>
          </fieldset>

          <div className="admin-content-manager__media-grid">
            <section className="admin-content-manager__media-card" aria-labelledby={`${panelId}-cover`}>
              <div className="admin-content-manager__media-heading">
                <div>
                  <p>VISUAL ASSET</p>
                  <h4 id={`${panelId}-cover`}>封面 / 图片</h4>
                </div>
                <span>01</span>
              </div>
              <div className="admin-content-manager__cover-preview" aria-label={shownCover ? "当前封面预览" : "尚未选择封面"}>
                {shownCover ? <img src={shownCover} alt="当前条目封面" /> : <span>NO COVER</span>}
              </div>
              <p className="admin-content-manager__media-managed">
                图片由站长代为加入网站。请把图片文件发给站长，刷新后会在这里显示。
              </p>
            </section>

            {activeType === "music" ? (
              <section className="admin-content-manager__media-card" aria-labelledby={`${panelId}-audio`}>
                <div className="admin-content-manager__media-heading">
                  <div>
                    <p>AUDIO ASSET</p>
                    <h4 id={`${panelId}-audio`}>音频文件</h4>
                  </div>
                  <span>02</span>
                </div>
                <div className="admin-content-manager__audio-readout">
                  <span aria-hidden="true">♫</span>
                  <div>
                    <strong>{form.audio ? "已连接音频地址" : "未选择音频"}</strong>
                    <small>{form.audio || "音频由站长代为加入网站。请发送 MP3、WAV、M4A 文件。"}</small>
                  </div>
                </div>
                <p className="admin-content-manager__media-managed">
                  不在后台选择文件；请直接把音频发给站长处理。
                </p>
              </section>
            ) : (
              <section className="admin-content-manager__media-card admin-content-manager__media-card--note" aria-label="媒体发布说明">
                <div className="admin-content-manager__media-heading">
                  <div>
                    <p>PUBLIC DELIVERY</p>
                    <h4>发布提示</h4>
                  </div>
                  <span>02</span>
                </div>
                <p>图片由站长加入后，请确认“可见状态”为“已发布”，再保存条目。草稿不会显示在公开网站。</p>
                <small>当前类型：{activeDefinition.label}</small>
              </section>
            )}
          </div>

          <div className="admin-content-manager__actions">
            <div className="admin-content-manager__operation" aria-live="polite">
              {action.message ? <p className={`admin-content-manager__notice admin-content-manager__notice--${action.state}`}>{action.message}</p> : null}
            </div>
            <div className="admin-content-manager__action-buttons">
              {!isNew ? (
                <button
                  className="admin-content-manager__delete"
                  type="button"
                  onClick={deleteItem}
                  disabled={loading || busy}
                >
                  {deleteArmed ? "确认删除" : "删除条目"}
                </button>
              ) : null}
              {deleteArmed ? (
                <button className="admin-content-manager__cancel-delete" type="button" onClick={() => setDeleteArmed(false)} disabled={busy}>
                  取消
                </button>
              ) : null}
              <button className="admin-content-manager__save" type="submit" disabled={loading || busy} aria-busy={busy}>
                <span>{pending ? "正在保存" : form.status === "published" ? "保存并发布" : "保存草稿"}</span>
                <i aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function UploadReadout({ upload, fallback }) {
  const message = upload?.message || fallback;
  const state = upload?.state || "idle";
  const progress = Number.isFinite(upload?.progress) ? Math.min(Math.max(Math.round(upload.progress), 0), 100) : null;
  const loadedBytes = Number.isFinite(upload?.loadedBytes) ? upload.loadedBytes : null;
  const totalBytes = Number.isFinite(upload?.totalBytes) && upload.totalBytes > 0 ? upload.totalBytes : null;
  const showProgress = progress !== null && (state === "pending" || state === "success");
  const progressMeta = showProgress && totalBytes
    ? `${formatMediaSize(loadedBytes ?? 0)} / ${formatMediaSize(totalBytes)}`
    : "";

  return (
    <div className={`admin-content-manager__upload-readout admin-content-manager__upload-readout--${state}`} role={state === "error" ? "alert" : state === "success" ? "status" : undefined}>
      <span aria-hidden="true" />
      <span className="admin-content-manager__upload-copy">{message}</span>
      {showProgress ? <strong className="admin-content-manager__upload-percent">{progress}%</strong> : null}
      {showProgress ? (
        <span className="admin-content-manager__upload-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      ) : null}
      {progressMeta ? <small className="admin-content-manager__upload-meta">{progressMeta}</small> : null}
    </div>
  );
}

function formatMediaSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 MB";
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1024) return `${(megabytes / 1024).toFixed(2)} GB`;
  if (megabytes >= 10) return `${Math.round(megabytes)} MB`;
  return `${megabytes.toFixed(1)} MB`;
}
