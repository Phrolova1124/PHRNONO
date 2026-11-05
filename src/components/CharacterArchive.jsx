import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Diamond, Feather, FilmStrip, IdentificationCard, ImagesSquare, Planet, Play, X } from "@phosphor-icons/react";
import { characterIds, ciaAssets, getCharacters } from "../characterData";
import { getCiaStory } from "../ciaStory";
import { characterTabIds, characterViewFromSearch, characterViewUrl } from "../characterNavigation";
import useDocumentScrollLock from "./useDocumentScrollLock";
import LineSidebar from "./LineSidebar";
import "./CharacterArchive.css";

const ui = {
  zh: {
    title: "角色档案", choose: "选择角色，展开她的世界。", back: "角色选择", work: "返回作品", open: "进入档案", tabs: ["概览", "能力档案", "设定图", "影像", "故事"],
    sheet: "查看完整图片", profile: "角色资料", palette: "角色配色", play: "播放像素动画", pause: "暂停动画", replay: "重播入场", skip: "跳过入场", entry: ["锁定角色档案", "展开角色形象", "角色档案就绪"], close: "关闭图片", videoError: "动画暂时无法加载，可先查看设定图。", opening: "角色入场", sheets: "立绘与设计稿", story: "角色故事", chapter: "选择篇章", previous: "上一章", next: "下一章", edited: "作者设定 · 整理版，含完整剧情与结局", ability: "设定展开", network: "关联档案", records: "已阅资料", readHint: "点击分段条或圆形节点查看内容；进度仅表示本次阅读。", original: "原创角色", illustration: "2D 立绘展示", collection: "图集", photoHint: "选择画面，查看原立绘。", standard: "标准比例", mini: "迷你比例", heads: "头身",
  },
  en: {
    title: "Character archive", choose: "Choose a character. Step into her world.", back: "Characters", work: "Back to work", open: "Open archive", tabs: ["Overview", "Abilities", "Design", "Visuals", "Story"],
    sheet: "View full image", profile: "Character profile", palette: "Character palette", play: "Play pixel animation", pause: "Pause animation", replay: "Replay entrance", skip: "Skip entrance", entry: ["Character selected", "Unfolding the portrait", "Character archive ready"], close: "Close image", videoError: "Animation is unavailable. The design sheets are still available.", opening: "Character entrance", sheets: "Illustrations & design sheets", story: "Character story", chapter: "Select a chapter", previous: "Previous", next: "Next", edited: "Author’s canon · Edited edition, including the ending", ability: "Expanded records", network: "Related records", records: "Records read", readHint: "Select a segmented rail or a circular node. Progress tracks this reading session only.", original: "Original character", illustration: "2D illustration", collection: "Gallery", photoHint: "Choose a scene to view the original illustration.", standard: "Standard proportions", mini: "Mini proportions", heads: "heads",
  },
  ja: {
    title: "キャラクター図鑑", choose: "キャラクターを選び、彼女の世界へ。", back: "キャラクター", work: "作品に戻る", open: "図鑑を開く", tabs: ["概要", "能力資料", "設定画", "ビジュアル", "物語"],
    sheet: "画像を全体表示", profile: "キャラクター情報", palette: "カラーパレット", play: "アニメーションを再生", pause: "一時停止", replay: "登場演出をもう一度", skip: "スキップ", entry: ["キャラクターを選択", "イラストを展開中", "キャラクター資料の準備完了"], close: "画像を閉じる", videoError: "アニメーションを読み込めません。設定画をご覧ください。", opening: "登場演出", sheets: "イラストと設定画", story: "キャラクターの物語", chapter: "章を選択", previous: "前の章", next: "次の章", edited: "作者の設定・編集版（結末を含む）", ability: "設定展開", network: "関連資料", records: "閲覧済み資料", readHint: "分割バーや丸いノードを選んでください。進捗は今回の閲覧のみを示します。", original: "オリジナルキャラクター", illustration: "2D イラスト展示", collection: "ギャラリー", photoHint: "場面を選び、元のイラストをご覧ください。", standard: "標準比率", mini: "ミニ比率", heads: "頭身",
  },
};
const tabIds = characterTabIds;
const tabIcons = [IdentificationCard, Diamond, ImagesSquare, FilmStrip, BookOpen];
const nodeIcons = [Diamond, Feather, Planet, BookOpen];
export const selectedCharacterFromHash = hash => characterIds.includes(hash.slice(1)) ? hash.slice(1) : null;
const selectedFromUrl = () => typeof window === "undefined" ? null : selectedCharacterFromHash(window.location.hash);

