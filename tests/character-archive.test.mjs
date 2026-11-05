import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { characterIds, ciaAssets, getCharacters } from "../src/characterData.js";
import { getCiaStory } from "../src/ciaStory.js";
import { translations } from "../src/i18n.js";
import { terminalTimelines, terminalExitMs, terminalPhases } from "../src/components/terminalTimelines.js";

for (const locale of ["zh", "en", "ja"]) {
  test(`${locale}: both characters, original assets, and complete chapter sequence`, () => {
    const characters = getCharacters(locale, translations[locale].characterFeature);
    assert.deepEqual(Object.keys(characters), characterIds);
    assert.equal(characters.cia.gallery.length, 8);
    assert.equal(new Set(characters.cia.gallery.map(image => image.src)).size, 8);
    assert.ok(!characters.cia.gallery.some(image => image.src.includes("three-view")));
    assert.equal(characters.cia.nodes.length, 3);
    for (const character of Object.values(characters)) {
      assert.ok(character.name && character.role && character.quote);
      for (const image of character.gallery) {
        assert.ok(image.label);
        assert.ok(existsSync(fileURLToPath(new URL(`../public${image.src}`, import.meta.url))), image.src);
      }
    }
    assert.equal(characters.cia.video, undefined, "2D art must not be represented as a supplied animation or model");
    const story = getCiaStory(locale);
    assert.equal(story.length, locale === "zh" ? 13 : 11);
    assert.ok(story.every(chapter => chapter.title && chapter.body.length && chapter.body.every(Boolean)));
  });
}
test("Cia's defining canon and ending are preserved", () => {
  const cia = getCharacters("zh", translations.zh.characterFeature).cia;
  assert.equal(cia.name, "希娅·露奈尔");
  assert.equal(cia.coverQuote, "我不会再把你们留在昨天了。去吧，这一次，不需要谁记住你，因为你确实来过这个世界。");
  assert.match(cia.nodes[0].body, /不是复活/);
  assert.match(cia.nodes[1].body, /没能保存完整的人格/);
  assert.match(cia.nodes[1].body, /最终消散时.*第一次/);
  assert.match(cia.nodes[2].body, /超过十万/);
  const story = getCiaStory("zh");
  assert.match(story[9].body.join(""), /数千份残响产生了同一个念头/);
  assert.match(story[9].body.join(""), /一个新的“希娅”被世界重新构成/);
  assert.match(story[11].body.join(""), /第一排中央[\s\S]*那里空着一个位置/);
  assert.match(story[12].body.join(""), /她第一次什么声音都听不见/);
  assert.match(story[12].body.join(""), /希娅没有被这个世界记住/);
});

