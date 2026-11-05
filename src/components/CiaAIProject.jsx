import { useEffect, useRef } from "react";
import { ciaAIProjectCopy } from "../ciaAIProjectData";
import "./CiaAIProject.css";

function Arrow({ back = false }) {
  return <span aria-hidden="true">{back ? "↖" : "↗"}</span>;
}

function InteractionStudy({ copy }) {
  return (
    <figure className="cia-project__study" data-cia-reveal="study">
      <div className="cia-project__study-top">
        <span>CIA / LOCAL STUDIO</span>
        <span aria-hidden="true">＋</span>
      </div>
      <div className="cia-project__study-content">
        <p className="cia-project__study-label">{copy.interfaceLabel}</p>
        <h2>{copy.interfaceTitle}</h2>
        <ol className="cia-project__flow">
          <li className="cia-project__flow-input"><span>{copy.interfaceInput}</span></li>
          <li className="cia-project__flow-tools">
            <ul>{copy.interfaceTools.map((tool) => <li key={tool}>{tool}</li>)}</ul>
            <p>{copy.interfacePermission}</p>
          </li>
          <li className="cia-project__flow-result"><span>{copy.interfaceResult}</span></li>
        </ol>
      </div>
      <figcaption>{copy.interfaceCaption}</figcaption>
    </figure>
  );
}

export default function CiaAIProject({ locale = "zh", openingEnabled = true }) {
  const copy = ciaAIProjectCopy[locale] ?? ciaAIProjectCopy.zh;
  const articleRef = useRef(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || !openingEnabled || !window.IntersectionObserver) return undefined;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    const prepare = () => {
      observer?.disconnect();
      article.dataset.motion = preference.matches ? "reduced" : "ready";
      if (preference.matches) return;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
      article.querySelectorAll("[data-cia-reveal]").forEach((element) => {
        if (element.dataset.visible !== "true") observer.observe(element);
      });
    };
    prepare();
    preference.addEventListener("change", prepare);
    return () => {
      preference.removeEventListener("change", prepare);
      observer?.disconnect();
      delete article.dataset.motion;
    };
  }, [openingEnabled]);

  return (
    <article className="cia-project" data-cia-context="work" ref={articleRef}>
      <header className="cia-project__hero">
        <a className="cia-project__back" href="/work#category-interactive"><Arrow back />{copy.back}</a>
        <div className="cia-project__hero-grid">
          <div className="cia-project__hero-copy" data-cia-reveal="identity">
            <p className="cia-project__eyebrow">PHRNONO / LOCAL AI & INTERACTION</p>
            <h1>{copy.title}</h1>
            <p className="cia-project__subtitle">{copy.subtitle}</p>
            <p className="cia-project__intro">{copy.intro}</p>
            <a className="cia-project__character-link" href="/character-design#cia">{copy.characterCta}<Arrow /></a>
          </div>
          <InteractionStudy copy={copy} />
        </div>
        <dl className="cia-project__facts" data-cia-reveal="record">
          <div><dt>{copy.formatLabel}</dt><dd>{copy.format}</dd></div>
          <div><dt>{copy.platformLabel}</dt><dd>{copy.platform}</dd></div>
          <div><dt>{copy.foundationLabel}</dt><dd>{copy.foundation}</dd></div>
        </dl>
      </header>

      <section className="cia-project__capabilities" aria-labelledby="cia-capabilities-title">
        <div className="cia-project__section-intro" data-cia-reveal="record">
          <p className="cia-project__eyebrow">{copy.capabilitiesEyebrow}</p>
          <h2 id="cia-capabilities-title">{copy.capabilitiesTitle}</h2>
          <p>{copy.capabilitiesIntro}</p>
        </div>
        <dl className="cia-project__capability-list">
          {copy.capabilities.map((item) => (
            <div className="cia-project__capability" key={item.key} data-cia-reveal="record">
              <dt><span>{item.key}</span><strong>{item.title}</strong></dt>
              <dd><p>{item.body}</p><small>{item.detail}</small></dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cia-project__focus" aria-labelledby="cia-focus-title" data-cia-reveal="focus">
        <p className="cia-project__eyebrow">{copy.focusEyebrow}</p>
        <h2 id="cia-focus-title">{copy.focusTitle}</h2>
        <p>{copy.focusBody}</p>
      </section>

      <section className="cia-project__character" aria-labelledby="cia-character-title" data-cia-reveal="record">
        <div className="cia-project__character-identity">
          <img src="/characters/cia/avatar-cutout.png" alt="" width="112" height="112" loading="lazy" />
          <span>CIA<br />LUNELLE</span>
        </div>
        <div className="cia-project__character-copy">
          <p className="cia-project__eyebrow">{copy.characterEyebrow}</p>
          <h2 id="cia-character-title">{copy.characterTitle}</h2>
          <p>{copy.characterBody}</p>
          <a className="cia-project__character-link" href="/character-design#cia">{copy.characterCta}<Arrow /></a>
        </div>
      </section>

      <aside className="cia-project__scope" aria-label={copy.limitationsTitle}>
        <h2>{copy.limitationsTitle}</h2>
        <p>{copy.limitations}</p>
      </aside>
      <div className="cia-project__closing"><span>{copy.closing}</span><a href="/work#category-interactive">{copy.back}<Arrow back /></a></div>
    </article>
  );
}
