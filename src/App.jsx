import { useCallback, useEffect, useRef, useState } from "react";
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
import LineSidebar from "./components/LineSidebar";
import ScrollExpand from "./components/ScrollExpand";
import ShapeGrid from "./components/ShapeGrid";
import { localeOptions, translations } from "./i18n";
import {
  caseStudies,
  detailProjectOrder,
  detailProjects,
  projects,
} from "./projectData";

const profileUrl = "https://www.artstation.com/phrolova";
const routeTransitionStorageKey = "phrnono-route-transition";
let siteAudioContext;

function getInitialLocale() {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem("phrolova-locale");
  return localeOptions.some((option) => option.code === saved) ? saved : "zh";
}

function getInitialIntroVisible() {
  if (typeof window === "undefined") return true;
  return window.sessionStorage.getItem("phrolova-intro-seen") !== "true";
}

function getInitialSoundEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("phrolova-sound-enabled") === "true";
}

function getInitialRouteTransitionPhase() {
  if (typeof window === "undefined") return "idle";
  try {
    if (window.sessionStorage.getItem(routeTransitionStorageKey) === "arriving") {
      return "arriving";
    }
  } catch {
    return "idle";
  }
  return "idle";
}

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { kind: "home", path };
  if (path === "/work") return { kind: "work", path };
  if (path === "/character-design") return { kind: "character", path };
  if (path.startsWith("/work/")) {
    const slug = path.slice("/work/".length);
    if (detailProjects[slug]) return { kind: "detail", path, slug, project: detailProjects[slug] };
  }
  return { kind: "notFound", path };
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

function IntroSequence({ copy, onDone }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onDone, reduceMotion ? 80 : 1650);
    return () => window.clearTimeout(timer);
  }, [onDone, reduceMotion]);

  return (
    <motion.div
      className="intro-sequence"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.35 }}
      aria-hidden="true"
    >
      <div className="intro-strips">
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.span
            key={index}
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              delay: reduceMotion ? 0 : index * 0.08,
              duration: reduceMotion ? 0.01 : 0.48,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      </div>
      <motion.div
        className="intro-lockup"
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.42, duration: reduceMotion ? 0.01 : 0.5 }}
      >
        <span>PHRNONO</span>
        <small>{copy.intro}</small>
      </motion.div>
    </motion.div>
  );
}

