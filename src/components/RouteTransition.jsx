import { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import useDocumentScrollLock from "./useDocumentScrollLock";
import "./RouteTransition.css";

const routeCopy = {
  zh: { home: "首页", work: "作品档案", game: "游戏墙", music: "音乐收藏", character: "角色设计", admin: "管理入口", about: "关于我", contact: "联系我", fallback: "页面", opening: "正在打开", caption: "3D 建模 / 数字艺术" },
  en: { home: "Home", work: "Selected work", game: "Game wall", music: "Music collection", character: "Character design", admin: "Owner access", about: "About", contact: "Contact", fallback: "Page", opening: "Opening", caption: "3D MODELING / DIGITAL ART" },
  ja: { home: "ホーム", work: "作品アーカイブ", game: "ゲームウォール", music: "音楽コレクション", character: "キャラクターデザイン", admin: "管理画面", about: "プロフィール", contact: "お問い合わせ", fallback: "ページ", opening: "移動先", caption: "3D モデリング / デジタルアート" },
};

function destinationCopy(href, locale) {
  const copy = routeCopy[locale] || routeCopy.zh;
  let url;
  try { url = new URL(href || "/", window.location.href); } catch { url = new URL("/", window.location.href); }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  let key = "fallback";
  let index = "VISUAL ARCHIVE";
  if (path === "/") { key = url.hash === "#about" ? "about" : url.hash === "#contact" ? "contact" : "home"; index = "PORTFOLIO"; }
  else if (path === "/work" || path.startsWith("/work/")) { key = "work"; index = "SELECTED WORK"; }
  else if (path === "/game-wall") { key = "game"; index = "GAME WALL"; }
  else if (path === "/music") { key = "music"; index = "MUSIC COLLECTION"; }
  else if (path === "/character-design") { key = "character"; index = "CHARACTER DESIGN"; }
  else if (path === "/admin" || path === "/admin/login") { key = "admin"; index = "OWNER ACCESS"; }
  return { title: copy[key], index, opening: copy.opening, caption: copy.caption };
}

function TransitionCover({ phase, destination, locale, onCovered }) {
  const reduceMotion = useReducedMotion();
  const covered = useRef(false);
  const copy = destinationCopy(destination, locale);
  useDocumentScrollLock();

  return (
    <motion.div
      className="archive-transition"
      data-phase={phase}
      initial={phase === "leaving" && !reduceMotion ? "uncovered" : "covered"}
      animate="covered"
      exit="revealed"
      variants={{
        uncovered: { clipPath: "inset(0 0 100% 0)" },
        covered: { clipPath: "inset(0 0 0% 0)", transition: { duration: reduceMotion ? 0.01 : 0.46, ease: [0.76, 0, 0.24, 1] } },
        revealed: reduceMotion
          ? { opacity: 0, transition: { duration: 0.01 } }
          : { clipPath: "inset(100% 0 0 0)", transition: { duration: 0.58, ease: [0.76, 0, 0.24, 1] } },
      }}
      onAnimationComplete={(animation) => {
        if (animation === "covered" && phase === "leaving" && !covered.current) {
          covered.current = true;
          onCovered();
        }
      }}
    >
      <div className="archive-transition__grid" aria-hidden="true" />
      <div className="archive-transition__scan" aria-hidden="true" />
      <div className="archive-transition__brand" aria-hidden="true"><strong>PHRNONO</strong><span>VISUAL ARCHIVE</span></div>
      <span className="archive-transition__index" aria-hidden="true">{copy.index}</span>
      <div className="archive-transition__rail" aria-hidden="true"><i /></div>
      <div className="archive-transition__stage" aria-hidden="true">
        <span className="archive-transition__corner archive-transition__corner--first" />
        <span className="archive-transition__corner archive-transition__corner--last" />
        <div className="archive-transition__orbit"><i /><i /></div>
        <div className="archive-transition__identity">
          <img className="archive-transition__asset" src="/portfolio/asset-175.svg" alt="" />
          <div className="archive-transition__destination">
            <span>{copy.index}</span>
            <strong>{copy.title}</strong>
            <i />
            <small>{copy.caption}</small>
          </div>
        </div>
      </div>
      <div className="archive-transition__status"><span aria-hidden="true">+</span><span role="status" aria-live="polite">{copy.opening} · {copy.title}</span></div>
      <span className="archive-transition__signature" aria-hidden="true">PHRNONO / PERSONAL ARCHIVE</span>
    </motion.div>
  );
}

export default function RouteTransition({ phase, destination, locale, onCovered, onExitComplete }) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {phase !== "idle" && <TransitionCover key="archive-transition" phase={phase} destination={destination} locale={locale} onCovered={onCovered} />}
    </AnimatePresence>
  );
}
