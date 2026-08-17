import fs from "node:fs";
import path from "node:path";
import { chromium } from "file:///C:/Users/hoykarpoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const baseUrl = process.env.QA_URL ?? "http://localhost:4173/";
const browserPath = process.env.QA_BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outputDir = path.resolve("qa");

fs.mkdirSync(outputDir, { recursive: true });

const results = {
  baseUrl,
  browserPath,
  consoleErrors: [],
  pageErrors: [],
  checks: {},
};

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--disable-gpu"],
});

async function waitForIntro(page) {
  if (await page.locator(".intro-sequence").count()) {
    await page.locator(".intro-sequence").waitFor({ state: "detached", timeout: 6000 });
  }
}

async function preparePage(viewport, route = "", pageOptions = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, ...pageOptions });
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => results.pageErrors.push(error.message));
  await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
  await waitForIntro(page);
  return page;
}

async function revealPage(page) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.72));
    for (let position = 0; position < document.documentElement.scrollHeight; position += step) {
      window.scrollTo(0, position);
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
}

async function pageHealth(page) {
  return page.evaluate(() => ({
    path: window.location.pathname,
    title: document.title,
    language: document.documentElement.lang,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    projectCount: document.querySelectorAll(".project-card").length,
    galleryPanelCount: document.querySelectorAll(".ag-panel").length,
    detailToolCount: document.querySelectorAll(".detail-tools dl > div").length,
    coverageCount: document.querySelectorAll(".detail-coverage > div").length,
    brokenImages: [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src),
    videoStates: [...document.querySelectorAll("video")].map((video) => ({
      source: video.currentSrc,
      readyState: video.readyState,
      networkState: video.networkState,
      paused: video.paused,
      autoplay: video.autoplay,
      controls: video.controls,
    })),
  }));
}

const desktop = await preparePage({ width: 1280, height: 720 });
await desktop.mouse.move(310, 380);
await desktop.waitForTimeout(350);

results.checks.desktopHome = {
  ...(await pageHealth(desktop)),
  shapeGrid: await desktop.locator(".hero-shape-grid").evaluate((canvas) => ({
    cssWidth: canvas.clientWidth,
    cssHeight: canvas.clientHeight,
    bitmapWidth: canvas.width,
    bitmapHeight: canvas.height,
  })),
  emailHref: await desktop.locator('a[href^="mailto:"]').getAttribute("href"),
  cvHref: await desktop.locator('.contact-panel a[download]').getAttribute("href"),
  cvDownload: await desktop.locator('.contact-panel a[download]').getAttribute("download"),
  sidebarItems: await desktop.locator(".site-rail .line-sidebar__item").count(),
};

await desktop.screenshot({ path: path.join(outputDir, "desktop-home.png") });
await revealPage(desktop);
await desktop.screenshot({ path: path.join(outputDir, "desktop-home-full.png"), fullPage: true });

await desktop.getByRole("button", { name: /English/ }).click();
results.checks.english = {
  language: await desktop.locator("html").getAttribute("lang"),
  title: await desktop.title(),
  workLink: await desktop.locator(".desktop-nav a").first().innerText(),
};
await desktop.getByRole("button", { name: /日本語/ }).click();
results.checks.japanese = {
  language: await desktop.locator("html").getAttribute("lang"),
  title: await desktop.title(),
  workLink: await desktop.locator(".desktop-nav a").first().innerText(),
};
await desktop.getByRole("button", { name: /中文/ }).click();

results.checks.soundDefault = {
  pressed: await desktop.locator(".sound-toggle-desktop").getAttribute("aria-pressed"),
  stored: await desktop.evaluate(() => window.localStorage.getItem("phrolova-sound-enabled")),
};
await desktop.locator(".sound-toggle-desktop").click();
results.checks.soundEnabled = {
  pressed: await desktop.locator(".sound-toggle-desktop").getAttribute("aria-pressed"),
  stored: await desktop.evaluate(() => window.localStorage.getItem("phrolova-sound-enabled")),
};
await desktop.reload({ waitUntil: "networkidle" });
await waitForIntro(desktop);
results.checks.soundPersisted = {
  pressed: await desktop.locator(".sound-toggle-desktop").getAttribute("aria-pressed"),
  stored: await desktop.evaluate(() => window.localStorage.getItem("phrolova-sound-enabled")),
};