function RouteTransition({ phase, onCovered, onExitComplete }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {phase !== "idle" && (
        <motion.div
          key="route-transition"
          className="route-transition"
          initial={phase === "leaving" && !reduceMotion ? { y: "100%" } : { y: 0 }}
          animate={{ y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { y: "-100%" }}
          transition={{ duration: reduceMotion ? 0.01 : 0.46, ease: [0.76, 0, 0.24, 1] }}
          onAnimationComplete={() => {
            if (phase === "leaving") onCovered();
          }}
          aria-hidden="true"
        >
          <span>PHRNONO</span>
          <small>PORTFOLIO</small>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({ copy, locale, setLocale, workActive, soundEnabled, onSoundToggle }) {
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
        PHRNONO
        <span>PORTFOLIO</span>
      </a>

      <div className="desktop-header-tools">
        <nav className="desktop-nav" aria-label={copy.navLabel}>
          <a href="/work" aria-current={workActive ? "page" : undefined}>{copy.navWork}</a>
          <a href="/#about">{copy.navAbout}</a>
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
            <a ref={firstMobileLinkRef} href="/work" onClick={closeMenu}>{copy.navWork}</a>
            <a href="/#about" onClick={closeMenu}>{copy.navAbout}</a>
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
    <section className="hero" id="top">
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
        <p className="hero-kicker">3D / PIXEL / VISUAL DESIGN</p>
        <h1 aria-label="PHRNONO">
          <span>PHR</span><span className="hero-title-accent">NONO</span>
        </h1>
        <p className="hero-summary">{copy.heroSummary}</p>
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
        <div className="hero-visual-copy" aria-hidden="true">
          <span>PORTFOLIO / 2026</span>
          <strong>3D<br />PIXEL<br />VISUAL</strong>
          <small>PHRNONO / DIGITAL PRACTICE</small>
        </div>
        <img
          className="hero-mascot"
          src="/portfolio/profile-mascot.webp"
          alt={copy.mascotAlt}
          width="620"
          height="637"
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
  const galleryItems = projects.map((project) => ({
    image: project.image,
    label: `${project.title} / ${copy.projectDisciplines[project.id]}`,
    link: project.localUrl ?? project.artstationUrl,
    external: !project.localUrl,
    alt: copy.projectAlts[project.id],
  }));

  return (
    <section className="work-section" id="work">
      <div className="section-heading">
        <h1>SELECTED<br />WORK</h1>
        <p>{copy.workDescription}</p>
      </div>

      <div className="work-gallery-wrap">
        <AccordionGallery
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
        />
      </div>

      <a className="profile-link" href={profileUrl} target="_blank" rel="noreferrer">
        {copy.viewAll}
        <ArrowUpRight size={20} weight="bold" />
      </a>
    </section>
  );
}

function CharacterFeature({ copy }) {
  const project = projects.find((item) => item.id === "pixelAnimation");

  return (
    <section className="character-feature" aria-labelledby="character-feature-title">
      <div className="character-feature-heading">
        <h2 id="character-feature-title">{copy.characterFeature.title}</h2>
        <p>{copy.characterFeature.intro}</p>
      </div>

      <div className="character-feature-layout">
        <figure className="character-feature-media">
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
          <figcaption>{copy.characterFeature.mediaCaption}</figcaption>
        </figure>

        <article className="character-feature-story">
          <h3>{copy.characterFeature.name}</h3>
          <div className="character-story-copy">
            {copy.characterFeature.story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <dl>
            {copy.characterFeature.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}

function WorkSpotlight({ copy }) {
  const project = detailProjects["food-stall"];

  return (
    <ScrollExpand
      className="work-spotlight"
      src={project.hero.src}
      alt={copy.projectAlts.foodStall}
      title={copy.scrollExpand.title}
      startWidth={46}
      startHeight={62}
      startRadius={0}
      endRadius={0}
      mediaZoom={1.22}
      scrollDistance={1.05}
      holdDistance={0.32}
      smoothing={0.12}
      overlayScrim={0.66}
      useWindowScroll
      aria-label={copy.scrollExpand.ariaLabel}
    >
      <span>{project.code}</span>
      <h2>Food Stall</h2>
      <p>{copy.scrollExpand.body}</p>
      <a href="/work/food-stall">
        {copy.scrollExpand.action} <ArrowRight size={19} weight="bold" />
      </a>
    </ScrollExpand>
  );
}

function Practice({ copy }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="practice-section" aria-labelledby="practice-title">
      <div className="practice-title-wrap">
        <h2 id="practice-title">MULTI-DISCIPLINE<br />PRACTICE</h2>
        <img src={tacticalGrid} alt="" aria-hidden="true" loading="lazy" width="1672" height="941" />
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
            <h3>{title}</h3>
            <p>{description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CaseStudy({ copy }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef([]);
  const reduceMotion = useReducedMotion();
  const activeCase = caseStudies[activeIndex];

  const selectTab = (index, moveFocus = false) => {
    setActiveIndex(index);
    if (moveFocus) tabRefs.current[index]?.focus();
  };

  const handleTabKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % caseStudies.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + caseStudies.length) % caseStudies.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = caseStudies.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex, true);
  };

  return (
    <section className="case-section" id="case-study" aria-labelledby="case-title">
      <div className="case-title-block">
        <h2 id="case-title">CASE<br />STUDY</h2>
        <p>{copy.caseIntro}</p>
      </div>

      <div className="case-interface">
        <div className="case-tabs" role="tablist" aria-label={copy.caseTabsLabel}>
          {caseStudies.map((item, index) => (
            <button
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`case-tab-${index}`}
              key={item.id}
              type="button"
              role="tab"
              aria-controls={activeIndex === index ? `case-panel-${index}` : undefined}
              aria-selected={activeIndex === index}
              tabIndex={activeIndex === index ? 0 : -1}
              className={activeIndex === index ? "active" : ""}
              onClick={() => selectTab(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <small>{item.code}</small>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.article
            id={`case-panel-${activeIndex}`}
            role="tabpanel"
            aria-labelledby={`case-tab-${activeIndex}`}
            tabIndex={0}
            key={activeCase.id}
            className="case-detail"
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -18 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="case-image">
              <img src={activeCase.image} alt={copy.projectAlts[activeCase.id]} />
              <span>{activeCase.code}</span>
            </div>
            <div className="case-copy">
              <h3>{activeCase.title}</h3>
              <div className="case-steps">
                {copy.caseItems[activeCase.id].map(([label, description]) => (
                  <div key={label}>
                    <h4>{label}</h4>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
              <a href={activeCase.localUrl}>
                {copy.projectDetailUi.openDetail} <ArrowRight size={18} weight="bold" />
              </a>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </section>
  );
}

function About({ copy }) {
  const skillGroups = [
    ["SOFTWARE", ["3DS MAX", "SUBSTANCE 3D PAINTER", "UNITY", "AFTER EFFECTS"]],
    ["FOCUS", ["3D MODELING", "TEXTURING", "PIXEL ANIMATION", "VISUAL DESIGN"]],
  ];

  return (
    <section className="about-section" id="about">
      <div className="about-profile">
        <img src="/portfolio/profile-mascot.webp" alt={copy.avatarAlt} loading="lazy" width="620" height="637" />
        <div>
            <span>PHRNONO</span>
          <p>3D modeling / Digital art</p>
        </div>
      </div>
      <h2>BUILDING WORLDS<br />ONE FRAME AT A TIME.</h2>
      <div className="about-bottom">
        <p>{copy.aboutBody}</p>
        <a className="primary-action" href={profileUrl} target="_blank" rel="noreferrer">
          {copy.openArtstation} <ArrowUpRight size={18} weight="bold" />
        </a>
      </div>

      <div className="skills-contact">
        <div className="skill-groups" aria-label={copy.skillsLabel}>
          {skillGroups.map(([group, items]) => (
            <div className="skill-group" key={group}>
              <h3>{group}</h3>
              <div>
                {items.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          ))}
        </div>

        <div className="contact-panel" id="contact">
          <h3>{copy.contactTitle}</h3>
          <a href={profileUrl} target="_blank" rel="noreferrer">
            <ArrowUpRight size={20} weight="bold" />
            ARTSTATION PROFILE
          </a>
          <a href="mailto:hoykarpoh740@gmail.com">
            <EnvelopeSimple size={20} weight="bold" />
            {copy.email}
          </a>
          <a href="/files/PHRNONO-CV.pdf" download="PHRNONO-CV.pdf" title={copy.cvTitle}>
            <FilePdf size={20} weight="bold" />
            {copy.cvDownload}
          </a>
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
  const toolItems = [
    [ui.software, projectCopy.software],
    [ui.timeSpent, projectCopy.timeSpent],
    [ui.role, projectCopy.role],
    [ui.year, projectCopy.year],
  ];

  return (
    <article className="project-detail" data-project={project.slug}>
      <header className="detail-hero">
        <div className="detail-hero-copy">
          <a className="detail-back" href="/work">
            <ArrowLeft size={18} weight="bold" /> {ui.backToWork}
          </a>
          <p className="detail-code">{projectCopy.code}</p>
          <h1>{projectCopy.title}</h1>
          <p className="detail-summary">{projectCopy.summary}</p>
          <div className="detail-actions">
            <a className="primary-action" href={project.artstationUrl} target="_blank" rel="noreferrer">
              {ui.artstationOriginal} <ArrowUpRight size={18} weight="bold" />
            </a>
            {project.sketchfabUrl && (
              <a className="secondary-action" href={project.sketchfabUrl} target="_blank" rel="noreferrer">
                {ui.interactiveModel} <ArrowUpRight size={18} weight="bold" />
              </a>
            )}
          </div>
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
          <figcaption>{projectCopy.heroCaption}</figcaption>
        </motion.figure>
      </header>

      <section className="detail-tools" aria-labelledby="detail-tools-title">
        <h2 id="detail-tools-title">{ui.creativeTools}</h2>
        <dl>
          {toolItems.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="detail-overview" aria-labelledby="detail-overview-title">
        <div>
          <h2 id="detail-overview-title">{ui.overview}</h2>
          <p>{projectCopy.description}</p>
        </div>
        <aside>
          <h3>{ui.coreChallenge}</h3>
          <p>{projectCopy.challenge}</p>
        </aside>
      </section>

      <section className="detail-evidence" aria-labelledby="detail-evidence-title">
        <div className="detail-evidence-heading">
          <h2 id="detail-evidence-title">{ui.processMaterialsTitle}</h2>
          <p>{ui.processMaterialsNote}</p>
        </div>
        <dl className="detail-coverage">
          {ui.coverageLabels.map((label, index) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{projectCopy.processCoverage[index]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {project.images.length > 0 && (
        <section className="detail-published" aria-labelledby="detail-published-title">
          <div className="detail-published-heading">
            <h2 id="detail-published-title">{ui.publishedAssets}</h2>
            <p>{projectCopy.publishedAssets}</p>
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
                    <h3>{viewCopy.title}</h3>
                    <p>{viewCopy.body}</p>
                  </figcaption>
                </motion.figure>
              );
            })}
          </div>
        </section>
      )}

      {project.modelPreview && (
        <section className="detail-model" aria-labelledby="detail-model-title">
          <a href={project.sketchfabUrl} target="_blank" rel="noreferrer">
            <img
              src={project.modelPreview.src}
              alt={projectCopy.modelAlt}
              width={project.modelPreview.width}
              height={project.modelPreview.height}
              loading="lazy"
            />
          </a>
          <div>
            <h2 id="detail-model-title">{ui.interactiveModel}</h2>
            <p>{projectCopy.modelDescription}</p>
            <a href={project.sketchfabUrl} target="_blank" rel="noreferrer">
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
        <p>{copy.notFound.eyebrow}</p>
        <h1>{copy.notFound.title}</h1>
        <span>{copy.notFound.body}</span>
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
            src="/portfolio/profile-mascot.webp"
            alt={copy.notFound.characterAlt}
            width="620"
            height="637"
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

function Footer({ copy }) {
  return (
    <footer>
      <a href="/">PHRNONO</a>
      <p>{copy.footerDiscipline}</p>
      <span>© 2026</span>
    </footer>
  );
}

function SiteRail({ copy, workActive, onNavigate }) {
  const items = [copy.navHome, copy.navWork, copy.navAbout, copy.navContact];
  const routes = ["/", "/work", "/#about", "/#contact"];
  const initialIndex = workActive ? 1 : window.location.hash === "#contact" ? 3 : window.location.hash === "#about" ? 2 : 0;

  return (
    <div className="site-rail">
      <LineSidebar
        items={items}
        accentColor="#425000"
        textColor="#51544d"
        markerColor="#8d9088"
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

function getPageMeta(copy, route) {
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
  if (route.kind === "character") {
    return { title: `${copy.characterFeature.title} | PHRNONO`, description: copy.characterFeature.intro };
  }
  return { title: copy.metaTitle, description: copy.metaDescription };
}

export function App() {
  const [locale, setLocale] = useState(getInitialLocale);
  const [introVisible, setIntroVisible] = useState(getInitialIntroVisible);
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundEnabled);
  const [soundAnnouncement, setSoundAnnouncement] = useState("");
  const [routeTransitionPhase, setRouteTransitionPhase] = useState(getInitialRouteTransitionPhase);
  const [routeTransitionBlocking, setRouteTransitionBlocking] = useState(() => routeTransitionPhase !== "idle");
  const pendingNavigationRef = useRef("");
  const reduceMotion = useReducedMotion();
  const copy = translations[locale];
  const route = getRoute();
  const workActive = route.kind === "work" || route.kind === "detail" || route.kind === "character";

  useEffect(() => {
    const localeOption = localeOptions.find((option) => option.code === locale);
    const meta = getPageMeta(copy, route);
    document.documentElement.lang = localeOption?.documentLang ?? "zh-CN";
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", meta.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", meta.description);
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
    const timer = window.setTimeout(() => setRouteTransitionPhase("idle"), reduceMotion ? 10 : 80);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, routeTransitionPhase]);

  const requestNavigation = useCallback((href) => {
    const destination = new URL(href, window.location.href);
    const current = new URL(window.location.href);
    const sameDocument = destination.pathname === current.pathname && destination.search === current.search;

    if (destination.href === current.href) return;
    if (reduceMotion || (sameDocument && destination.hash)) {
      window.location.assign(destination.href);
      return;
    }

    pendingNavigationRef.current = destination.href;
    setRouteTransitionBlocking(true);
    setRouteTransitionPhase("leaving");
  }, [reduceMotion]);

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

  const finishIntro = () => {
    window.sessionStorage.setItem("phrolova-intro-seen", "true");
    setIntroVisible(false);
  };

  const toggleSound = () => {
    const nextEnabled = !soundEnabled;
    playSiteSound(nextEnabled ? "on" : "off");
    setSoundEnabled(nextEnabled);
    setSoundAnnouncement(nextEnabled ? copy.sound.enabledAnnouncement : copy.sound.disabledAnnouncement);
  };

  const completeRouteTransition = () => {
    const destination = pendingNavigationRef.current;
    if (!destination) return;
    try {
      window.sessionStorage.setItem(routeTransitionStorageKey, "arriving");
    } catch {
      // Navigation still proceeds when session storage is unavailable.
    }
    window.location.assign(destination);
  };

  let pageContent;
  let mainClassName;
  if (route.kind === "work") {
    mainClassName = "work-page";
    pageContent = <><Work copy={copy} /><WorkSpotlight copy={copy} /><CaseStudy copy={copy} /></>;
  } else if (route.kind === "character") {
    mainClassName = "character-page";
    pageContent = <CharacterFeature copy={copy} />;
  } else if (route.kind === "detail") {
    mainClassName = "detail-page-shell";
    pageContent = <ProjectDetail copy={copy} project={route.project} />;
  } else if (route.kind === "notFound") {
    mainClassName = "not-found-shell";
    pageContent = <NotFoundPage copy={copy} />;
  } else {
    mainClassName = "home-page";
    pageContent = <><Hero copy={copy} /><Practice copy={copy} /><About copy={copy} /></>;
  }

  return (
    <>
      <AnimatePresence>{introVisible && <IntroSequence copy={copy} onDone={finishIntro} />}</AnimatePresence>
      <RouteTransition
        phase={routeTransitionPhase}
        onCovered={completeRouteTransition}
        onExitComplete={() => setRouteTransitionBlocking(false)}
      />
      <div className="site-shell" inert={introVisible || routeTransitionBlocking ? true : undefined}>
        <a className="skip-link" href="#main-content">{copy.skipToContent}</a>
        <Header
          copy={copy}
          locale={locale}
          setLocale={setLocale}
          workActive={workActive}
          soundEnabled={soundEnabled}
          onSoundToggle={toggleSound}
        />
        <SiteRail copy={copy} workActive={workActive} onNavigate={requestNavigation} />
        <main id="main-content" className={mainClassName} tabIndex="-1">{pageContent}</main>
        <Footer copy={copy} />
      </div>
      <span className="sr-only" aria-live="polite">{soundAnnouncement}</span>
    </>
  );
}