function CharacterEntrance({ character, copy, onDone }) {
  const reduceMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const [phase, setPhase] = useState(0);
  const skip = useRef(null);
  const done = useRef(false);
  const finish = useCallback(() => { if (isPresent && !done.current) { done.current = true; onDone(); } }, [isPresent, onDone]);
  useDocumentScrollLock();
  useEffect(() => {
    if (!isPresent) return undefined;
    done.current = false; skip.current?.focus({ preventScroll: true });
    const timers = reduceMotion ? [setTimeout(finish, 30)] : [setTimeout(() => setPhase(1), 650), setTimeout(() => setPhase(2), 1900), setTimeout(finish, 3400)];
    return () => timers.forEach(clearTimeout);
  }, [finish, isPresent, reduceMotion]);
  return <motion.section className={`character-entrance character-entrance--${character.id}`} data-phase={phase} role="dialog" aria-modal="true" aria-label={copy.opening}
    initial={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }} transition={{ duration: reduceMotion ? 0.01 : 0.55, ease: [0.76, 0, 0.24, 1] }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); finish(); } if (event.key === "Tab") { event.preventDefault(); skip.current?.focus(); } }}>
    <div className="character-entrance__diagonal" aria-hidden="true" /><div className="character-entrance__scan" aria-hidden="true" />
    <span className="character-entrance__brand" aria-hidden="true">PHRNONO / CHARACTER ARCHIVE — {character.number}</span>
    <div className="character-entrance__portrait" aria-hidden="true"><img src={character.portrait} alt="" /></div>
    <div className="character-entrance__name" aria-hidden="true"><span>{character.role}</span><strong>{character.englishName}</strong><small>{character.name}</small>{character.coverQuote && <blockquote className="character-entrance__quote">“{character.coverQuote}”</blockquote>}</div>
    <div className="character-entrance__status" role="status">{copy.entry[phase]}</div>
    <button ref={skip} onClick={finish} className="character-entrance__skip" type="button">{copy.skip}<ArrowUpRight size={20} /></button>
  </motion.section>;
}

function DesignSheet({ image, copy, onClose }) {
  const close = useRef(null); useDocumentScrollLock();
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
  return <div className="character-sheet" role="dialog" aria-modal="true" aria-label={image.label}
    onKeyDown={event => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { event.preventDefault(); close.current?.focus(); } }}>
    <button ref={close} onClick={onClose} type="button"><X size={22} />{copy.close}</button><img src={image.src} alt={image.label} />
  </div>;
}

