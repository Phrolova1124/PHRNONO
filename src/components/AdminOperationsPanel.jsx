import { useId, useRef, useState } from "react";
import "./AdminOperationsPanel.css";

const numberFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const contactStates = ["NEW", "READ", "REPLIED", "ARCHIVED"];
const contactLabels = { NEW: "新留言", READ: "已读", REPLIED: "已回复", ARCHIVED: "已归档" };
const taskStates = ["OPEN", "DONE", "ARCHIVED"];
const taskLabels = { OPEN: "待办", DONE: "已完成", ARCHIVED: "已归档" };
const suggestions = ["Compress Game Wall images", "Update CV", "Add new character project"];

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function count(value) {
  const parsed = finiteNumber(value);
  return parsed === null ? "—" : numberFormat.format(parsed);
}

function bytes(value) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "—";
  if (parsed === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.max(0, Math.min(Math.floor(Math.log(parsed) / Math.log(1024)), units.length - 1));
  return `${numberFormat.format(Number((parsed / (1024 ** unit)).toFixed(unit > 0 ? 2 : 0)))} ${units[unit]}`;
}

function date(value) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

function replyLink(email) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email)) return null;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Re: PHRNONO 网站留言")}`;
}

function databaseLabel(status) {
  if (["ok", "available", "connected", "healthy", "ready"].includes(status)) return "已连接";
  if (["unconfigured", "not_configured", "disabled"].includes(status)) return "未配置数据库";
  return "暂不可用";
}

function Readout({ label, value, hint, loading, compact = false }) {
  return (
    <div className={`admin-operations__readout${compact ? " admin-operations__readout--compact" : ""}`}>
      <dt>{label}</dt>
      <dd>{loading ? <><span className="admin-operations__skeleton" aria-hidden="true" /><span className="admin-operations__sr-only">正在读取</span></> : value}</dd>
      <small>{hint}</small>
    </div>
  );
}

function SectionHeading({ english, title, children, id }) {
  return (
    <header className="admin-operations__heading">
      <div><p>{english}</p><h2 id={id}>{title}</h2></div>
      {children}
    </header>
  );
}

