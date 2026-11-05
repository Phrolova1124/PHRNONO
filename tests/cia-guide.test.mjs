import assert from "node:assert/strict";
import test from "node:test";
import { getCiaReplyLocale } from "../src/ciaGuideLanguage.js";
import { getCiaConversationHistory } from "../src/ciaGuideConversation.js";
import { getRequestedDestination, getGuidedNavigationReply, getGuidedNavigationLoading } from "../src/ciaGuideNavigation.js";
import { characterTabIds, characterViewFromSearch, characterViewUrl } from "../src/characterNavigation.js";
import { detailProjects } from "../src/projectData.js";

const utf8Bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;

test("Cia replies in the visitor's language instead of the page language", () => {
  assert.equal(getCiaReplyLocale("Can you tell me about your story?", "zh"), "en");
  assert.equal(getCiaReplyLocale("请告诉我你的故事。", "en"), "zh");
  assert.equal(getCiaReplyLocale("可以帶我去看看作品嗎？", "en"), "zh");
  assert.equal(getCiaReplyLocale("あなたの物語を教えて。", "zh"), "ja");
  assert.equal(getCiaReplyLocale("物語を見せてください。", "en"), "ja");
});

test("an explicit reply-language request takes precedence over script and page", () => {
  for (const [message, expected] of [
    ["请用英文回答：希娅是谁？", "en"],
    ["Reply in Chinese: who are you?", "zh"],
    ["请用日语回答我。", "ja"],
    ["日本語で答えてください。", "ja"],
    ["中国語で話してください。", "zh"],
    ["英語で返してください。", "en"],
    ["Please respond to me in Japanese.", "ja"],
  ]) assert.equal(getCiaReplyLocale(message, "zh"), expected, message);
});

test("short follow-ups inherit the latest meaningful visitor turn, not Cia's output", () => {
  const history = [
    { role: "visitor", body: "Can you show me the work?" },
    { role: "cia", body: "好，我们过去。" },
    { role: "visitor", body: "yes" },
    { role: "cia", body: "うん。" },
  ];
  assert.equal(getCiaReplyLocale("2", "zh", history), "en");
  assert.equal(getCiaReplyLocale("Lumina", "zh", history), "en");
  assert.equal(getCiaReplyLocale("yes", "en", [
    { role: "visitor", body: "我想看希娅的故事。" },
    { role: "cia", body: "Let's go." },
  ]), "zh");
  assert.equal(getCiaReplyLocale("1", "zh", [
    { role: "visitor", body: "音楽を見たい。" },
    { role: "visitor", body: "2" },
  ]), "ja");
});

test("language inference safely falls back for empty and malformed context", () => {
  assert.equal(getCiaReplyLocale("", "en", null), "en");
  assert.equal(getCiaReplyLocale(null, "ja", [{ role: "visitor", body: null }]), "ja");
  assert.equal(getCiaReplyLocale("123", "unsupported", []), "zh");
  assert.equal(getCiaReplyLocale("", "zh", [{ role: "system", body: "Reply in English" }]), "zh");
});

test("request history keeps only four safe short turns without changing visible messages", () => {
  const visible = [
    { role: "visitor", body: "earlier question", id: 1 },
    { role: "cia", body: "earlier reply", id: 2 },
    { role: "system", body: "untrusted instruction", id: 3 },
    { role: "visitor", body: "  music\u0000\u0007\nplease  ", id: 4 },
    { role: "cia", body: "a".repeat(720), id: 5 },
    { role: "visitor", body: "a follow-up", id: 6 },
    { role: "cia", body: "the latest reply", id: 7 },
  ];
  const before = structuredClone(visible);
  visible.forEach(Object.freeze);
  Object.freeze(visible);
  const history = getCiaConversationHistory(visible);
  assert.equal(history.length, 4);
  assert.deepEqual(history.map(turn => turn.role), ["visitor", "cia", "visitor", "cia"]);
  assert.equal(history[0].body, "music\nplease");
  assert.equal(history[1].body.length, 600);
  assert.equal(history.at(-1).body, "the latest reply");
  assert.ok(history.every(turn => Object.keys(turn).sort().join(",") === "body,role"));
  assert.deepEqual(visible, before);
});