function AbilityBoard({ character, copy, activeRecord, onRecord, viewed }) {
  const frame = useRef(null);
  const surface = useRef(null);
  useLayoutEffect(() => {
    const viewport = frame.current?.closest('.character-record__panel');
    const scene = viewport?.closest('.character-record');
    if (!viewport || !scene || !surface.current) return;
    const desktop = window.matchMedia('(min-width: 701px)');
    const fit = () => {
      if (!desktop.matches) {
        frame.current.style.removeProperty('--ability-frame-height');
        surface.current.style.removeProperty('--ability-scale');
        scene.style.removeProperty('--ability-background-x');
        return;
      }
      // Measure the untransformed content, including the current description.
      // Reserve its complete rotated bounds instead of clipping its lower edge.
      const element = surface.current;
      const signedAngle = parseFloat(getComputedStyle(element).getPropertyValue('--ability-angle')) * Math.PI / 180;
      const angle = Math.abs(signedAngle);
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const rotatedWidth = width * Math.cos(angle) + height * Math.sin(angle);
      const rotatedHeight = height * Math.cos(angle) + width * Math.sin(angle);
      const widthScale = (viewport.clientWidth - 24) / rotatedWidth;
      const heightScale = (viewport.clientHeight - 32) / rotatedHeight;
      // Keep long text readable: below this modest reduction, scroll only the
      // bounded archive panel. Never shrink the whole page or discard content.
      const scale = Math.min(1, widthScale, Math.max(.86, heightScale));
      const frameHeight = Math.ceil(Math.max(viewport.clientHeight, rotatedHeight * scale + 32));
      element.style.setProperty('--ability-scale', String(Math.max(.1, scale)));
      frame.current.style.setProperty('--ability-frame-height', `${frameHeight}px`);
      // Project the surface's left edge into scene coordinates. The backdrop
      // stays outside the scroll viewport, so its diagonal cannot be cut into
      // a vertical edge by that viewport. Its 24px inset matches the diagram.
      const backdropX = viewport.offsetLeft + viewport.clientWidth / 2
        - (width / 2 + 24) * scale / Math.cos(angle)
        - Math.tan(signedAngle) * (scene.clientHeight / 2 - viewport.offsetTop - frameHeight / 2);
      scene.style.setProperty('--ability-background-x', `${backdropX}px`);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    observer.observe(surface.current);
    desktop.addEventListener('change', fit);
    fit();
    return () => { observer.disconnect(); desktop.removeEventListener('change', fit); scene.style.removeProperty('--ability-background-x'); };
  }, []);
  const nodes = character.nodes || character.facts.map(([title, body]) => ({ title, body, image: character.portrait }));
  const total = character.facts.length + nodes.length;
  const detail = activeRecord.kind === "fact" ? { title: character.facts[activeRecord.index][0], body: character.facts[activeRecord.index][1] } : nodes[activeRecord.index];
  return <div ref={frame} className="character-ability">
    <div ref={surface} className="character-ability__surface">
    <div className="character-ability__plane">
      <div className="character-ability__identity"><h2>{character.englishName}</h2><span>{character.name}</span></div>
      <h3><Diamond size={25} weight="fill" />{copy.ability}</h3>
      <div className="character-ability__rails">{character.facts.map(([label], index) => <button type="button" key={label} aria-pressed={activeRecord.kind === "fact" && activeRecord.index === index} onClick={() => onRecord("fact", index)}>
        <span className="character-ability__rail-icon">{String(index + 1).padStart(2, "0")}</span><span className="character-ability__rail-label">{label}</span>
        <span className="character-ability__segments" aria-hidden="true">{Array.from({ length: 9 }, (_, segment) => <i key={segment} style={{ "--segment": segment }} />)}</span>
        <Check size={18} aria-hidden="true" style={{ opacity: viewed.includes(`fact-${index}`) ? 1 : 0.2 }} />
      </button>)}</div>
      <div className="character-ability__network-label">{copy.network}<span>PHR / {character.number}</span></div>
      <div className="character-ability__network" style={{ "--node-count": nodes.length }}>
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><path d="M65 50 H300 V90 H535 M65 50 V100 H185 M300 90 V25 H445" /></svg>
        {nodes.map((node, index) => { const Icon = nodeIcons[index % nodeIcons.length]; return <button type="button" key={node.title} className={`character-ability__node character-ability__node--${index}`} aria-pressed={activeRecord.kind === "node" && activeRecord.index === index} onClick={() => onRecord("node", index)}><span><Icon size={28} weight="fill" /></span><strong>{node.title}</strong>{viewed.includes(`node-${index}`) && <Check className="character-ability__node-check" size={14} aria-hidden="true" />}</button>; })}
      </div>
      <div className="character-ability__progress"><div><span>{copy.records}</span><strong>{viewed.length}<small>/{total}</small></strong></div><div className="character-ability__progress-rail" role="progressbar" aria-label={copy.records} aria-valuemin={0} aria-valuemax={total} aria-valuenow={viewed.length}><span style={{ transform: `scaleX(${viewed.length / total})` }} /></div></div>
    </div>
    <div className="character-ability__detail" key={`${activeRecord.kind}-${activeRecord.index}`} aria-live="polite"><strong>{detail.title}</strong><p>{detail.body}</p></div><p className="character-ability__hint">{copy.readHint}</p>
    </div>
  </div>;
}

// One keyed chapter stays in normal flow. Exit finishes before the next
// chapter mounts; only whole text blocks move, never individual characters.
function StoryChapter({ story, index, locale, reduceMotion, onReveal }) {
  const heading = useRef(null);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  useLayoutEffect(() => { reveal.current(index, locale, heading.current); }, [index, locale]);
  const textMotion = {
    hidden: { opacity: 0, y: 16 },
    visible: order => ({ opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : .46, delay: reduceMotion ? 0 : Math.min(order, 6) * .12, ease: [.22, 1, .36, 1] } }),
  };
  return <motion.article className="character-story__chapter" data-chapter={index} initial={reduceMotion ? false : "hidden"} animate="visible" exit={{ opacity: 0, y: reduceMotion ? 0 : -10, transition: { duration: reduceMotion ? 0 : .18 } }}>
    <motion.h2 ref={heading} tabIndex="-1" variants={textMotion} custom={0}>{story.title}</motion.h2>
    {story.body.map((paragraph, paragraphIndex) => <motion.p key={paragraphIndex} variants={textMotion} custom={paragraphIndex + 1}>{paragraph}</motion.p>)}
  </motion.article>;
}

