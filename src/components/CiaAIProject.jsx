import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookmarkSimple, MagnifyingGlass, X, ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { ciaAIProjectCopy } from "../ciaAIProjectData";
import { ciaArchiveExperienceCopy } from "../ciaArchiveExperience";
import "./CiaAIProject.css";

const ArchiveScene = lazy(() => import("./CiaArchiveScene"));
const serial = (index) => "C-" + String(index + 1).padStart(3, "0");

class ArchiveSceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function CiaAIProject({ locale = "zh", openingEnabled = true }) {
  const copy = ciaAIProjectCopy[locale] ?? ciaAIProjectCopy.zh;
  const ui = ciaArchiveExperienceCopy[locale] ?? ciaArchiveExperienceCopy.zh;
  const [selected, setSelected] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [saved, setSaved] = useState([]);
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sceneState, setSceneState] = useState("loading");
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [quiet, setQuiet] = useState(false);
  const [boot, setBoot] = useState(true);
  const [replay, setReplay] = useState(0);
  const stageRef = useRef(null);
  const dialogRef = useRef(null);
  const accessRef = useRef(null);
  const detailTitleRef = useRef(null);
  const [inView, setInView] = useState(true);
  const reduced = systemReduced || quiet;
  const item = copy.capabilities[selected];
  const isSaved = saved.includes(selected);
  const sceneReady = useCallback(() => setSceneState("ready"), []);
  const sceneError = useCallback(() => setSceneState("error"), []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setSystemReduced(preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!window.IntersectionObserver) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!openingEnabled) return;
    if (reduced) { setBoot(false); return; }
    // Finite visual entrance, independent of loading. Never a fake task timer.
    setBoot(true);
    const timer = window.setTimeout(() => setBoot(false), 2800);
    return () => window.clearTimeout(timer);
  }, [openingEnabled, reduced, replay]);
  useEffect(() => {
    if (detailOpen) detailTitleRef.current?.focus({ preventScroll: true });
  }, [detailOpen]);

  const select = useCallback((index) => {
    setSelected(((index % 6) + 6) % 6);
    setTab("overview");
  }, []);
  const closeDetail = () => {
    setDetailOpen(false);
    requestAnimationFrame(() => accessRef.current?.focus({ preventScroll: true }));
  };
  const openIndex = (onlySaved = false) => {
    setSavedOnly(onlySaved);
    setQuery("");
    setDialogOpen(true);
    dialogRef.current?.showModal();
  };
  const closeIndex = () => dialogRef.current?.close();
  const toggleSaved = () => setSaved((current) => current.includes(selected) ? current.filter((id) => id !== selected) : [...current, selected]);
  const results = copy.capabilities.map((record, index) => ({ ...record, index })).filter((record) =>
    (!savedOnly || saved.includes(record.index)) && (serial(record.index) + " " + record.title + " " + record.key + " " + record.body).toLowerCase().includes(query.trim().toLowerCase()));

  function handleKey(event) {
    if (event.target.closest("input, textarea, [role=tablist], dialog") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") { if (boot) setBoot(false); else if (detailOpen) closeDetail(); return; }
    if (boot) return;
    if (event.target.closest(".cia-terminal__document")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); select(selected + 1); }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); select(selected - 1); }
    if (event.key === "/") { event.preventDefault(); openIndex(); }
    if (event.key === "Enter" && event.target === stageRef.current) { event.preventDefault(); setDetailOpen(true); }
  }

  return (
    <article className="cia-project" data-cia-context="work" data-motion={reduced ? "reduced" : "full"}>
      <section className={"cia-terminal" + (detailOpen ? " is-detail" : "") + (boot && openingEnabled ? " is-booting" : "") + (sceneState === "error" ? " scene-unavailable" : "")} ref={stageRef} tabIndex={0} aria-label={ui.archiveLabel} onKeyDown={handleKey}>
        <div className="cia-terminal__scene" aria-hidden="true">
          <ArchiveSceneBoundary onError={sceneError}><Suspense fallback={null}>
            <ArchiveScene selectedIndex={selected} detailOpen={detailOpen} reducedMotion={reduced} active={openingEnabled && inView && !dialogOpen} replayKey={replay} onSelect={select} onReady={sceneReady} onError={sceneError} />
          </Suspense></ArchiveSceneBoundary>
        </div>

        <header className="cia-terminal__top">
          <div className="cia-terminal__identity"><h1>CIA AI</h1><span>LOCAL WORKSPACE</span><p>CAPABILITY <b>ARCHIVE</b></p></div>
          <nav className="cia-terminal__nav" aria-label={ui.archiveLabel}>
            <button type="button" onClick={() => openIndex()}><MagnifyingGlass aria-hidden="true" /><span>{ui.search}</span><kbd>/</kbd></button>
            <button type="button" onClick={() => openIndex(true)}><BookmarkSimple aria-hidden="true" /><span>{ui.saved}</span><small>{String(saved.length).padStart(2, "0")}</small></button>
            <a href="#cia-project-about">{ui.about}<ArrowUpRight aria-hidden="true" /></a>
          </nav>
        </header>

        {detailOpen ? <>
          <button className="cia-terminal__return" type="button" onClick={closeDetail}><ArrowLeft aria-hidden="true" />{ui.back}<kbd>ESC</kbd></button>
          <div className="cia-terminal__object-caption" aria-hidden="true"><strong>{serial(selected)}</strong><span>CIA / LOCAL STUDIO</span></div>
          <section className="cia-terminal__document" aria-labelledby="cia-document-title" key={selected}>
            <div className="cia-terminal__file-line"><span>FILE {serial(selected)}</span><span>{ui.projectLabel}</span></div>
            <h2 ref={detailTitleRef} id="cia-document-title" tabIndex={-1}>{item.title}</h2>
            <p className="cia-terminal__document-key">{item.key}</p>
            <dl className="cia-terminal__metadata"><div><dt>{copy.platformLabel}</dt><dd>WINDOWS / LOCAL</dd></div><div><dt>{copy.formatLabel}</dt><dd>{copy.format}</dd></div></dl>
            <div className="cia-terminal__tabs" role="tablist" aria-label={item.title} onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              const names = ["overview", "example", "scope"];
              let next;
              if (event.key === "ArrowRight") next = (names.indexOf(tab) + 1) % 3;
              else if (event.key === "ArrowLeft") next = (names.indexOf(tab) + 2) % 3;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = 2;
              if (next !== undefined) { event.preventDefault(); setTab(names[next]); event.currentTarget.querySelectorAll("button")[next].focus(); }
            }}>
              {["overview", "example", "scope"].map((name, index) => <button key={name} role="tab" type="button" id={"cia-tab-" + name} aria-selected={tab === name} aria-controls="cia-document-panel" tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)}><small>0{index + 1}</small>{ui[name]}</button>)}
            </div>
            <div className="cia-terminal__reading" id="cia-document-panel" role="tabpanel" aria-labelledby={"cia-tab-" + tab} tabIndex={0} key={tab}>
              {tab === "overview" && <><p>{item.body}</p><small>{item.detail}</small></>}
              {tab === "example" && <><blockquote>{ui.examples[selected].prompt}</blockquote><p>{ui.examples[selected].body}</p></>}
              {tab === "scope" && <p>{ui.scopes[selected]}</p>}
            </div>
            <button className="cia-terminal__save" type="button" aria-pressed={isSaved} onClick={toggleSaved}><BookmarkSimple weight={isSaved ? "fill" : "regular"} aria-hidden="true" />{isSaved ? ui.unsave : ui.save}<span>{String(selected + 1).padStart(2, "0")} / 06</span></button>
          </section>
        </> : <section className="cia-terminal__selection" aria-labelledby="cia-selected-title">
          <p className="cia-terminal__file-line"><span>{ui.archiveLabel}</span><span>{item.key}</span></p>
          <button ref={accessRef} className="cia-terminal__file-number" type="button" onClick={() => setDetailOpen(true)}>FILE NUMBER: {serial(selected)}<ArrowUpRight aria-hidden="true" /></button>
          <div className="cia-terminal__selection-body" key={selected}><h2 id="cia-selected-title">{item.title}</h2><p>{item.detail}</p></div>
          <button className="cia-terminal__access" type="button" onClick={() => setDetailOpen(true)}>{ui.read}<ArrowRight aria-hidden="true" /></button>
        </section>}

        <div className="cia-terminal__bottom">
          <div className="cia-terminal__count"><span>ARCHIVE / SELECT</span><p>{String(selected + 1).padStart(2, "0")}<small>/ 06</small></p></div>
          <nav className="cia-terminal__selector" aria-label={ui.archiveLabel}>
            <button type="button" onClick={() => select(selected - 1)} aria-label={ui.previous}><ArrowLeft aria-hidden="true" /></button>
            <div className="cia-terminal__ticks">{copy.capabilities.map((record, index) => <button key={record.key} type="button" aria-label={serial(index) + " " + record.title} aria-pressed={index === selected} title={record.title} onClick={() => select(index)}><span aria-hidden="true" /></button>)}</div>
            <button type="button" onClick={() => select(selected + 1)} aria-label={ui.next}><ArrowRight aria-hidden="true" /></button>
          </nav>
          <a className="cia-terminal__character-link" href="/character-design#cia">CIA LUNELLE<span>{ui.character}</span><ArrowUpRight aria-hidden="true" /></a>
          <p className="cia-terminal__hint">{ui.keyboardHint}</p>
        </div>

        <div className="cia-terminal__motion-controls">
          <button type="button" onClick={() => { setDetailOpen(false); setReplay((value) => value + 1); }} disabled={reduced} title={ui.replay} aria-label={ui.replay}><ArrowCounterClockwise aria-hidden="true" /></button>
          <button type="button" aria-pressed={reduced} disabled={systemReduced} title={reduced ? ui.enableMotion : ui.reduceMotion} aria-label={reduced ? ui.enableMotion : ui.reduceMotion} onClick={() => setQuiet(!quiet)}>{reduced ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</button>
        </div>
        {sceneState !== "ready" && <p className="cia-terminal__scene-status" role="status">{sceneState === "error" ? ui.sceneUnavailable : ui.sceneLoading}</p>}

        {boot && openingEnabled && !reduced && <div className="cia-terminal__boot" key={replay}>
          <div className="cia-terminal__boot-sheets" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="cia-terminal__boot-identity"><img src="/characters/cia/avatar-cutout.png" alt="" width="90" height="90" /><span>PHRNONO / LOCAL STUDIO</span><strong>CIA LUNELLE</strong><p>{ui.welcome}</p></div>
          <button type="button" onClick={() => setBoot(false)}>{ui.skip}<ArrowRight aria-hidden="true" /></button>
        </div>}
      </section>

      <section className="cia-project__about" id="cia-project-about" aria-labelledby="cia-about-title">
        <div><a className="cia-project__back" href="/work#category-interactive"><ArrowLeft aria-hidden="true" />{copy.back}</a><p className="cia-project__eyebrow">PHRNONO / INTERACTION DESIGN</p><h2 id="cia-about-title">{copy.subtitle}</h2><p>{copy.intro}</p></div>
        <dl>{[[copy.formatLabel, copy.format], [copy.platformLabel, copy.platform], [copy.foundationLabel, copy.foundation]].map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>
        <div className="cia-project__design"><h3>{copy.focusTitle}</h3><p>{copy.focusBody}</p></div>
        <div className="cia-project__character"><img src="/characters/cia/avatar-cutout.png" alt="" width="72" height="72" loading="lazy" /><div><h3>{copy.characterTitle}</h3><p>{copy.characterBody}</p><a href="/character-design#cia">{copy.characterCta}<ArrowUpRight aria-hidden="true" /></a></div></div>
        <aside className="cia-project__scope"><h3>{copy.limitationsTitle}</h3><p>{copy.limitations}</p></aside>
        <div className="cia-project__credits"><span>{ui.referenceCredit}: <a href="https://github.com/LBEILC/RhineLabUI" target="_blank" rel="noreferrer">LBEILC / RhineLabUI<ArrowUpRight aria-hidden="true" /></a> · <a href="/portfolio/cia-archive/LICENSE.txt" target="_blank" rel="noreferrer">MIT</a></span><span>{copy.closing}</span></div>
      </section>

      <dialog className="cia-archive-index" ref={dialogRef} aria-labelledby="cia-index-title" onClose={() => setDialogOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) closeIndex(); }}>
        <div className="cia-archive-index__inner"><header><div><span>CIA / CAPABILITY ARCHIVE</span><h2 id="cia-index-title">{savedOnly ? ui.saved : ui.search}</h2></div><button type="button" aria-label={ui.close} onClick={closeIndex}><X aria-hidden="true" /></button></header>
          <label className="cia-archive-index__search"><MagnifyingGlass aria-hidden="true" /><span className="sr-only">{ui.search}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui.searchPlaceholder} /></label>
          <div className="cia-archive-index__filters"><button type="button" aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)}>{ui.allFiles} / 06</button><button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(true)}>{ui.saved} / {saved.length}</button></div>
          <div className="cia-archive-index__results">{results.length ? results.map((record) => <button type="button" key={record.key} onClick={() => { select(record.index); setDetailOpen(true); closeIndex(); }}><span>{serial(record.index)}</span><strong>{record.title}</strong><small>{record.key}</small><ArrowUpRight aria-hidden="true" /></button>) : <p>{savedOnly && !saved.length ? ui.savedEmpty : ui.searchEmpty}</p>}</div>
        </div>
      </dialog>
    </article>
  );
}