/** Data and persistence are owned by the authenticated dashboard container. */
export default function AdminOperationsPanel({
  operations,
  integrations = {},
  loading = false,
  onRefresh,
  onCreateTask,
  onUpdateTask,
  onUpdateContact,
}) {
  const panelId = useId();
  const taskInputRef = useRef(null);
  const [pending, setPending] = useState({});
  const [mutationError, setMutationError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [contactFilter, setContactFilter] = useState("NEW");
  const [taskFilter, setTaskFilter] = useState("OPEN");
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const available = operations?.available === true;
  const security = operations?.security ?? {};
  const health = operations?.health ?? {};
  const email = operations?.email ?? {};
  const contacts = Array.isArray(email.contacts) ? email.contacts : [];
  const tasks = Array.isArray(operations?.tasks) ? operations.tasks : [];
  const contactCounts = email.counts ?? {};
  const totalContacts = contactStates.every((state) => finiteNumber(contactCounts[state]) !== null)
    ? contactStates.reduce((total, state) => total + Number(contactCounts[state]), 0)
    : undefined;
  const storageBytes = finiteNumber(health.storageBytes);
  const reservedBytes = finiteNumber(health.reservedBytes);
  const storageLimit = finiteNumber(health.storageLimitBytes);
  const storagePercent = storageBytes !== null && storageLimit > 0
    ? Math.min(100, (storageBytes / storageLimit) * 100)
    : null;
  const reservedPercent = reservedBytes !== null && storageLimit > 0 && storagePercent !== null
    ? Math.min(100 - storagePercent, (reservedBytes / storageLimit) * 100)
    : 0;
  const shownContacts = contacts.filter((item) => item.status === contactFilter);
  const shownTasks = tasks.filter((item) => item.status === taskFilter);
  const canCreate = available && !loading && typeof onCreateTask === "function" && !pending.create;
  const isRefreshing = loading || pending.refresh;

  async function mutate(key, action, success) {
    if (pending[key]) return false;
    setPending((current) => ({ ...current, [key]: true }));
    setMutationError("");
    setAnnouncement("");
    try {
      await action();
      setAnnouncement(success);
      return true;
    } catch (error) {
      setMutationError(error instanceof Error && error.message ? error.message : "保存失败，请重试。");
      return false;
    } finally {
      setPending((current) => ({ ...current, [key]: false }));
    }
  }

  async function createTask(event) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!canCreate || !title) return;
    if (await mutate("create", () => onCreateTask({ title }), "已添加维护任务。")) setNewTitle("");
  }

  async function saveTask(event, task) {
    event.preventDefault();
    const title = editTitle.trim();
    if (!title || typeof onUpdateTask !== "function") return;
    if (await mutate(`task:${task.id}`, () => onUpdateTask({ id: task.id, title }), "已保存任务。")) setEditingId(null);
  }

  async function changeTask(task, status) {
    if (typeof onUpdateTask !== "function") return;
    const saved = await mutate(`task:${task.id}`, () => onUpdateTask({ id: task.id, status }), `任务已${status === "DONE" ? "完成" : status === "ARCHIVED" ? "归档" : "恢复为待办"}。`);
    if (saved && editingId === task.id) setEditingId(null);
  }

  function startEditing(task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setMutationError("");
  }

  function taskAction(task) {
    if (task.status === "OPEN") return "标记完成";
    if (task.status === "DONE") return "重新打开";
    return "恢复待办";
  }

  return (
    <section className="admin-operations" aria-label="网站运行与维护" aria-busy={loading}>
      <div className="admin-operations__toolbar">
        <p>OPERATIONS / 网站运行与维护</p>
        <button type="button" className="admin-operations__button" disabled={isRefreshing || typeof onRefresh !== "function"} aria-busy={Boolean(isRefreshing)} onClick={() => mutate("refresh", async () => { if (await onRefresh() === false) throw new Error("刷新摘要失败，请重试。"); }, "运行摘要已更新。")}>{isRefreshing ? "正在刷新" : "刷新摘要"}</button>
      </div>
      {!available && !loading ? <p className="admin-operations__notice">运行摘要暂不可用，请刷新重试。</p> : null}
      {mutationError ? <p className="admin-operations__error" role="alert">{mutationError}</p> : null}
      <p className="admin-operations__sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      <div className="admin-operations__instrument-row">
        <section className="admin-operations__section" aria-labelledby={`${panelId}-security`}>
          <SectionHeading english="SECURITY EVENTS" title="安全事件" id={`${panelId}-security`}><span className="admin-operations__tag">SUMMARY</span></SectionHeading>
          <dl className="admin-operations__metrics admin-operations__metrics--security">
            <Readout label="TURNSTILE BLOCKED" value={count(security.turnstileBlocked)} hint="人机验证拦截" loading={loading} />
            <Readout label="RATE LIMITED" value={count(security.rateLimited)} hint="请求频率限制" loading={loading} />
            <Readout label="SUSPICIOUS REQUESTS" value={count(security.suspiciousRequests)} hint="可疑请求" loading={loading} />
          </dl>
          <p className="admin-operations__note">仅显示本站捕获的汇总，不展示攻击内容或访客身份。</p>
          <p className="admin-operations__timestamp">TRACKING SINCE <time>{date(security.trackingSince)}</time></p>
        </section>

        <section className="admin-operations__section admin-operations__section--health" aria-labelledby={`${panelId}-health`}>
          <SectionHeading english="STORAGE / DATABASE HEALTH" title="存储与数据库" id={`${panelId}-health`}><span className="admin-operations__tag">{loading ? "读取中" : databaseLabel(health.databaseStatus)}</span></SectionHeading>
          <dl className="admin-operations__metrics admin-operations__metrics--health">
            <Readout label="DB" value={bytes(health.databaseBytes)} hint="数据库占用" loading={loading} compact />
            <Readout label="STORAGE" value={bytes(health.storageBytes)} hint="后台管理的媒体" loading={loading} compact />
            <Readout label="EVENTS" value={count(health.events)} hint="已记录的运行事件" loading={loading} compact />
            <Readout label="UPTIME" value={finiteNumber(health.uptimePercent) === null ? "未接入监测" : `${Number(health.uptimePercent).toFixed(2)}%`} hint="独立可用率监测" loading={loading} compact />
          </dl>
          <div className="admin-operations__capacity">
            <div><p>MEDIA CAPACITY / 媒体配额</p><strong>{bytes(health.storageBytes)} <span>/ {bytes(health.storageLimitBytes)}</span></strong></div>
            <div className="admin-operations__gauge" role={storagePercent === null ? undefined : "meter"} aria-label="后台管理媒体配额使用率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={storagePercent ?? undefined} aria-valuetext={storagePercent === null ? undefined : `已使用 ${storagePercent.toFixed(1)}%，预留 ${(reservedPercent).toFixed(1)}%`}>
              {storagePercent !== null ? <><span style={{ width: `${storagePercent}%` }} /><i style={{ width: `${reservedPercent}%` }} /></> : null}
            </div>
            <p className="admin-operations__note">仅计入后台管理的媒体，不含网站静态资源或整个存储桶。{reservedBytes > 0 ? ` 另有 ${bytes(reservedBytes)} 上传预留。` : ""}</p>
          </div>
          <p className="admin-operations__timestamp">CHECKED <time>{date(health.checkedAt)}</time> · ASIA/TAIPEI</p>
        </section>
      </div>

      <section className="admin-operations__section admin-operations__section--email" aria-labelledby={`${panelId}-email`}>
        <SectionHeading english="EMAIL SYSTEM" title="邮件与联系留言" id={`${panelId}-email`}><span className="admin-operations__tag">{integrations.emailForwarding ? "邮件已配置" : "邮件待配置"}</span></SectionHeading>
        <dl className="admin-operations__metrics admin-operations__metrics--email">
          <Readout label="MAIL SENT" value={count(email.sent)} hint="邮件 API 接收成功" loading={loading} />
          <Readout label="FAILED" value={count(email.failed)} hint="邮件 API 发送失败" loading={loading} />
          <Readout label="LAST DELIVERY" value={date(email.lastDeliveryAt)} hint="最近一次 API 接收" loading={loading} compact />
          <Readout label="CONTACT FORM" value={count(totalContacts)} hint="收到的联系留言" loading={loading} />
        </dl>
        <div className="admin-operations__email-caption"><p className="admin-operations__note">LAST DELIVERY 表示邮件 API 已接收，不是收件箱送达回执。标记已回复仅更新状态；回复请打开邮件。</p><p className="admin-operations__timestamp">TRACKING SINCE <time>{date(email.trackingSince)}</time></p></div>
        <div className="admin-operations__workflow" aria-label="联系留言处理流程">NEW <span aria-hidden="true">→</span> READ <span aria-hidden="true">→</span> REPLIED <span aria-hidden="true">→</span> ARCHIVED</div>
        <div className="admin-operations__filters" role="group" aria-label="筛选联系留言">
          {contactStates.map((state) => <button type="button" key={state} aria-pressed={contactFilter === state} onClick={() => setContactFilter(state)}><span>{contactLabels[state]}</span><b>{count(contactCounts[state])}</b></button>)}
        </div>
        <p className="admin-operations__list-note">显示最近 100 条保存的联系留言；上方状态数量包含全部记录。</p>
        <div className="admin-operations__contact-list">
          {shownContacts.length ? shownContacts.map((contact) => {
            const href = replyLink(contact.email);
            const saving = Boolean(pending[`contact:${contact.id}`]);
            const mailLabel = contact.deliveryPending ? "发送结果待确认" : contact.mailStatus === "sent" ? "API 已接收" : contact.mailStatus === "failed" ? "邮件发送失败" : "邮件服务未配置";
            return (
              <details className="admin-operations__contact" key={contact.id}>
                <summary><span><strong>{contact.name || "未留姓名"}</strong><small>{contact.email}</small></span><time>{date(contact.createdAt)}</time><b>{contactLabels[contact.status]}</b><span className="admin-operations__disclosure" aria-hidden="true">＋</span></summary>
                <div className="admin-operations__contact-body">
                  <p className="admin-operations__message">{contact.message}</p>
                  <div className="admin-operations__contact-controls">
                    <label htmlFor={`${panelId}-contact-${contact.id}`}>处理状态<select id={`${panelId}-contact-${contact.id}`} value={contact.status} disabled={!available || loading || saving || typeof onUpdateContact !== "function"} aria-busy={saving} onChange={(event) => { const status = event.target.value; mutate(`contact:${contact.id}`, () => onUpdateContact({ id: contact.id, status }), `留言已标记为${contactLabels[status]}。`); }}>{contactStates.map((state) => <option key={state} value={state}>{state === "REPLIED" ? "标记已回复" : contactLabels[state]}</option>)}</select></label>
                    {href ? <a className="admin-operations__button" href={href}>打开邮件回复 ↗</a> : null}
                    <span className={contact.mailStatus === "failed" ? "admin-operations__mail-status admin-operations__mail-status--failed" : "admin-operations__mail-status"}>{saving ? "正在保存状态" : mailLabel}</span>
                  </div>
                  <p className="admin-operations__timestamp">UPDATED <time>{date(contact.updatedAt)}</time> · ASIA/TAIPEI</p>
                </div>
              </details>
            );
          }) : <p className="admin-operations__empty">{loading ? "正在读取联系留言…" : `暂无${contactLabels[contactFilter]}。`}</p>}
        </div>
      </section>

      <section className="admin-operations__section admin-operations__section--tasks" aria-labelledby={`${panelId}-tasks`}>
        <SectionHeading english="NOTES / TODO" title="维护笔记与任务" id={`${panelId}-tasks`}><span className="admin-operations__tag">OWNER NOTES</span></SectionHeading>
        <form className="admin-operations__create-task" onSubmit={createTask}>
          <label htmlFor={`${panelId}-new-task`}>添加维护任务</label>
          <div><input ref={taskInputRef} id={`${panelId}-new-task`} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={240} required placeholder="写下一件要做的事" disabled={!available || loading || Boolean(pending.create)} /><button className="admin-operations__button admin-operations__button--primary" type="submit" disabled={!canCreate || !newTitle.trim()} aria-busy={Boolean(pending.create)}>{pending.create ? "正在添加" : "添加任务 ＋"}</button></div>
        </form>
        <div className="admin-operations__suggestions"><span>快速填写</span>{suggestions.map((title) => <button key={title} type="button" disabled={!canCreate} onClick={() => { setNewTitle(title); taskInputRef.current?.focus(); }}>{title}</button>)}</div>
        <div className="admin-operations__filters" role="group" aria-label="筛选维护任务">
          {taskStates.map((state) => <button type="button" key={state} aria-pressed={taskFilter === state} onClick={() => setTaskFilter(state)}><span>{taskLabels[state]}</span><b>{available ? count(tasks.filter((task) => task.status === state).length) : "—"}</b></button>)}
        </div>
        <p className="admin-operations__list-note">显示最近 200 条任务；筛选数量按当前列表计算。</p>
        <ul className="admin-operations__task-list">
          {shownTasks.length ? shownTasks.map((task) => {
            const saving = Boolean(pending[`task:${task.id}`]);
            const disabled = !available || loading || saving || typeof onUpdateTask !== "function";
            return <li className={`admin-operations__task${task.status === "DONE" ? " admin-operations__task--done" : ""}`} key={task.id} aria-busy={saving}>
              {editingId === task.id ? (
                <form className="admin-operations__edit-task" onSubmit={(event) => saveTask(event, task)}>
                  <label className="admin-operations__sr-only" htmlFor={`${panelId}-edit-${task.id}`}>任务内容</label>
                  <input id={`${panelId}-edit-${task.id}`} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={240} required disabled={disabled} autoFocus />
                  <div>
                    <button className="admin-operations__button admin-operations__button--primary" type="submit" disabled={disabled || !editTitle.trim()}>保存</button>
                    <button className="admin-operations__button" type="button" disabled={saving} onClick={() => setEditingId(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="admin-operations__task-text"><strong>{task.title}</strong><time>{date(task.updatedAt || task.createdAt)}</time></div>
                  <div className="admin-operations__task-actions">
                    <button className="admin-operations__button" type="button" disabled={disabled} aria-label={`${taskAction(task)}：${task.title}`} onClick={() => changeTask(task, task.status === "OPEN" ? "DONE" : "OPEN")}>{saving ? "正在保存" : taskAction(task)}</button>
                    <button className="admin-operations__button" type="button" disabled={disabled} aria-label={`编辑任务：${task.title}`} onClick={() => startEditing(task)}>编辑</button>
                    {task.status !== "ARCHIVED" ? <button className="admin-operations__button admin-operations__button--quiet" type="button" disabled={disabled} aria-label={`归档任务：${task.title}`} onClick={() => changeTask(task, "ARCHIVED")}>归档</button> : null}
                  </div>
                </>
              )}
            </li>;
          }) : <li className="admin-operations__empty">{loading ? "正在读取维护任务…" : taskFilter === "OPEN" ? "没有待办任务。可以在上方添加下一件维护工作。" : `暂无${taskLabels[taskFilter]}任务。`}</li>}
        </ul>
      </section>
    </section>
  );
}
