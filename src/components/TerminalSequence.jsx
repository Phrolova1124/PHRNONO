import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import useDocumentScrollLock from "./useDocumentScrollLock";
import { terminalExitMs, terminalPhases as phases, terminalTimelines as timelines } from "./terminalTimelines";
import "./TerminalSequence.css";

const lastStage = phases.length - 1;

const messages = {
  zh: {
    skip: "跳过开场", enter: "进入网站", login: "前往登录", console: "进入控制台",
    public: {
      label: "作品集开场", phase: ["正在拼合视觉标志", "展开作品档案", "作品信息依次展开", "作品信息已确认", "视觉档案已开启", "欢迎来到我的创作空间", "正在进入作品集"],
      headline: "视觉档案，已开启。", welcome: "欢迎来到", subtitle: "3D 建模 / 数字艺术",
      checks: ["3D 作品", "游戏画面", "音乐收藏"], status: "公开作品集", end: "即将进入作品集",
    },
    access: {
      label: "管理员登录开场", phase: ["正在拼合入口标志", "定位管理入口", "展开登录信息", "准备构筑登录界面", "正在构筑面板框架", "展开标题与账号输入区", "登录界面即将就绪"],
      headline: "管理入口，已开启。", welcome: "拥有者空间", subtitle: "使用你的账号与密码登录",
      checks: ["登录面板", "账号与密码", "拥有者访问"], status: "需要身份验证", end: "请登录以继续",
    },
    authorized: {
      label: "登录成功", phase: ["登录成功，开启授权序列", "定位拥有者身份", "展开核验信息", "身份与登录会话已确认", "访问授权已通过", "欢迎回来", "正在进入管理控制台"],
      headline: "核验信息通过。", welcome: "欢迎回来", subtitle: "你的管理控制台已就绪",
      checks: ["拥有者身份", "账号与密码", "登录会话"], status: "授权通过", end: "正在进入管理控制台",
    },
  },
  en: {
    skip: "Skip intro", enter: "Enter portfolio", login: "Go to sign in", console: "Enter console",
    public: {
      label: "Portfolio opening", phase: ["Assembling the visual mark", "Opening the archive", "Unfolding archive details", "Archive details confirmed", "Visual archive is open", "Welcome to my creative space", "Entering the portfolio"],
      headline: "Visual archive is open.", welcome: "WELCOME TO", subtitle: "3D MODELING / DIGITAL ART",
      checks: ["3D work", "Game captures", "Music collection"], status: "PUBLIC PORTFOLIO", end: "Entering the portfolio",
    },
    access: {
      label: "Admin sign-in opening", phase: ["Assembling the access mark", "Locating owner access", "Unfolding sign-in details", "Preparing the sign-in layout", "Drawing the panel frame", "Revealing the sign-in fields", "Sign-in panel almost ready"],
      headline: "Owner access is open.", welcome: "OWNER SPACE", subtitle: "Sign in with your email and password",
      checks: ["Sign-in panel", "Email & password", "Owner access"], status: "SIGN-IN REQUIRED", end: "Sign in to continue",
    },
    authorized: {
      label: "Sign-in successful", phase: ["Signed in. Opening authorization", "Locating owner identity", "Unfolding verification details", "Identity and session confirmed", "Access authorized", "Welcome back", "Entering your console"],
      headline: "Identity verified.", welcome: "WELCOME BACK", subtitle: "Your owner console is ready",
      checks: ["Owner identity", "Email & password", "Sign-in session"], status: "ACCESS AUTHORIZED", end: "Entering your console",
    },
  },
  ja: {
    skip: "スキップ", enter: "作品集へ", login: "ログインへ", console: "管理画面へ",
    public: {
      label: "作品集のオープニング", phase: ["シンボルを組み立てています", "アーカイブを開いています", "作品情報を展開しています", "作品情報の確認完了", "アーカイブを開きました", "創作の世界へようこそ", "作品集に移動します"],
      headline: "作品アーカイブ、開きました。", welcome: "ようこそ", subtitle: "3D モデリング / デジタルアート",
      checks: ["3D 作品", "ゲームの記録", "音楽コレクション"], status: "公開作品集", end: "作品集に移動します",
    },
    access: {
      label: "管理者ログインのオープニング", phase: ["入口のシンボルを組み立てています", "管理画面を準備しています", "ログイン情報を展開しています", "画面の構築を準備しています", "パネルの枠を描いています", "入力欄を展開しています", "まもなくログインできます"],
      headline: "管理画面を開きました。", welcome: "オーナースペース", subtitle: "メールアドレスとパスワードでログイン",
      checks: ["ログイン画面", "アカウント情報", "オーナーアクセス"], status: "ログインが必要です", end: "ログインして続行",
    },
    authorized: {
      label: "ログイン成功", phase: ["ログイン成功、認証画面を開きます", "オーナー情報を表示しています", "認証情報を展開しています", "本人とセッションの確認完了", "アクセスが許可されました", "おかえりなさい", "管理画面に移動します"],
      headline: "認証が完了しました。", welcome: "おかえりなさい", subtitle: "管理画面の準備ができました",
      checks: ["オーナー確認", "アカウント認証", "ログインセッション"], status: "アクセス許可", end: "管理画面に移動します",
    },
  },
};