function CharacterRecord({ character, copy, locale, detailHeading, onFullImage, sheetOpener }) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState(() => typeof window === "undefined" ? "overview" : characterViewFromSearch(window.location.search)); const [sheet, setSheet] = useState(0); const [chapter, setChapter] = useState(0);
  const [playing, setPlaying] = useState(false); const [videoError, setVideoError] = useState(false);
  const [activeRecord, setActiveRecord] = useState({ kind: "fact", index: 0 }); const [viewed, setViewed] = useState([]);
  const video = useRef(null); const panel = useRef(null); const storyViewport = useRef(null);
  const chapterNavigation = useRef(null); const currentStory = useRef(null);
  currentStory.current = { view, chapter, locale };
  const stories = character.id === "cia" ? getCiaStory(locale) : character.story;
  const selectedImage = character.gallery[sheet];
  const abilityImage = activeRecord.kind === "node" ? character.nodes?.[activeRecord.index].image : null;
  const stageSrc = view === "design" || (view === "visuals" && !character.video) ? selectedImage.src : view === "abilities" ? abilityImage || character.portrait : view === "story" && character.id === "cia" && chapter === 11 ? ciaAssets.journey : character.portrait;
  const stageLabel = character.gallery.find(image => image.src === stageSrc)?.label || character.name;
  const selectView = next => {
    setView(next);
    window.history.replaceState(window.history.state, "", characterViewUrl(window.location, next));
  };
  useEffect(() => {
    const restoreView = () => {
      if (selectedCharacterFromHash(window.location.hash) === character.id) setView(characterViewFromSearch(window.location.search));
    };
    window.addEventListener("popstate", restoreView);
    window.addEventListener("hashchange", restoreView);
    return () => { window.removeEventListener("popstate", restoreView); window.removeEventListener("hashchange", restoreView); };
  }, [character.id]);
  useEffect(() => { if (view !== "visuals") { video.current?.pause(); setPlaying(false); } }, [view]);
  useEffect(() => { panel.current?.scrollTo({ top: 0 }); }, [view]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("phrnono:cia-context", { detail: { key: view === "story" ? "character-story" : "character" } })));
    return () => window.cancelAnimationFrame(frame);
  }, [character.id, view]);
  useLayoutEffect(() => { chapterNavigation.current = null; }, [view, locale]);
  useEffect(() => { if (view === "abilities") setViewed(items => items.includes("fact-0") ? items : [...items, "fact-0"]); }, [view]);
  const record = (kind, index) => { setActiveRecord({ kind, index }); setViewed(items => items.includes(`${kind}-${index}`) ? items : [...items, `${kind}-${index}`]); };
  const toggleVideo = async () => { if (!video.current) return; if (playing) video.current.pause(); else { try { await video.current.play(); } catch { setVideoError(true); } } };
  const changeChapter = (index, focusHeading = true) => {
    if (index === chapter || index < 0 || index >= stories.length) return;
    chapterNavigation.current = { index, locale, focusHeading };
    setChapter(index);
  };
  const revealChapter = (index, chapterLocale, heading) => {
    const requested = chapterNavigation.current;
    const current = currentStory.current;
    if (!requested || current.view !== "story" || current.chapter !== index || current.locale !== chapterLocale || requested.index !== index || requested.locale !== chapterLocale) return;
    chapterNavigation.current = null;
    if (window.matchMedia("(max-width: 700px)").matches) {
      // Mobile scrolls the document, not the desktop's bounded reading panel.
      // Keep the new chapter below the fixed site header, not at the page top.
      const viewport = heading?.closest(".character-story__viewport");
      if (requested.focusHeading && viewport?.isConnected) window.scrollTo({ top: Math.max(0, window.scrollY + viewport.getBoundingClientRect().top - 82), behavior: "instant" });
    } else panel.current?.scrollTo({ top: 0, behavior: "instant" });
    if (requested.focusHeading) heading?.focus({ preventScroll: true });
  };
  return <div className={`character-record character-record--${character.id}`} data-view={view} data-cia-context="character">
    <div className="character-record__floor" aria-hidden="true" /><div className="character-record__accent" aria-hidden="true" /><div className="character-record__watermark" aria-hidden="true">{character.englishName}</div>
    <div className="character-record__identity"><span>PHR / {character.number} — {copy.original}</span><h1 ref={detailHeading} tabIndex="-1">{character.englishName}</h1><p className="character-record__native-name">{character.name}</p><p className="character-record__role">{character.role}</p><p className="character-record__tagline">「{character.quote}」</p><div className="character-record__swatches" aria-label={copy.palette}>{character.palette.map(color => <i key={color} style={{ background: color }} />)}</div></div>
    <div className="character-record__stage">
      <div className="character-record__ground" aria-hidden="true" />
      {!(view === "visuals" && character.video) && <AnimatePresence initial={false} mode="sync"><motion.div className={`character-record__figure${view === "design" ? " character-record__figure--sheet" : ""}`} key={stageSrc} initial={reduceMotion ? false : { opacity: 0, x: 40, scale: 1.035 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .65 }}><img src={stageSrc} alt={stageLabel} fetchPriority="high" /></motion.div></AnimatePresence>}
      {view === "visuals" && character.video && <div className="character-record__motion"><video ref={video} src={character.video} poster={character.poster} aria-label={character.animationCaption} muted loop playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setVideoError(true)} /><button type="button" onClick={toggleVideo}>{playing ? copy.pause : copy.play}<Play size={18} /></button>{videoError && <p role="status">{copy.videoError}</p>}</div>}
      <span className="character-record__stage-caption">{copy.illustration} / PHRNONO</span>
    </div>
    <div ref={panel} className={`character-record__panel${view === "abilities" ? " character-record__panel--abilities" : ""}`} id="character-view-panel" role="tabpanel" aria-labelledby={`character-tab-${view}`} tabIndex={0}>
      <AnimatePresence mode="wait" initial={false}><motion.div key={`${view}-${locale}`} initial={reduceMotion ? false : view === "story" ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 36, y: 15 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -15 }} transition={{ duration: reduceMotion ? 0 : .38 }}>
        {view === "overview" && <><span className="character-record__eyebrow">{copy.profile}</span><h2>{character.medium}</h2>{character.id === "lumina" ? <dl className="character-record__metrics"><div><dt>{copy.standard}</dt><dd>3.5–4 <small>{copy.heads}</small></dd></div><div><dt>{copy.mini}</dt><dd>2 <small>{copy.heads}</small></dd></div></dl> : <div className="character-record__summary"><span>LUNARIUM</span><p>{character.facts[0][1]}</p></div>}<p>{character.id === "lumina" ? character.story[0].body[0] : character.facts[2][1]}</p><button className="character-record__sheet-open" type="button" onClick={() => { selectView("abilities"); document.getElementById("character-tab-abilities")?.focus(); }}>{copy.tabs[1]}<ArrowUpRight size={20} /></button></>}
        {view === "abilities" && <AbilityBoard character={character} copy={copy} activeRecord={activeRecord} onRecord={record} viewed={viewed} />}
        {view === "design" && <><span className="character-record__eyebrow">{copy.sheets} / {String(character.gallery.length).padStart(2, "0")}</span><h2>{selectedImage.label}</h2><div className="character-record__gallery">{character.gallery.map((image, index) => <button type="button" key={image.src} aria-label={image.label} aria-pressed={sheet === index} onClick={() => setSheet(index)}><img src={image.src} alt="" loading="lazy" /><span>{String(index + 1).padStart(2, "0")}</span></button>)}</div><p>{character.facts[1][1]}</p><button ref={sheetOpener} className="character-record__sheet-open" type="button" onClick={() => onFullImage(selectedImage)}>{copy.sheet}<ArrowUpRight size={20} /></button></>}
        {view === "visuals" && <><span className="character-record__eyebrow">{character.video ? "PIXEL ANIMATION" : copy.collection}</span><h2>{character.video ? copy.tabs[3] : selectedImage.label}</h2><p>{character.video ? character.facts[3][1] : copy.photoHint}</p>{character.video ? <p>{character.animationCaption}</p> : <><div className="character-record__visual-options">{character.gallery.map((image, index) => <button type="button" key={image.src} aria-pressed={sheet === index} onClick={() => setSheet(index)}>{String(index + 1).padStart(2, "0")}<span>{image.label}</span></button>)}</div><button ref={sheetOpener} className="character-record__sheet-open" type="button" onClick={() => onFullImage(selectedImage)}>{copy.sheet}<ArrowUpRight size={20} /></button></>}</>}
        {view === "story" && <div className="character-story" data-cia-context={character.id === "cia" ? "character-story" : undefined}><div className="character-story__header"><span className="character-record__eyebrow">{copy.story} / {String(chapter + 1).padStart(2, "0")}—{String(stories.length).padStart(2, "0")}</span>{stories.length > 1 && <><p className="character-story__note">{copy.edited}</p><label className="sr-only" htmlFor="character-chapter">{copy.chapter}</label><select id="character-chapter" value={chapter} onChange={event => changeChapter(Number(event.target.value), false)}>{stories.map((item, index) => <option key={item.title} value={index}>{item.title}</option>)}</select></>}</div>{stories.length > 1 && <LineSidebar className="character-story__sidebar" items={stories.map(item => item.title)} activeIndex={chapter} accentColor="#425000" textColor="#68705f" markerColor="#9aa18f" showIndex showMarker proximityRadius={100} maxShift={16} falloff="smooth" markerLength={46} markerGap={0} tickScale={0.5} scaleTick itemGap={11} fontSize={0.72} smoothing={100} onItemClick={index => changeChapter(index)} ariaLabel={copy.chapter} />}<div ref={storyViewport} className="character-story__viewport"><AnimatePresence mode="wait"><StoryChapter key={`${locale}-${chapter}`} story={stories[chapter]} index={chapter} locale={locale} reduceMotion={reduceMotion} onReveal={revealChapter} /></AnimatePresence></div>{stories.length > 1 && <nav className="character-story__navigation" aria-label={copy.chapter}><button type="button" disabled={chapter === 0} onClick={() => changeChapter(chapter - 1)}><ArrowLeft size={18} />{copy.previous}</button><span>{chapter + 1} / {stories.length}</span><button type="button" disabled={chapter === stories.length - 1} onClick={() => changeChapter(chapter + 1)}>{copy.next}<ArrowRight size={18} /></button></nav>}</div>}
      </motion.div></AnimatePresence>
    </div>
    <div className="character-record__tabs" role="tablist" aria-label={copy.profile} aria-orientation="vertical" onKeyDown={event => {
      const current = tabIds.indexOf(view); let next = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % tabIds.length;
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (current + tabIds.length - 1) % tabIds.length;
      if (event.key === "Home") next = 0; if (event.key === "End") next = tabIds.length - 1;
      if (next !== null) { event.preventDefault(); selectView(tabIds[next]); document.getElementById(`character-tab-${tabIds[next]}`)?.focus(); }
    }}>{tabIds.map((id, index) => { const Icon = tabIcons[index]; return <button type="button" role="tab" key={id} id={`character-tab-${id}`} aria-controls="character-view-panel" aria-selected={view === id} tabIndex={view === id ? 0 : -1} onClick={() => selectView(id)}><Icon size={24} weight={view === id ? "fill" : "regular"} /><span>{copy.tabs[index]}</span></button>; })}</div>
  </div>;
}