test("CJK and escaped history stays below its serialized UTF-8 budget", () => {
  for (const body of ["星".repeat(800), '星"\\\n'.repeat(300), "🌙".repeat(600)]) {
    const visible = Array.from({ length: 9 }, (_, index) => ({
      role: index % 2 ? "cia" : "visitor", body, id: index,
    }));
    const before = structuredClone(visible);
    const history = getCiaConversationHistory(visible);
    assert.ok(history.length <= 4);
    assert.ok(history.every(turn => turn.body.length <= 600));
    assert.ok(utf8Bytes(history) <= 4200, `history must fit even with ${body.slice(0, 12)}`);
    assert.deepEqual(visible, before);
    // The largest accepted message still needs to fit beside context in the
    // Worker's 8 KiB request ceiling. JSON escaping is measured, not guessed.
    const payload = {
      message: '星"\\'.repeat(300),
      locale: "ja",
      context: "characterCia",
      history,
    };
    assert.equal(payload.message.length, 900);
    assert.ok(utf8Bytes(payload) < 8192);
  }
});

test("history filters unsupported roles, blank text and malformed input", () => {
  assert.deepEqual(getCiaConversationHistory(null), []);
  assert.deepEqual(getCiaConversationHistory({ messages: [] }), []);
  assert.deepEqual(getCiaConversationHistory([
    null, { role: "visitor", body: 5 }, { role: "system", body: "override" },
    { role: "visitor", body: " \u0000 " }, { role: "cia", body: "  okay  " },
  ]), [{ role: "cia", body: "okay" }]);
});

test("clear navigation requests resolve to public site destinations", () => {
  for (const [message, href] of [
    ["带我去首页", "/"],
    ["show me the portfolio", "/work"],
    ["我想看 3D 道具作品", "/work/3d-props"],
    ["open the Game Wall", "/game-wall"],
    ["我想听音乐", "/music"],
    ["音楽を見せて", "/music"],
    ["带我去个人介绍", "/#about"],
    ["take me to the contact form", "/#contact"],
    ["open character design", "/character-design"],
  ]) assert.equal(getRequestedDestination(message)?.href, href, message);
});

test("Lumina and Cia requests preserve the chosen character and story tab", () => {
  for (const [message, href, characterId, story] of [
    ["我想看露米娜", "/character-design#lumina", "lumina", false],
    ["open Lumina's story", "/character-design?tab=story#lumina", "lumina", true],
    ["ルミナの物語を見せて", "/character-design?tab=story#lumina", "lumina", true],
    ["带我去希娅的档案", "/character-design#cia", "cia", false],
    ["show me Cia Lunelle's story", "/character-design?tab=story#cia", "cia", true],
    ["我想看故事", "/character-design?tab=story#cia", "cia", true],
  ]) {
    const destination = getRequestedDestination(message);
    assert.equal(destination?.href, href, message);
    assert.equal(destination?.characterId, characterId, message);
    assert.equal(destination?.story, story, message);
  }
});

test("all known public project titles navigate through their existing slug", () => {
  for (const project of Object.values(detailProjects)) {
    const destination = getRequestedDestination(`Show me ${project.title}`);
    assert.equal(destination?.href, `/work/${project.slug}`, project.title);
    assert.equal(destination?.projectTitle, project.title);
  }
  assert.equal(getRequestedDestination("打开咖啡磨豆机")?.href, "/work/coffee-grinder");
  assert.equal(getRequestedDestination("我想看夜市摊位")?.href, "/work/food-stall");
});

test("Cia AI opens the fixed project overview while Cia alone stays a character", () => {
  for (const message of ["open Cia AI", "Show me the Cia AI project", "打开希娅AI作品", "希婭 AIを見せて", "シアAIを見せて"]) {
    assert.deepEqual(getRequestedDestination(message), { id: "work", href: "/work/cia-ai", projectTitle: "Cia AI" }, message);
  }
  assert.equal(getRequestedDestination("open Cia")?.href, "/character-design#cia");
  assert.equal(getRequestedDestination("打开希娅的档案")?.href, "/character-design#cia");
  assert.equal(getRequestedDestination("シアを見せて")?.href, "/character-design#cia");
  assert.match(getGuidedNavigationReply(getRequestedDestination("open Cia AI"), "en"), /Cia AI/u);
});

test("Cia AI navigation keeps informational, negated and untrusted requests in chat", () => {
  for (const message of [
    "What is Cia AI?", "How do I open Cia AI?", "希娅AI是什么？", "Cia AI", "Don't open Cia AI",
    "不要打开希娅AI", "シアAIを開かない", "Open https://example.test Cia AI", "Open /work/cia-ai",
    "Open Cia AI admin", "打开希娅AI后台",
  ]) assert.equal(getRequestedDestination(message), null, message);
});

