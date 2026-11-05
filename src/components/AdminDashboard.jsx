import { useId, useState } from "react";
import ShapeGrid from "./ShapeGrid";
import AdminOperationsPanel from "./AdminOperationsPanel";
import "./AdminDashboard.css";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? numberFormatter.format(count) : "—";
}

function formatDay(value) {
  if (typeof value !== "string" || value.trim() === "") return "今日摘要";

  const isoDay = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) return `${isoDay[1]}.${isoDay[2]}.${isoDay[3]}`;
  return value;
}

function MetricValue({ loading, value }) {
  if (loading) return <span className="admin-dashboard__metric-skeleton" aria-hidden="true" />;

  return <strong className="admin-dashboard__metric-value">{formatCount(value)}</strong>;
}

/**
 * Presentational private dashboard for an authenticated PHRNONO owner.
 *
 * The container that renders this component owns all data fetching and auth.
 * Expected `overview` shape: `{ visitors, analytics, operations, updatedAt }`.
 */
export default function AdminDashboard({
  overview,
  loading = false,
  error = "",
  onLogout,
  loggingOut = false,
  onResetAnalytics,
  resettingAnalytics = false,
  onRefresh,
  onCreateTask,
  onUpdateTask,
  onUpdateContact,
}) {
  const titleId = useId();
  const errorId = useId();
  const [resetArmed, setResetArmed] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const visitors = overview?.visitors ?? {};
  const analytics = overview?.analytics ?? {};
  const cvDownloads = analytics.cvDownloads ?? {};
  const workClicks = analytics.workClicks ?? {};
  const workDwell = analytics.workDwell ?? {};
  const averageDwellSeconds = Number(workDwell.events) > 0 ? Math.round(Number(workDwell.seconds || 0) / Number(workDwell.events)) : 0;
  const topWorkClicks = Object.entries(workClicks.bySlug ?? {})
    .map(([slug, count]) => ({ slug, count: Number(count) }))
    .filter((item) => Number.isFinite(item.count) && item.count >= 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const countries = Array.isArray(analytics.countries) ? analytics.countries : [];
  const devices = Array.isArray(analytics.devices) ? analytics.devices : [];
  const integrations = overview?.integrations ?? {};
  const canLogout = typeof onLogout === "function" && !loggingOut;
  const canResetAnalytics = typeof onResetAnalytics === "function" && !resettingAnalytics && !loading;
  const hasOverview = Boolean(overview && typeof overview === "object");
  const sessionStatus = loggingOut ? "正在结束安全会话" : "已验证 · 仅拥有者可见";
  const backendStatus = error
    ? "摘要同步需要重试"
    : loading
      ? "正在读取访客摘要"
      : hasOverview
        ? "访客计数服务已连接"
        : "等待后端摘要";
  const securityStatus = error ? "安全状态需要重试" : "CSP · HSTS · 同源会话";
  const performanceStatus = loading ? "正在读取边缘摘要" : "Edge Cache · DO 串行保护";

  function handleLogout() {
    if (!canLogout) return;
    onLogout();
  }

  async function handleAnalyticsReset() {
    if (!canResetAnalytics) return;
    if (!resetArmed) {
      setResetArmed(true);
      setResetComplete(false);
      return;
    }

    const reset = await onResetAnalytics();
    if (reset) {
      setResetArmed(false);
      setResetComplete(true);
    }
  }

  function cancelAnalyticsReset() {
    if (resettingAnalytics) return;
    setResetArmed(false);
  }

  return (
    <section className={`admin-dashboard${loggingOut ? " admin-dashboard--leaving" : ""}`} aria-labelledby={titleId}>
      <ShapeGrid
        className="admin-dashboard__shape-grid"
        speed={0.28}
        squareSize={48}
        direction="diagonal"
        borderColor="rgba(17, 19, 16, 0.08)"
        hoverFillColor="transparent"
        shape="square"
        hoverTrailAmount={0}
      />
      <div className="admin-dashboard__grid" aria-hidden="true" />
      <span className="admin-dashboard__scan" aria-hidden="true" />

      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">PHRNONO / OWNER CONSOLE</p>
          <h1 id={titleId}>管理控制台</h1>
        </div>
        <button
          className="admin-dashboard__logout"
          type="button"
          onClick={handleLogout}
          disabled={!canLogout}
          aria-busy={loggingOut}
        >
          <span>{loggingOut ? "正在退出" : "退出并返回主页"}</span>
          <i aria-hidden="true" />
        </button>
      </header>

      <main className="admin-dashboard__layout">
        <section className="admin-dashboard__overview" aria-label="访客摘要" aria-busy={loading}>
          <div className="admin-dashboard__section-heading">
            <div>
              <p>VISITOR READOUT</p>
              <h2>访问摘要</h2>
            </div>
            <span>{formatDay(visitors.day)}</span>
          </div>

          <div className="admin-dashboard__metrics">
            <article className="admin-dashboard__metric admin-dashboard__metric--total">
              <p>累计访问</p>
              <MetricValue loading={loading} value={visitors.total} />
              <small>自访客计数启用以来</small>
            </article>
            <article className="admin-dashboard__metric admin-dashboard__metric--today">
              <p>今日访问</p>
              <MetricValue loading={loading} value={visitors.today} />
              <small>按 Asia/Taipei 日期统计</small>
            </article>
          </div>

          <p className="admin-dashboard__privacy-note">
            访问统计只保存汇总次数，不记录访客身份。
          </p>
        </section>

        <aside className="admin-dashboard__system" aria-label="控制台状态">
          <div className="admin-dashboard__system-heading">
            <p>SYSTEM CHECK</p>
            <span aria-hidden="true">04</span>
          </div>

          <dl className="admin-dashboard__status-list">
            <div>
              <dt>会话状态</dt>
              <dd>
                <i className={loggingOut ? "admin-dashboard__status-dot admin-dashboard__status-dot--pending" : "admin-dashboard__status-dot"} aria-hidden="true" />
                {sessionStatus}
              </dd>
            </div>
            <div>
              <dt>后端状态</dt>
              <dd className={error ? "admin-dashboard__status-value admin-dashboard__status-value--error" : "admin-dashboard__status-value"}>
                <i className={error ? "admin-dashboard__status-dot admin-dashboard__status-dot--error" : "admin-dashboard__status-dot"} aria-hidden="true" />
                {backendStatus}
              </dd>
            </div>
            <div>
              <dt>安全防护</dt>
              <dd>
                <i className="admin-dashboard__status-dot" aria-hidden="true" />
                {securityStatus}
              </dd>
            </div>
            <div>
              <dt>性能策略</dt>
              <dd>
                <i className="admin-dashboard__status-dot" aria-hidden="true" />
                {performanceStatus}
              </dd>
            </div>
            <div>
              <dt>邮件转发</dt>
              <dd className={!integrations.emailForwarding ? "admin-dashboard__status-value admin-dashboard__status-value--error" : "admin-dashboard__status-value"}>
                <i className={!integrations.emailForwarding ? "admin-dashboard__status-dot admin-dashboard__status-dot--error" : "admin-dashboard__status-dot"} aria-hidden="true" />
                {integrations.emailForwarding ? "已配置 · API 邮件服务" : "待配置 RESEND / SENDGRID"}
              </dd>
            </div>
            <div>
              <dt>反垃圾验证</dt>
              <dd className={!integrations.captcha ? "admin-dashboard__status-value admin-dashboard__status-value--error" : "admin-dashboard__status-value"}>
                <i className={!integrations.captcha ? "admin-dashboard__status-dot admin-dashboard__status-dot--error" : "admin-dashboard__status-dot"} aria-hidden="true" />
                {integrations.captcha ? "Turnstile 已启用" : "待配置 Turnstile"}
              </dd>
            </div>
          </dl>

          {error ? (
            <p className="admin-dashboard__error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}

          <div className="admin-dashboard__storage-note">
            <span aria-hidden="true">＋</span>
            <div>
              <p>站长代传 / SEND FILES</p>
              <small>请把图片、音乐或作品文件发送给站长，由站长统一加入网站。</small>
            </div>
          </div>
        </aside>
      </main>

      <section className="admin-dashboard__analytics" aria-label="网站数据统计" aria-busy={loading}>
        <div className="admin-dashboard__analytics-heading">
          <div>
            <p>DATA INSTRUMENTS</p>
            <h2>数据统计</h2>
          </div>
          <div className="admin-dashboard__analytics-actions">
            <span>LIVE</span>
            <button
              className={`admin-dashboard__analytics-reset${resetArmed ? " admin-dashboard__analytics-reset--armed" : ""}`}
              type="button"
              onClick={handleAnalyticsReset}
              disabled={!canResetAnalytics}
              aria-busy={resettingAnalytics}
              aria-expanded={resetArmed}
              aria-controls={resetArmed || resetComplete ? `${titleId}-analytics-reset` : undefined}
            >
              <i aria-hidden="true" />
              {resettingAnalytics ? "正在重置" : resetArmed ? "确认重置" : "重置统计"}
            </button>
          </div>
        </div>
        {resetArmed || resetComplete ? (
          <div
            className={`admin-dashboard__analytics-reset-note${resetArmed ? " admin-dashboard__analytics-reset-note--armed" : ""}`}
            id={`${titleId}-analytics-reset`}
            role={resetArmed ? "alert" : "status"}
          >
            <p>{resetArmed ? "确认后将清空访问、CV 下载、作品点击、停留、设备与国家汇总；不会影响内容、图片或音乐。" : "统计数据已重置。新的访问会从 0 重新开始统计。"}</p>
            {resetArmed ? (
              <button type="button" onClick={cancelAnalyticsReset} disabled={resettingAnalytics}>取消</button>
            ) : null}
          </div>
        ) : null}
        <div className="admin-dashboard__analytics-grid">
          <article>
            <p>CV 下载 / CV DOWNLOADS</p>
            <MetricValue loading={loading} value={cvDownloads.total} />
            <small>今日 {formatCount(cvDownloads.today)}</small>
          </article>
          <article>
            <p>作品点击 / WORK CLICKS</p>
            <MetricValue loading={loading} value={workClicks.total} />
            <small>今日 {formatCount(workClicks.today)} · 平均停留 {formatCount(averageDwellSeconds)} 秒</small>
          </article>
          <article>
            <p>设备 / DEVICES</p>
            <div className="admin-dashboard__analytics-list">
              {devices.length > 0 ? devices.slice(0, 3).map((item) => <span key={item.key}>{item.key}<b>{formatCount(item.count)}</b></span>) : <span>暂无数据</span>}
            </div>
          </article>
          <article>
            <p>来源国家 / COUNTRIES</p>
            <div className="admin-dashboard__analytics-list">
              {countries.length > 0 ? countries.slice(0, 3).map((item) => <span key={item.key}>{item.key}<b>{formatCount(item.count)}</b></span>) : <span>暂无数据</span>}
            </div>
          </article>
        </div>
        <div className="admin-dashboard__analytics-detail">
          <p>作品点击排行 / WORK BREAKDOWN</p>
          <div className="admin-dashboard__analytics-bars">
            {topWorkClicks.length > 0 ? topWorkClicks.map((item) => {
              const max = topWorkClicks[0].count || 1;
              return (
                <span key={item.slug}>
                  <b>{item.slug}</b>
                  <i><em style={{ width: `${Math.max(4, Math.round((item.count / max) * 100))}%` }} /></i>
                  <strong>{formatCount(item.count)}</strong>
                </span>
              );
            }) : <span>暂无作品点击数据</span>}
          </div>
        </div>
        <p className="admin-dashboard__analytics-note">仅保存汇总数据，不记录 IP、姓名或原始访问日志。作品点击按页面 slug 汇总。</p>
      </section>

      <AdminOperationsPanel
        operations={overview?.operations}
        integrations={integrations}
        loading={loading}
        onRefresh={onRefresh}
        onCreateTask={onCreateTask}
        onUpdateTask={onUpdateTask}
        onUpdateContact={onUpdateContact}
      />

      <footer className="admin-dashboard__footer" aria-live="polite">
        <span>PRIVATE AREA / PHRNONO</span>
        <span>{loading ? "UPDATING SUMMARY" : "SUMMARY READY"}</span>
      </footer>
    </section>
  );
}