export default function CharacterArchive({ copy: siteCopy, locale = "zh", openingEnabled = true, onEntryBlockingChange }) {
  const copy = ui[locale] || ui.zh;
  const characters = getCharacters(locale, siteCopy.characterFeature);
  const [selected, setSelected] = useState(selectedFromUrl); const [entering, setEntering] = useState(() => Boolean(selectedFromUrl())); const [fullImage, setFullImage] = useState(null);
  const selector = useRef(null); const detailHeading = useRef(null); const sheetOpener = useRef(null); const navigationFocus = useRef(false);
  const activeOverlay = useRef(false);
  activeOverlay.current = Boolean((entering && openingEnabled && selected) || fullImage);
  const finishEntry = useCallback(() => setEntering(false), []);
  const releaseEntry = useCallback(() => { if (activeOverlay.current) return; onEntryBlockingChange?.(false); requestAnimationFrame(() => (detailHeading.current || selector.current)?.focus({ preventScroll: true })); }, [onEntryBlockingChange]);
  useEffect(() => { if ((entering && openingEnabled) || fullImage) onEntryBlockingChange?.(true); }, [entering, openingEnabled, selected, fullImage, onEntryBlockingChange]);
  useEffect(() => () => onEntryBlockingChange?.(false), [onEntryBlockingChange]);
  useEffect(() => {
    const restore = () => { const next = selectedFromUrl(); setSelected(next); setEntering(Boolean(next)); setFullImage(null); if (!next) { if (fullImage) onEntryBlockingChange?.(false); navigationFocus.current = true; } };
    window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [fullImage, onEntryBlockingChange]);
  useEffect(() => { if (!selected && navigationFocus.current) { selector.current?.focus({ preventScroll: true }); navigationFocus.current = false; } }, [selected]);
  const choose = id => { if (id === selected) return; window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#${id}`); setSelected(id); setEntering(true); setFullImage(null); window.scrollTo({ top: 0 }); };
  const back = () => { window.history.pushState({}, "", `${window.location.pathname}${window.location.search}`); navigationFocus.current = true; setSelected(null); setEntering(false); setFullImage(null); };
  const closeImage = () => { setFullImage(null); onEntryBlockingChange?.(false); requestAnimationFrame(() => sheetOpener.current?.focus({ preventScroll: true })); };
  const character = selected ? characters[selected] : null;
  return <section className={`character-archive${selected ? " character-archive--detail" : ""}`} aria-label={copy.title}>
    {!selected ? <div className="character-roster"><div className="character-roster__heading"><div><span>PHRNONO / CHARACTER DESIGN</span><h1>{copy.title}</h1><p>{copy.choose}</p></div><a href="/work"><ArrowLeft size={19} />{copy.work}</a></div>
      <div className="character-roster__list">{characterIds.map((id, index) => { const item = characters[id]; return <button ref={index === 0 ? selector : undefined} className={`character-roster__card character-roster__card--${id}`} type="button" key={id} onClick={() => choose(id)} aria-label={`${copy.open}: ${item.name}`}><div className="character-roster__art"><span className="character-roster__watermark" aria-hidden="true">{item.englishName}</span><img src={item.portrait} alt={item.name} fetchPriority="high" /><span className="character-roster__number" aria-hidden="true">{item.number}</span></div><div className="character-roster__caption"><div><small>{item.role}</small><strong>{item.englishName}</strong><span>{item.name}</span></div><span className="character-roster__enter">{copy.open}<ArrowUpRight size={26} /></span></div></button>; })}</div>
    </div> : <>
      <div className="character-archive__toolbar"><button type="button" onClick={back}><ArrowLeft size={20} />{copy.back}</button><div className="character-archive__roster-strip" aria-label={copy.title}>{characterIds.map(id => <button type="button" key={id} aria-label={characters[id].name} aria-pressed={selected === id} className={`character-archive__portrait-button character-archive__portrait-button--${id}${selected === id ? " is-active" : ""}`} onClick={() => choose(id)}><span><img src={characters[id].avatar} alt="" /></span><strong>{characters[id].englishName}</strong>{selected === id && <Check size={14} aria-hidden="true" />}</button>)}</div><button className="character-archive__replay" type="button" onClick={() => setEntering(true)}>{copy.replay}<Play size={17} /></button></div>
      <CharacterRecord key={selected} character={character} copy={copy} locale={locale} detailHeading={detailHeading} sheetOpener={sheetOpener} onFullImage={setFullImage} />
    </>}
    {typeof document !== "undefined" && createPortal(<AnimatePresence onExitComplete={releaseEntry}>{entering && openingEnabled && character && <CharacterEntrance key={selected} character={character} copy={copy} onDone={finishEntry} />}</AnimatePresence>, document.body)}
    {fullImage && createPortal(<DesignSheet image={fullImage} copy={copy} onClose={closeImage} />, document.body)}
  </section>;
}