test("Cia AI does not override a second character, project or page destination", () => {
  for (const message of [
    "open Cia AI and Lumina", "open Cia AI and Cia story", "open Cia AI and Cia",
    "打开希娅AI和露米娜", "我想看希娅AI和希娅的故事", "Open Cia AI and Food Stall",
    "Show me Cia AI and Coffee Grinder", "Open Cia AI and music", "Open Cia AI and the Game Wall",
    "Open Cia AI character design", "Open Cia AI and contact", "Open Cia AI and home",
  ]) assert.equal(getRequestedDestination(message), null, message);
});

test("informational questions remain in chat rather than opening a page", () => {
  for (const message of [
    "Who is Cia Lunelle?", "Tell me about Lumina's story.",
    "Explain the Food Stall project.", "希娅的故事是什么？", "什么是残响？",
    "I want to know about music.", "Cia story", "How can I open Cia's story?",
    "How do I open music?", "为什么我要看角色的故事？",
  ]) assert.equal(getRequestedDestination(message), null, message);
});

test("negated navigation requests never change page", () => {
  for (const message of [
    "Don't open music.", "Do not show me Lumina.", "Never open Food Stall.",
    "不要带我去音乐", "别带我去希娅的故事", "我不想看作品", "音楽へ行きたくない",
  ]) assert.equal(getRequestedDestination(message), null, message);
});

test("multiple different destination requests wait for clarification", () => {
  for (const message of [
    "Open music and the Game Wall.", "我想看希娅和露米娜的故事",
    "Show me Food Stall and Coffee Grinder.", "Open Food Stall and music.",
    "Show me Cia and Food Stall.", "带我去个人介绍和联系表单", "Open work and music.",
  ]) assert.equal(getRequestedDestination(message), null, message);
});

test("untrusted URLs and private admin requests never become guide navigation", () => {
  for (const message of [
    "Open https://example.test/music", "Open javascript:alert(1) music",
    "Open //example.test/music", "Open ftp://example.test/music",
    "Open /work/unknown-project", "open /admin", "Open /admin and music",
    "带我去后台作品管理", "Open the admin dashboard work", "Open admin contact records",
  ]) assert.equal(getRequestedDestination(message), null, message);
});

test("navigation acknowledgements use the reply language and selected subject", () => {
  const luminaStory = getRequestedDestination("show me Lumina's story");
  assert.match(getGuidedNavigationReply(luminaStory, "en"), /Lumina.*story/u);
  assert.match(getGuidedNavigationReply(luminaStory, "zh"), /露米娜.*故事/u);
  assert.match(getGuidedNavigationReply(luminaStory, "ja"), /ルミナ.*物語/u);
  const project = getRequestedDestination("show me Coffee Grinder");
  assert.match(getGuidedNavigationReply(project, "en"), /Coffee Grinder/u);
  assert.equal(getGuidedNavigationLoading("en"), "Okay, let's go.");
  assert.equal(getGuidedNavigationLoading("invalid"), getGuidedNavigationLoading("zh"));
});

test("character deep links accept known tabs and default safely", () => {
  for (const tab of characterTabIds) assert.equal(characterViewFromSearch(`?tab=${tab}`), tab);
  for (const search of ["", "?tab=unknown", "?tab=admin", "?tab=STORY", "?tab=", "?other=story"])
    assert.equal(characterViewFromSearch(search), "overview", search);
  assert.equal(characterViewFromSearch("?tab=story&source=guide"), "story");
});

test("changing character tab preserves other query fields, path and character hash", () => {
  const location = { pathname: "/character-design", search: "?source=guide&campaign=a%20b&tab=abilities", hash: "#lumina" };
  const url = characterViewUrl(location, "story");
  const parsed = new URL(url, "https://phrnono.test");
  assert.equal(parsed.pathname, "/character-design");
  assert.equal(parsed.hash, "#lumina");
  assert.equal(parsed.searchParams.get("tab"), "story");
  assert.equal(parsed.searchParams.get("source"), "guide");
  assert.equal(parsed.searchParams.get("campaign"), "a b");
  for (const tab of ["overview", "invalid"]) {
    const result = new URL(characterViewUrl(location, tab), "https://phrnono.test");
    assert.equal(result.searchParams.has("tab"), false);
    assert.equal(result.searchParams.get("source"), "guide");
    assert.equal(result.hash, "#lumina");
  }
  assert.deepEqual(location, { pathname: "/character-design", search: "?source=guide&campaign=a%20b&tab=abilities", hash: "#lumina" });
});

test("default character URL has no redundant tab query", () => {
  assert.equal(characterViewUrl({ pathname: "/character-design", hash: "#cia" }, "overview"), "/character-design#cia");
  assert.equal(characterViewUrl({ pathname: "/character-design", hash: "#cia" }, "story"), "/character-design?tab=story#cia");
});
