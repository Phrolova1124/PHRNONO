import { detailProjects } from "./projectData.js";

export const navigationDestinations = [
  { id: "home", href: "/" },
  { id: "work", href: "/work" },
  { id: "gameWall", href: "/game-wall" },
  { id: "music", href: "/music" },
  { id: "character", href: "/character-design" },
  { id: "about", href: "/#about" },
  { id: "contact", href: "/#contact" },
];

const navigationCue = /(?:带我(?:去|看)|我想看|我要看|想看|想听|想去|去(?:看|听|玩)|打开|进入|跳到|导航|带路|show\s+me|take\s+me|go\s+to|open|visit|can\s+i\s+see|i\s+want\s+(?:to\s+)?(?:see|visit|go|listen)|見せて|見たい|連れて|行きたい|開いて|案内)/iu;
const questionCue = /(?:为什么|为何|是什么|什么是|是谁|如何|怎么|能否|能不能|\b(?:who|why|what|how|explain|tell\s+me\s+about)\b|なぜ|どうして|とは|誰)/iu;
const negativeCue = /(?:不要|别(?:带|去|跳|开)|不想|不用|不要跳转|\b(?:don['’]?t|do\s+not|not\s+now|never)\b|行きたくない|開かない)/iu;
const ciaName = /(?:希娅|露奈尔|シア|\bcia(?:\s+lunelle)?\b)/iu;
const ciaAIProjectName = /(?:\bcia[\s-]+ai\b|希[娅婭]\s*ai\b|シア\s*ai\b)/iu;
const luminaName = /(?:露米娜|ルミナ|\blumina\b)/iu;
const storyCue = /(?:故事|剧情|物語|ストーリー|\bstory\b)/iu;
const targetPatterns = {
  home: /(?:首页|主页|ホーム(?:ページ)?|\bhome\b|start\s*page)/iu,
  gameWall: /(?:游戏墙|照片墙|截图|游戏图片|ゲーム(?:壁|ウォール)|フォトウォール|スクリーンショット|game\s*(?:wall|photo)|screenshots?)/iu,
  music: /(?:音乐|歌曲|听歌|音楽|\bmusic\b|\bsongs?\b|\baudio\b)/iu,
  character: /(?:角色(?:档案|设计|页)?|キャラクター|character(?:\s*(?:archive|design|page))?)/iu,
  about: /(?:关于|创作方向|个人介绍|プロフィール|自己紹介|\babout\b|\bprofile\b)/iu,
  contact: /(?:联系(?:方式|表单)?|联络|联系方式|連絡|問い合わせ|\bcontact\b)/iu,
  work: /(?:作品集|作品|项目|ポートフォリオ|プロジェクト|\bwork\b|\bportfolio\b|\bprojects?\b|\b[23]d\b|像素|\bpixel\b)/iu,
};
const projectAliases = {
  "food-stall": /(?:夜市摊位|食物摊|美食摊|小吃摊)/u,
  "coffee-grinder": /(?:咖啡研磨机|咖啡磨豆机|コーヒーミル)/u,
  "pixel-environment": /(?:像素场景|ピクセル環境)/u,
  "room-design": /(?:房间设计|部屋デザイン)/u,
};

export function getRequestedDestination(value) {
  const message = typeof value === "string" ? value.trim() : "";
  // Lore questions, negated requests and ambiguous multiple destinations must
  // stay in chat. Never use a model-produced URL or an arbitrary visitor URL.
  if (!navigationCue.test(message) || negativeCue.test(message) || questionCue.test(message)
    || /(?:[a-z][a-z0-9+.-]*:\/\/|\/\/|javascript:|(?:^|\s)\/\S+|后台|後台|密码|密钥|\b(?:admin|dashboard|private)\b|contact\s+records)/iu.test(message)) return null;
  const projects = Object.values(detailProjects).filter(project => {
    const title = project.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\s+/gu, "\\s+");
    return new RegExp(`\\b${title}\\b`, "iu").test(message) || projectAliases[project.slug]?.test(message);
  });
  // This is the fixed portfolio project, not the character archive or a live
  // model endpoint. Remove only its recognised name when checking for another
  // character target, so "Cia AI and Cia's story" never chooses one for them.
  if (ciaAIProjectName.test(message)) {
    const otherText = message.replace(new RegExp(ciaAIProjectName.source, "giu"), "");
    if (projects.length || ciaName.test(otherText) || luminaName.test(otherText) || storyCue.test(message)
      || Object.entries(targetPatterns).some(([id, expression]) => id !== "work" && expression.test(message))) return null;
    return { id: "work", href: "/work/cia-ai", projectTitle: "Cia AI" };
  }
  if (projects.length > 1) return null;
  const cia = ciaName.test(message);
  const lumina = luminaName.test(message);
  if (cia && lumina) return null;
  const requested = Object.entries(targetPatterns).filter(([, expression]) => expression.test(message)).map(([id]) => id);
  if (projects.length === 1) {
    if (cia || lumina || storyCue.test(message) || requested.some(id => id !== "work")) return null;
    return { id: "work", href: `/work/${projects[0].slug}`, projectTitle: projects[0].title };
  }
  if (cia || lumina || storyCue.test(message) || requested.includes("character")) {
    if (requested.some(id => !["character", "work"].includes(id))) return null;
    const characterId = lumina ? "lumina" : cia || storyCue.test(message) ? "cia" : null;
    const story = storyCue.test(message);
    return { id: "character", characterId, story, href: `/character-design${story ? "?tab=story" : ""}${characterId ? `#${characterId}` : ""}` };
  }
  if (requested.length !== 1) return null;
  const id = requested[0];
  if (id === "work" && /(?:道具|\bprops?\b)/iu.test(message)) return { id, href: "/work/3d-props" };
  return navigationDestinations.find(destination => destination.id === id) ?? null;
}

const replies = {
  zh: { home: "好，我们回到入口那里。", work: "好，我们先去作品那里。", gameWall: "好，我们去翻一翻游戏墙。", music: "好，去音乐播放库。", character: "好，我们去角色档案。", about: "好，去看看 PHRNONO 的创作方向。", contact: "好，我带你去联系表单。" },
  en: { home: "Okay, back to the entrance.", work: "Let's look at the work first.", gameWall: "Let's look through the Game Wall.", music: "Let's go to the music library.", character: "Let's open the character archive.", about: "Let's look at PHRNONO's creative practice.", contact: "I'll take you to the contact form." },
  ja: { home: "うん、入口に戻ろう。", work: "まずは作品を見に行こう。", gameWall: "ゲームウォールを見に行こう。", music: "音楽のページへ行こう。", character: "キャラクター図鑑を開こう。", about: "PHRNONOの制作について見てみよう。", contact: "連絡フォームへ案内するね。" },
};

export function getGuidedNavigationReply(destination, locale = "zh") {
  const language = replies[locale] ? locale : "zh";
  if (destination.projectTitle) return { zh: `好，我们去看 ${destination.projectTitle}。`, en: `Let's look at ${destination.projectTitle}.`, ja: `${destination.projectTitle}を見に行こう。` }[language];
  if (destination.characterId) {
    const name = destination.characterId === "lumina" ? { zh: "露米娜", en: "Lumina", ja: "ルミナ" }[language] : { zh: "希娅", en: "Cia", ja: "シア" }[language];
    return destination.story
      ? { zh: `好，我带你去看${name}的故事。`, en: `Let's open ${name}'s story.`, ja: `${name}の物語を開こう。` }[language]
      : { zh: `好，我们去看${name}的档案。`, en: `Let's open ${name}'s archive.`, ja: `${name}の資料を開こう。` }[language];
  }
  return replies[language][destination.id] ?? getGuidedNavigationLoading(language);
}

export function getGuidedNavigationLoading(locale = "zh") {
  return { zh: "好，我们过去。", en: "Okay, let's go.", ja: "うん、行こう。" }[locale] ?? "好，我们过去。";
}