await desktop.goto(new URL("work", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(desktop);
results.checks.desktopWork = await pageHealth(desktop);
await desktop.screenshot({ path: path.join(outputDir, "desktop-work.png") });
await revealPage(desktop);
await desktop.screenshot({ path: path.join(outputDir, "desktop-work-full.png"), fullPage: true });

const desktopSpotlight = desktop.locator(".work-spotlight");
const desktopSpotlightMetrics = await desktopSpotlight.evaluate((section) => ({
  top: section.getBoundingClientRect().top + window.scrollY,
  stageHeight: section.querySelector(".scroll-expand__stage")?.getBoundingClientRect().height ?? 0,
}));
await desktop.evaluate((top) => window.scrollTo(0, top), desktopSpotlightMetrics.top);
await desktop.waitForTimeout(650);
results.checks.scrollExpandRest = await desktopSpotlight.evaluate((section) => ({
  frameClip: section.querySelector(".scroll-expand__frame")?.style.clipPath,
  mediaTransform: section.querySelector(".scroll-expand__media")?.style.transform,
  overlayHidden: section.querySelector(".scroll-expand__overlay")?.getAttribute("aria-hidden"),
  overlayInert: section.querySelector(".scroll-expand__overlay")?.inert,
  titleOpacity: section.querySelector(".scroll-expand__title")?.style.opacity,
}));
await desktop.screenshot({ path: path.join(outputDir, "desktop-scroll-expand-rest.png") });

await desktop.evaluate(
  ({ top, stageHeight }) => window.scrollTo(0, top + stageHeight * 1.08),
  desktopSpotlightMetrics,
);
await desktop.waitForTimeout(900);
results.checks.scrollExpandOpen = await desktopSpotlight.evaluate((section) => ({
  frameClip: section.querySelector(".scroll-expand__frame")?.style.clipPath,
  mediaTransform: section.querySelector(".scroll-expand__media")?.style.transform,
  overlayHidden: section.querySelector(".scroll-expand__overlay")?.getAttribute("aria-hidden"),
  overlayInert: section.querySelector(".scroll-expand__overlay")?.inert,
  actionHref: section.querySelector(".scroll-expand__overlay a")?.getAttribute("href"),
  titleOpacity: section.querySelector(".scroll-expand__title")?.style.opacity,
}));
await desktop.screenshot({ path: path.join(outputDir, "desktop-scroll-expand-open.png") });
await desktop.evaluate(() => window.scrollTo(0, 0));
await desktop.waitForTimeout(250);

await desktop.locator(".ag-panel").nth(2).hover();
await desktop.waitForTimeout(700);
results.checks.accordionGallery = {
  panelCount: await desktop.locator(".ag-panel").count(),
  activeLabel: await desktop.locator(".ag-panel--active").getAttribute("aria-label"),
  linkTargets: await desktop.locator(".ag-panel").evaluateAll((panels) => panels.map((panel) => panel.getAttribute("href"))),
  browserTargets: await desktop.locator(".ag-panel").evaluateAll((panels) => panels.map((panel) => panel.getAttribute("target"))),
};
await desktop.screenshot({ path: path.join(outputDir, "desktop-gallery.png") });

const characterPanel = desktop.locator(".ag-panel").nth(3);
await characterPanel.hover();
await desktop.waitForTimeout(350);
const characterHref = await characterPanel.getAttribute("href");
const characterTarget = await characterPanel.getAttribute("target");
const characterNavigation = desktop.waitForURL(/\/character-design$/);
await characterPanel.click();
await characterNavigation;
await desktop.waitForTimeout(700);
const characterFeature = desktop.locator(".character-feature");
results.checks.characterGalleryNavigation = {
  href: characterHref,
  target: characterTarget,
  path: new URL(desktop.url()).pathname,
  sectionVisible: await characterFeature.isVisible(),
};
results.checks.characterFeature = await characterFeature.evaluate((section) => {
  const video = section.querySelector("video");
  return {
    heading: section.querySelector("h2")?.textContent?.trim(),
    characterName: section.querySelector("h3")?.textContent?.trim(),
    storyParagraphs: section.querySelectorAll(".character-story-copy p").length,
    factCount: section.querySelectorAll("dl > div").length,
    artstationLinks: section.querySelectorAll('a[href*="artstation.com"]').length,
    source: video?.getAttribute("src"),
    paused: video?.paused,
    autoplay: video?.autoplay,
    controls: video?.controls,
  };
});
await desktop.screenshot({ path: path.join(outputDir, "desktop-character-design.png") });

await desktop.goto(new URL("work", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(desktop);
await revealPage(desktop);
await desktop.locator("#case-study").scrollIntoViewIfNeeded();
await desktop.getByRole("tab", { name: /Coffee Grinder/ }).click();
await desktop.waitForTimeout(450);
results.checks.caseStudy = {
  selectedTab: await desktop.getByRole("tab", { selected: true }).innerText(),
  heading: await desktop.locator(".case-detail h3").innerText(),
  panelLabel: await desktop.locator('[role="tabpanel"]').getAttribute("aria-labelledby"),
};
await desktop.screenshot({ path: path.join(outputDir, "desktop-case.png") });

for (const slug of ["food-stall", "coffee-grinder", "pixel-environment"]) {
  await desktop.goto(new URL(`work/${slug}`, baseUrl).href, { waitUntil: "networkidle" });
  await waitForIntro(desktop);
  await revealPage(desktop);
  results.checks[`detail-${slug}`] = {
    ...(await pageHealth(desktop)),
    heading: await desktop.locator(".detail-hero h1").innerText(),
    artstationHref: await desktop.locator(".detail-actions a").first().getAttribute("href"),
    paginationLinks: await desktop.locator(".detail-pagination a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    processNote: await desktop.locator(".detail-evidence-heading p").innerText(),
  };
  await desktop.screenshot({ path: path.join(outputDir, `desktop-detail-${slug}-full.png`), fullPage: true });
}

await desktop.goto(new URL("missing-page", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(desktop);
results.checks.notFound = {
  ...(await pageHealth(desktop)),
  heading: await desktop.locator(".not-found-copy h1").innerText(),
  homeHref: await desktop.locator(".not-found-actions a").first().getAttribute("href"),
  workHref: await desktop.locator(".not-found-actions a").last().getAttribute("href"),
  mascotVisible: await desktop.locator(".not-found-mascot-wrap img").isVisible(),
};
await desktop.screenshot({ path: path.join(outputDir, "desktop-404.png") });
await desktop.close();

const routeTransition = await preparePage({ width: 1280, height: 720 });
const routeNavigation = routeTransition.waitForURL(/\/work$/);
await routeTransition.locator('.desktop-nav a[href="/work"]').click();
await routeTransition.waitForTimeout(220);
results.checks.routeTransitionLeaving = {
  visible: await routeTransition.locator(".route-transition").isVisible(),
  shellInert: await routeTransition.locator(".site-shell").getAttribute("inert"),
};
await routeTransition.screenshot({ path: path.join(outputDir, "desktop-route-transition-leaving.png") });
await routeNavigation;
await routeTransition.locator(".route-transition").waitFor({ state: "visible", timeout: 1500 });
results.checks.routeTransitionArriving = {
  path: new URL(routeTransition.url()).pathname,
  visible: await routeTransition.locator(".route-transition").isVisible(),
  shellInert: await routeTransition.locator(".site-shell").getAttribute("inert"),
};
await routeTransition.screenshot({ path: path.join(outputDir, "desktop-route-transition-arriving.png") });
await routeTransition.locator(".route-transition").waitFor({ state: "detached", timeout: 2000 });
results.checks.routeTransitionComplete = {
  path: new URL(routeTransition.url()).pathname,
  shellInert: await routeTransition.locator(".site-shell").getAttribute("inert"),
};

const railNavigation = routeTransition.waitForURL((url) => url.pathname === "/");
await routeTransition.locator(".site-rail .line-sidebar__label").first().click();
await routeTransition.waitForTimeout(220);
results.checks.siteRailTransition = {
  overlayVisible: await routeTransition.locator(".route-transition").isVisible(),
  shellInert: await routeTransition.locator(".site-shell").getAttribute("inert"),
};
await railNavigation;
await routeTransition.locator(".route-transition").waitFor({ state: "detached", timeout: 2000 });
results.checks.siteRailTransitionComplete = {
  path: new URL(routeTransition.url()).pathname,
  shellInert: await routeTransition.locator(".site-shell").getAttribute("inert"),
};
await routeTransition.close();

const mobile = await preparePage({ width: 390, height: 844 });
results.checks.mobileHome = {
  ...(await pageHealth(mobile)),
  menuToggleVisible: await mobile.locator(".menu-toggle").isVisible(),
};
await mobile.screenshot({ path: path.join(outputDir, "mobile-home.png") });
await revealPage(mobile);
await mobile.screenshot({ path: path.join(outputDir, "mobile-home-full.png"), fullPage: true });

await mobile.locator(".menu-toggle").click();
await mobile.waitForTimeout(200);
results.checks.mobileMenu = {
  expanded: await mobile.locator(".menu-toggle").getAttribute("aria-expanded"),
  controls: await mobile.locator(".menu-toggle").getAttribute("aria-controls"),
  navVisible: await mobile.locator(".mobile-nav").isVisible(),
  linkCount: await mobile.locator(".mobile-nav a").count(),
  languageButtons: await mobile.locator(".language-switcher-mobile button").count(),
};
await mobile.screenshot({ path: path.join(outputDir, "mobile-menu.png") });

await mobile.locator(".language-switcher-mobile button").nth(1).click();
await mobile.waitForTimeout(100);
results.checks.mobileLocaleFocusRestore = {
  menuExpanded: await mobile.locator(".menu-toggle").getAttribute("aria-expanded"),
  focusReturnedToMenuButton: await mobile.locator(".menu-toggle").evaluate((button) => document.activeElement === button),
};
await mobile.locator(".menu-toggle").click();
await mobile.locator(".language-switcher-mobile button").first().click();
await mobile.waitForTimeout(100);

await mobile.goto(new URL("work", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(mobile);
await revealPage(mobile);
results.checks.mobileWork = await pageHealth(mobile);
await mobile.screenshot({ path: path.join(outputDir, "mobile-work-full.png"), fullPage: true });

await mobile.goto(new URL("character-design", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(mobile);
await revealPage(mobile);
const mobileCharacter = mobile.locator(".character-feature");
results.checks.mobileCharacterFeature = await mobileCharacter.evaluate((section) => ({
  clientWidth: section.clientWidth,
  scrollWidth: section.scrollWidth,
  heading: section.querySelector("h2")?.textContent?.trim(),
  factCount: section.querySelectorAll("dl > div").length,
}));
await mobile.screenshot({ path: path.join(outputDir, "mobile-character-design.png") });

await mobile.goto(new URL("work", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(mobile);
await revealPage(mobile);
const mobileSpotlight = mobile.locator(".work-spotlight");
const mobileSpotlightMetrics = await mobileSpotlight.evaluate((section) => ({
  top: section.getBoundingClientRect().top + window.scrollY,
  stageHeight: section.querySelector(".scroll-expand__stage")?.getBoundingClientRect().height ?? 0,
}));
await mobile.evaluate(
  ({ top, stageHeight }) => window.scrollTo(0, top + stageHeight * 1.08),
  mobileSpotlightMetrics,
);
await mobile.waitForTimeout(900);
results.checks.mobileScrollExpand = {
  ...(await pageHealth(mobile)),
  state: await mobileSpotlight.evaluate((section) => ({
    frameClip: section.querySelector(".scroll-expand__frame")?.style.clipPath,
    overlayHidden: section.querySelector(".scroll-expand__overlay")?.getAttribute("aria-hidden"),
    overlayInert: section.querySelector(".scroll-expand__overlay")?.inert,
  })),
};
await mobile.screenshot({ path: path.join(outputDir, "mobile-scroll-expand-open.png") });

await mobile.goto(new URL("work/food-stall", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(mobile);
await revealPage(mobile);
results.checks.mobileDetail = await pageHealth(mobile);
await mobile.screenshot({ path: path.join(outputDir, "mobile-detail-food-stall-full.png"), fullPage: true });

await mobile.goto(new URL("work/pixel-environment", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(mobile);
await revealPage(mobile);
results.checks.mobilePixelDetail = {
  ...(await pageHealth(mobile)),
  heading: await mobile.locator(".detail-hero h1").evaluate((heading) => ({
    text: heading.textContent,
    clientWidth: heading.clientWidth,
    scrollWidth: heading.scrollWidth,
    left: heading.getBoundingClientRect().left,
    right: heading.getBoundingClientRect().right,
  })),
};
await mobile.screenshot({ path: path.join(outputDir, "mobile-detail-pixel-environment-full.png"), fullPage: true });

await mobile.goto(new URL("not-here", baseUrl).href, { waitUntil: "networkidle" });
await waitForIntro(mobile);
results.checks.mobile404 = await pageHealth(mobile);
await mobile.screenshot({ path: path.join(outputDir, "mobile-404.png") });
await mobile.close();

const reducedMotion = await preparePage({ width: 1280, height: 720 }, "", { reducedMotion: "reduce" });
await reducedMotion.waitForTimeout(250);
results.checks.reducedMotion = await reducedMotion.evaluate(() => ({
  mediaQueryMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  introPresent: Boolean(document.querySelector(".intro-sequence")),
  documentAnimations: document.getAnimations().length,
  videoCount: document.querySelectorAll("video").length,
  shapeGridPresent: Boolean(document.querySelector(".hero-shape-grid")),
}));
await reducedMotion.screenshot({ path: path.join(outputDir, "desktop-reduced-motion.png") });
await reducedMotion.locator('.desktop-nav a[href="/work"]').click();
await reducedMotion.waitForURL(/\/work$/);
results.checks.reducedMotionRouteNavigation = {
  path: new URL(reducedMotion.url()).pathname,
  transitionPresent: await reducedMotion.locator(".route-transition").count(),
};
await reducedMotion.close();

const reducedSpotlight = await preparePage({ width: 1280, height: 720 }, "work", { reducedMotion: "reduce" });
await reducedSpotlight.locator(".work-spotlight").scrollIntoViewIfNeeded();
await reducedSpotlight.waitForTimeout(250);
results.checks.reducedMotionScrollExpand = await reducedSpotlight.locator(".work-spotlight").evaluate((section) => ({
  trackHeight: section.querySelector(".scroll-expand__track")?.getBoundingClientRect().height,
  stageHeight: section.querySelector(".scroll-expand__stage")?.getBoundingClientRect().height,
  frameClip: section.querySelector(".scroll-expand__frame")?.style.clipPath,
  mediaTransform: section.querySelector(".scroll-expand__media")?.style.transform,
  overlayHidden: section.querySelector(".scroll-expand__overlay")?.getAttribute("aria-hidden"),
  overlayInert: section.querySelector(".scroll-expand__overlay")?.inert,
  documentAnimations: document.getAnimations().length,
}));
await reducedSpotlight.screenshot({ path: path.join(outputDir, "desktop-scroll-expand-reduced.png") });
await reducedSpotlight.close();

await browser.close();

fs.writeFileSync(path.join(outputDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(JSON.stringify(results, null, 2));