/** A visual introduction only. Authentication is completed by the caller. */
export default function TerminalSequence({ mode = "public", locale = "zh", onBuildStep, onDone }) {
  const reduceMotion = useReducedMotion();
  const timeline = timelines[mode] || timelines.public;
  const language = messages[locale] || messages.zh;
  const copy = language[mode] || language.public;
  const [stage, setStage] = useState(reduceMotion ? lastStage : 0);
  const callbacks = useRef({ onDone, onBuildStep });
  const finished = useRef(false);
  const meterRef = useRef(null);
  const numberRef = useRef(null);
  const skipRef = useRef(null);
  const titleId = useId();
  const isAccess = mode === "access";
  const isAuthorized = mode === "authorized";
  useDocumentScrollLock();

  useEffect(() => { callbacks.current = { onDone, onBuildStep }; }, [onDone, onBuildStep]);

  const complete = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    callbacks.current.onBuildStep?.(4);
    callbacks.current.onDone?.();
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    skipRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.closest("[inert]")) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    finished.current = false;
    if (reduceMotion) {
      setStage(lastStage);
      callbacks.current.onBuildStep?.(4);
      const timer = window.setTimeout(complete, 80);
      return () => window.clearTimeout(timer);
    }
    setStage(0);
    const timers = timeline.stages.map((delay, index) => window.setTimeout(() => {
      if (!finished.current) setStage(index + 1);
    }, delay));
    (timeline.build || []).forEach((delay, index) => timers.push(window.setTimeout(() => {
      if (!finished.current) callbacks.current.onBuildStep?.(index + 1);
    }, delay)));
    timers.push(window.setTimeout(complete, timeline.duration));

    // One clock drives the vertical loading line and its percentage, without
    // re-rendering the portfolio or login form on every animation frame.
    let frame;
    let lastPercent = -1;
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / (timeline.duration - 400));
      const percent = Math.floor(progress * 100);
      if (meterRef.current) meterRef.current.style.transform = `scaleY(${progress})`;
      if (percent !== lastPercent && numberRef.current) {
        numberRef.current.textContent = String(percent).padStart(2, "0");
        lastPercent = percent;
      }
      if (progress < 1 && !finished.current) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(frame);
    };
  }, [complete, reduceMotion, timeline]);

  const buttonText = stage < lastStage ? language.skip : isAuthorized ? language.console : isAccess ? language.login : language.enter;

  return (
    <motion.section
      className={`terminal-sequence terminal-sequence--${mode}`}
      data-stage={stage}
      data-phase={phases[stage]}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { clipPath: "inset(100% 0 0 0)" }}
      transition={{ duration: reduceMotion ? 0.01 : terminalExitMs / 1000, ease: [0.76, 0, 0.24, 1] }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); complete(); }
        if (event.key === "Tab") { event.preventDefault(); skipRef.current?.focus(); }
      }}
    >
      <h2 className="sr-only" id={titleId}>{copy.label}</h2>
      <div className="terminal-sequence__paper" aria-hidden="true" />
      <div className="terminal-sequence__shutters" aria-hidden="true">{[0, 1, 2, 3].map((index) => <i key={index} style={{ "--index": index }} />)}</div>
      <div className="terminal-sequence__grid" aria-hidden="true" />
      <div className="terminal-sequence__sweep" aria-hidden="true" />
      <header className="terminal-sequence__header">
        <div className="terminal-sequence__brand" aria-hidden="true">
          <strong>PHRNONO</strong>
          <span>{mode === "public" ? "VISUAL ARCHIVE" : "OWNER TERMINAL"}</span>
          <small>3D / PIXEL / DIGITAL ART</small>
        </div>
        <button ref={skipRef} className="terminal-sequence__skip" type="button" onClick={complete}>
          <span>{buttonText}</span><span aria-hidden="true">↗</span>
        </button>
      </header>

      <div className="terminal-sequence__rail" aria-hidden="true">
        <span className="terminal-sequence__rail-name">{isAuthorized ? "AUTHORIZATION" : "INITIALIZATION"}</span>
        <span className="terminal-sequence__meter"><span ref={meterRef} /></span>
        <span className="terminal-sequence__percent"><b ref={numberRef}>{reduceMotion ? "100" : "00"}</b><small>%</small></span>
      </div>

      <div className="terminal-sequence__scene" aria-hidden="true">
        <div className="terminal-sequence__cross terminal-sequence__cross--tl" />
        <div className="terminal-sequence__cross terminal-sequence__cross--br" />
        <div className="terminal-sequence__orbit"><i /><i /><i /></div>
        <div className="terminal-sequence__registration"><i /><i /><i /><i /></div>
        <div className="terminal-sequence__identity">
          <div className="terminal-sequence__emblem">
            <span className="terminal-sequence__bracket terminal-sequence__bracket--left" />
            <img className="terminal-sequence__asset" src="/portfolio/asset-175.svg" alt="" />
            <span className="terminal-sequence__bracket terminal-sequence__bracket--right" />
            <span className="terminal-sequence__scanner" />
            <small>PHR / VISUAL SYSTEM</small>
          </div>
          <div className="terminal-sequence__readout">
            <span className="terminal-sequence__eyebrow">{isAuthorized ? "IDENTITY CONFIRMED" : isAccess ? "OWNER ACCESS" : "ARCHIVE INITIALIZATION"}</span>
            <p>{copy.headline}</p>
            <div className="terminal-sequence__checklist">
              {copy.checks.map((label, index) => (
                <div key={label} className={stage >= 3 ? "is-ready" : ""} style={{ "--index": index }}>
                  <span className="terminal-sequence__check-mark">+</span>
                  <span>{label}</span>
                  <i />
                  <span className="terminal-sequence__check-symbol">{isAccess ? "+" : "✓"}</span>
                </div>
              ))}
            </div>
            {isAuthorized && <span className="terminal-sequence__reference">{locale === "en" ? "AUTHORIZATION" : locale === "ja" ? "認証番号" : "授权编号"} / PHR-OWNER-01</span>}
          </div>
        </div>

        <div className="terminal-sequence__clearance">
          <div className="terminal-sequence__seal"><i /><i />{isAuthorized ? <b>✓</b> : <img className="terminal-sequence__seal-asset" src="/portfolio/asset-175.svg" alt="" />}</div>
          <span className="terminal-sequence__clearance-rule" />
          <span>{isAuthorized ? "PERMISSION AUTHORIZED" : isAccess ? "SIGN IN TO CONTINUE" : "VISUAL ARCHIVE ONLINE"}</span>
          <strong>{copy.status}</strong>
          <span className="terminal-sequence__clearance-rule" />
        </div>

        <div className="terminal-sequence__welcome">
          <span>{copy.welcome}</span>
          <strong>{isAccess ? "OWNER" : "PHRNONO"}</strong>
          <p>{copy.subtitle}</p>
          <div className="terminal-sequence__welcome-rule"><i /></div>
        </div>
      </div>

      <footer className="terminal-sequence__footer">
        <p role="status" aria-live="polite"><span aria-hidden="true" />{copy.phase[stage]}</p>
        <div className="terminal-sequence__phase-marks" aria-hidden="true">
          {phases.map((phase, index) => <i key={phase} className={stage >= index ? "is-active" : ""} />)}
        </div>
        <span aria-hidden="true">{stage === lastStage ? copy.end : "PHRNONO / PERSONAL ARCHIVE"}</span>
      </footer>
    </motion.section>
  );
}
