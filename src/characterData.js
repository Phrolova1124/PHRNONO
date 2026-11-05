// User-supplied character canon. Presentation may change; these facts must not.
const local = (locale, zh, en, ja) => ({ zh, en, ja }[locale] || zh);
export const characterIds = ["lumina", "cia"];
export const ciaAssets = {
  portrait: "/characters/cia/portrait-cutout.png", sketch: "/characters/cia/portrait-sketch.jpg",
  star: "/characters/cia/unfinished-star.jpg", noa: "/characters/cia/noa.jpg",
  costume: "/characters/cia/costume.jpg",
  repose: "/characters/cia/repose.jpg", journey: "/characters/cia/journey.jpg", avatar: "/characters/cia/avatar-cutout.png",
};

export function getCharacters(locale, luminaFeature) {
  const l = (zh, en, ja) => local(locale, zh, en, ja);
  return {
    lumina: {
      id: "lumina", number: "01", name: l("露米娜", "Lumina", "ルミナ"), englishName: "LUMINA",
      role: l("遗物净化者", "Relic purifier", "遺物の浄化者"),
      quote: l("面无表情的旅人，藏不住对美食的热爱。", "An aloof traveler with an appetite for the next great meal.", "無表情な旅人の楽しみは、次のおいしい一皿。"),
      medium: l("像素角色", "Pixel character", "ピクセルキャラクター"),
      portrait: "/portfolio/art-01.webp", avatar: "/portfolio/art-01.webp", video: "/portfolio/art-04.webm", poster: "/portfolio/art-04-poster.webp",
      palette: ["#151515", "#a8a99b", "#dfc6b2", "#b92732", "#f39d12"],
      gallery: ["/portfolio/art-01.webp", "/portfolio/art-02.webp", "/portfolio/art-03.webp"].map((src, i) => ({ src, label: luminaFeature.designImages[i] })),
      facts: luminaFeature.facts, story: [{ title: l("旅人与下一道美味", "The traveler and the next great meal", "旅人と次の一皿"), body: luminaFeature.story }],
      animationCaption: luminaFeature.mediaCaption,
    },
    cia: {
      id: "cia", number: "02", name: l("希娅·露奈尔", "Cia Lunelle", "シア・ルネール"), englishName: "CIA LUNELLE",
      role: l("星雨记录者", "The Archivist of Starfall", "星雨の記録者"),
      quote: l("如果世界已经忘记你，那么至少，我还记得你的声音。", "If the world has already forgotten you, then at least I still remember your voice.", "世界があなたを忘れてしまったのなら、せめて私は、あなたの声を覚えている。"),
      coverQuote: l(
        "我不会再把你们留在昨天了。去吧，这一次，不需要谁记住你，因为你确实来过这个世界。",
        "I won't keep you in yesterday anymore. Go. This time, no one needs to remember you—because you truly were here.",
        "もう、あなたたちを昨日に閉じ込めない。行って。今度は、誰かに覚えていてもらわなくていい。あなたは確かにこの世界にいたのだから。",
      ),
      medium: l("原创角色 · 立绘与设定", "Original character · Illustration & design", "オリジナルキャラクター・イラストと設定"),
      portrait: ciaAssets.portrait, avatar: ciaAssets.avatar,
      palette: ["#f8f5ee", "#e3d7d3", "#bdb6c9", "#7b708f", "#cdb99a"],
      gallery: [
        [ciaAssets.portrait, l("角色立绘", "Character portrait", "キャラクターイラスト")],
        [ciaAssets.sketch, l("立绘线稿", "Portrait line art", "イラスト線画")],
        [ciaAssets.costume, l("服装与配饰", "Costume & accessories", "衣装とアクセサリー")],
        [ciaAssets.star, l("未完成之星", "The Unfinished Star", "未完成の星")],
        [ciaAssets.noa, l("希娅与诺亚", "Cia & Noa", "シアとノア")],
        [ciaAssets.repose, l("片刻休憩", "A moment of repose", "ひとときの休息")],
        [ciaAssets.journey, l("雨中的旅人", "The traveler in the rain", "雨の中の旅人")],
        [ciaAssets.avatar, l("日常 · 茶歇", "Everyday life · Tea break", "日常・ティータイム")],
      ].map(([src, label]) => ({ src, label })),
      facts: [
        [l("曾经的职责", "Former role", "かつての役割"), l("月穹剧院的幕后记录者，整理剧本、记录演出，保管尚未完成的作品。", "Backstage archivist at Lunarium, preserving scripts, performances, and unfinished works.", "月穹劇場の舞台裏で脚本、公演、未完成の作品を記録していた。")],
        [l("视觉特征", "Visual identity", "外見の特徴"), l("银紫长发、白色长裙、星形发饰、腰间月牙与紫色晶石。", "Silver-lilac hair, a long white dress, star ornaments, a crescent at her waist, and violet crystals.", "銀紫色の長髪、白いドレス、星形の髪飾り、腰の三日月と紫の水晶。")],
        [l("记录内容", "What she preserves", "記録するもの"), l("声音、记忆、情绪、习惯、梦想，以及未完成的动作。", "Voices, memories, emotions, habits, dreams, and gestures left unfinished.", "声、記憶、感情、習慣、夢、そして未完の動作。")],
        [l("能力本质", "Her true ability", "能力の本質"), l("让世界相信某件事仍然存在。记忆的再现，并不等于复活。", "Making the world believe something still exists. Manifesting memories is not resurrection.", "何かがまだ存在すると世界に信じさせる。記憶の再現は蘇生ではない。")],
      ],
      nodes: [
        { image: ciaAssets.portrait, title: l("残响", "Echoes", "残響"), subtitle: l("存在的最后信息", "The last traces of existence", "存在の最後の情報"), body: l("每颗晶石都保存着一个人留在世界上的最后信息。希娅能让残响短暂地在现实中重现；他们会说话、微笑，也保有过去的习惯。但那不是复活，而是记忆留下的回声。", "Each crystal holds the final information a person left in the world. Cia can briefly manifest these Echoes: they speak, smile, and retain familiar habits. Yet this is not resurrection—only the reverberation of memory.", "水晶には一人の人間が最後に残した情報が保存されている。シアは残響を一時的に現実へ再現できる。彼らは話し、微笑み、かつての習慣も持つ。しかし蘇生ではなく、記憶のこだまである。") },
        { image: ciaAssets.noa, title: l("诺亚", "Noa", "ノア"), subtitle: l("再次飞向天空的愿望", "A wish to fly again", "もう一度空へ飛ぶ願い"), body: l("诺亚也是残响，来自静默星雨中死去的一个孩子。希娅没能保存完整的人格，只留下“想再次飞向天空”的愿望。愿望化作白鸟，它不会说话，也已忘记自己曾经是人类。直到最终消散时，它才第一次发出那个小女孩的声音。", "Noa is an Echo from a child who died in the Silent Starfall. Cia could not preserve her complete personality, only a wish to fly again. That wish became a white bird. Noa cannot speak and has forgotten being human. Only as it finally fades does the little girl’s voice emerge for the first time.", "ノアは静黙の星雨で亡くなった子どもの残響。完全な人格を保存できず、空へ飛びたいという願いだけが白い鳥になった。言葉を話さず、人間だったことも忘れている。最後に消えていく時、初めて少女の声を発する。") },
        { image: ciaAssets.star, title: l("未完成之星", "The Unfinished Star", "未完成の星"), subtitle: l("超过十万份残响的小型世界", "A world of over 100,000 Echoes", "十万を超える残響の小さな世界"), body: l("它并非人们最初猜测的武器，而是储存超过十万份残响的小型世界。城市、街道、剧院与天气存在于其中；居民保有记忆、继续生活、建立新的关系，甚至不知道自己已经死亡。希娅每天进入，却一直没有告诉他们真相。", "Mistaken at first for a weapon, it is a small world containing more than one hundred thousand Echoes. It has cities, streets, a theater, and weather. Its inhabitants retain memories, form relationships, and may not know they have died. Cia visits daily, withholding that truth.", "当初は武器と思われたが、十万を超える残響を保存する小さな世界である。都市、街路、劇場、天候があり、住人は記憶を持ち、新たな関係を築き、死を知らずに暮らすこともある。シアは毎日訪れながら真実を伝えずにいる。") },
      ],
    },
  };
}