test("ability background remains a scene-level diagonal and names follow the selected character", () => {
  const css = readFileSync(new URL('../src/components/CharacterArchive.css', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/CharacterArchive.jsx', import.meta.url), 'utf8');
  const accentRule = css.match(/\.character-record\[data-view="abilities"\] \.character-record__accent \{([^}]+)\}/)?.[1];
  assert.match(accentRule, /rotate\(var\(--ability-angle\)\)/);
  assert.match(accentRule, /--ability-background-x/);
  assert.doesNotMatch(css, /\.character-ability__surface::before/, 'green background must not be cut by the scrolling panel');
  assert.match(component, /character-ability__identity"><h2>\{character\.englishName\}<\/h2><span>\{character\.name\}/);
});

test("story chapters expose the LineSidebar rail without changing mobile flow", () => {
  const css = readFileSync(new URL('../src/components/CharacterArchive.css', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/CharacterArchive.jsx', import.meta.url), 'utf8');
  const sidebar = readFileSync(new URL('../src/components/LineSidebar.jsx', import.meta.url), 'utf8');
  assert.match(component, /import LineSidebar from "\.\/LineSidebar"/);
  assert.match(component, /activeIndex=\{chapter\}/);
  assert.match(component, /onItemClick=\{index => changeChapter\(index\)\}/);
  assert.match(sidebar, /requestAnimationFrame\(runFrame\)/);
  assert.match(css, /\.character-story \{ display: grid;/);
  assert.match(css, /\.character-story__sidebar \{[^}]*grid-column: 1/);
  assert.match(css, /\.character-story__sidebar \{ display: none; \}/);
});

test("the shared mascot artwork uses the cropped Asset 175 SVG", () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const asset = readFileSync(new URL('../public/portfolio/asset-175.svg', import.meta.url), 'utf8');
  assert.equal((app.match(/\/portfolio\/asset-175\.svg/g) || []).length, 4);
  assert.doesNotMatch(app, /\/portfolio\/profile-mascot\.webp/);
  assert.match(asset, /viewBox="540\.87 273\.97 535\.70 489\.83"/);
});

test("the shared header and browser identity use the Asset 175 SVG", () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = readFileSync(new URL('../public/site.webmanifest', import.meta.url), 'utf8');
  const iosIcon = readFileSync(new URL('../public/apple-touch-icon.png', import.meta.url));
  assert.match(app, /className="brand-mark" src="\/portfolio\/asset-175\.svg"/);
  assert.match(index, /rel="icon" href="\/portfolio\/asset-175\.svg" type="image\/svg\+xml"/);
  assert.match(index, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  assert.match(manifest, /"src": "\/apple-touch-icon\.png"/);
  assert.match(manifest, /"src": "\/portfolio\/asset-175\.svg"/);
  assert.deepEqual([...iosIcon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("opening and route transitions use Asset 175 instead of a P. emblem", () => {
  const terminal = readFileSync(new URL('../src/components/TerminalSequence.jsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../src/components/RouteTransition.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(terminal, />P<span>\.<\/span>|"P\."/);
  assert.doesNotMatch(route, />P<span>\.<\/span>/);
  assert.match(terminal, /className="terminal-sequence__asset" src="\/portfolio\/asset-175\.svg"/);
  assert.match(terminal, /className="terminal-sequence__seal-asset" src="\/portfolio\/asset-175\.svg"/);
  assert.match(route, /className="archive-transition__asset" src="\/portfolio\/asset-175\.svg"/);
});

test("openings last 12 / 13 / 14 seconds including the final exit", () => {
  for (const [mode, total] of [["public", 12000], ["access", 13000], ["authorized", 14000]]) {
    assert.equal(terminalTimelines[mode].duration + terminalExitMs, total);
    assert.equal(terminalTimelines[mode].stages.length, terminalPhases.length - 1);
  }
});

test("each phase finishes its staggered animation before the next phase", () => {
  // CSS: fragments 1350+2*140, scanner 1300, records 700+2*270,
  // checks 800+2*450, orbit 1300, welcome 1100+400, shutters 1250+150+3*110.
  const minimums = [1630, 1300, 1300, 1700, 1300, 1500, 1730];
  for (const [mode, timeline] of Object.entries(terminalTimelines)) {
    const boundaries = [0, ...timeline.stages, timeline.duration];
    for (let index = 0; index < terminalPhases.length; index++) {
      const minimum = mode === "access" && index === 6 ? 650 : minimums[index];
      assert.ok(boundaries[index + 1] - boundaries[index] >= minimum + 40, `${mode}/${terminalPhases[index]} is truncated`);
    }
  }
});

test("login frame, title, credentials and actions finish in sequence", () => {
  const { build, stages, duration } = terminalTimelines.access;
  assert.equal(build.length, 4);
  assert.ok(build[0] >= stages[3] + 800, "frame should appear after the paper begins dissolving");
  const boundaries = [...build, duration];
  for (const [index, minimum] of [1420, 650, 1200, 650].entries()) {
    assert.ok(boundaries[index + 1] - boundaries[index] >= minimum + 50);
  }
});

test("only inspected colored art uses alpha derivatives; pale line art stays original", () => {
  for (const key of ["sketch", "star", "noa", "repose", "journey", "costume"]) {
    assert.ok(ciaAssets[key].endsWith(".jpg"), `${key} must retain its original white details`);
  }
  for (const key of ["portrait", "avatar"]) {
    const data = readFileSync(new URL(`../public${ciaAssets[key]}`, import.meta.url));
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.equal(data[25], 6, "PNG must have a true RGBA channel, not a painted transparency grid");
  }
});
