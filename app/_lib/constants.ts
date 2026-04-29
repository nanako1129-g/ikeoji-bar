export type ChatMessage = {
  id: string;
  role: "user" | "master";
  text: string;
};

// muscle は旧セッション互換のみ（API でも受理）。UI は young_bartender を使う。
export type MasterId =
  | "ikeoji"
  | "young_bartender"
  | "muscle"
  | "okami"
  | "choiwaru";

export type MasterProfile = {
  id: MasterId;
  name: string;
  tagline: string;
  description: string;
  available: boolean;
};

export const MASTERS: MasterProfile[] = [
  {
    id: "ikeoji",
    name: "イケオジ",
    tagline: "低い声で、あなたを心配する人",
    description:
      "頑張り屋のあなたを、いつも静かに見ている。たまに褒めて、ふいに甘く落とす中年バーテンダー。",
    available: true,
  },
  {
    id: "young_bartender",
    name: "桜夜（おうや）",
    tagline: "おうや／このバーの年下バーテンダー",
    description:
      "やわらかい敬語と思いやりで迎える桜夜くん。グラスを磨くクールさと鍛えた体格のギャップ萌え。タイプは年上の女性。あなたへのほのかな恋心を、あたたかい丁寧語で包む。",
    available: true,
  },
  {
    id: "okami",
    name: "女将",
    tagline: "姐さん肌のスナックママ",
    description: "ちょっと辛口、でも最後は全部抱きしめてくれる。",
    available: false,
  },
  {
    id: "choiwaru",
    name: "ちょい悪先輩",
    tagline: "褒め上手な年上の遊び人",
    description: "軽口で乗せながら、要所で刺さる一言をくれるタイプ。",
    available: false,
  },
];

export const DEFAULT_MASTER_ID: MasterId = "ikeoji";

/** これ未満の文字数（trim 後）では会話 API を送らない（1文字の誤送・無駄消費の抑止） */
export const MIN_USER_MESSAGE_CHARS = 2;

export function isUserMessageTooShort(text: string): boolean {
  return text.trim().length < MIN_USER_MESSAGE_CHARS;
}

// 泥酔度ステージ（4段階）
export type DrinkStage = 0 | 1 | 2 | 3;

export function getDrinkStage(drinkCount: number): DrinkStage {
  if (drinkCount <= 2) return 0;
  if (drinkCount <= 4) return 1;
  if (drinkCount <= 7) return 2;
  return 3;
}

export const STAGE_META: Record<
  DrinkStage,
  { label: string; sub: string; transition: string }
> = {
  0: {
    label: "一杯目・しらふ",
    sub: "夜はまだ始まったばかり",
    transition: "――カウンターに、静かにグラスが置かれた。",
  },
  1: {
    label: "ほろ酔い",
    sub: "少しだけ呂律が怪しい",
    transition: "……マスター、少し酔ってきたようだ。",
  },
  2: {
    label: "いい感じに出来上がり",
    sub: "本音が滲み始める時間帯",
    transition: "――氷の音が、いつもより大きく響く。",
  },
  3: {
    label: "泥酔・全肯定モード",
    sub: "今夜はもう、何も否定しない",
    transition: "……今夜はもう、全部、俺が肯定してやる。",
  },
};

// ステージ別のおすすめ一杯
export type DrinkReco = {
  stage: DrinkStage;
  name: string;
  kana: string;
  note: string;
};

export const DRINK_RECOS: DrinkReco[] = [
  {
    stage: 0,
    name: "ハイボール",
    kana: "Highball",
    note: "口開けはこれ。のどを撫でるくらいの強さで。",
  },
  {
    stage: 0,
    name: "ジントニック",
    kana: "Gin & Tonic",
    note: "軽やかに、夜の入口に。",
  },
  {
    stage: 0,
    name: "ソルティ・ドッグ",
    kana: "Salty Dog",
    note: "桜夜くんおすすめ。縁の塩と柑橘が、最初の一杯をやわらげる。",
  },
  {
    stage: 1,
    name: "山崎 12年 ロック",
    kana: "Yamazaki 12y",
    note: "話したい時間には、少し甘めのシングルモルトを。",
  },
  {
    stage: 1,
    name: "ネグローニ",
    kana: "Negroni",
    note: "ほろ苦さが、そのため息に似合う。",
  },
  {
    stage: 1,
    name: "チェリー・ブランデー・ソーダ",
    kana: "Cherry Brandy Soda",
    note: "桜夜くんがよく勧める甘め。ほろ酔いにちょうどいい。",
  },
  {
    stage: 2,
    name: "ラフロイグ 10年",
    kana: "Laphroaig 10y",
    note: "本音を出したい夜に、スモーキーなやつを。",
  },
  {
    stage: 2,
    name: "オールドファッションド",
    kana: "Old Fashioned",
    note: "砂糖とビターで、昔の話を少しだけ。",
  },
  {
    stage: 2,
    name: "桜ソーダ（ノンアル寄り）",
    kana: "Sakura Soda",
    note: "淡い桃色。桜夜くんの『今夜はゆっくり』に合わせた一杯。",
  },
  {
    stage: 3,
    name: "ホットミルク・ウィスキー",
    kana: "Hot Milk Whisky",
    note: "もう無理はしないでいい。これで温まって帰ろう。",
  },
  {
    stage: 3,
    name: "水",
    kana: "Chaser",
    note: "今夜は、これで十分。ゆっくり帰るんだぞ。",
  },
  {
    stage: 3,
    name: "ホット・ミルクティー（ノンアル）",
    kana: "Hot Milk Tea",
    note: "桜夜くんおすすめの締め。泥酔のあとも胃をいたわる。",
  },
];

export function pickRecoForStage(stage: DrinkStage, seed: number): DrinkReco {
  const pool = DRINK_RECOS.filter((r) => r.stage === stage);
  if (pool.length === 0) return DRINK_RECOS[0];
  return pool[seed % pool.length];
}

// 無音時の自発発話プール（マスターからのひとこと）
export const NUDGE_MESSAGES: string[] = [
  "……グラスが進まないな。何かあったのか？",
  "無理に話さなくていい。ここに座ってるだけで充分だ。",
  "……今夜は、なんだか静かだな。",
  "一杯、注ぎ足そうか？",
  "……その沈黙も、悪くない。",
];

/** 桜夜くん選択時の無音ひとこと（やわらかい敬語） */
export const NUDGE_MESSAGES_YOUNG: string[] = [
  "……大丈夫ですか。グラスが進まなくても、それだけでもいいですよ。",
  "無理に話さなくていいです。……ここにいてくださるだけで、ボクはうれしいです。",
  "……今夜は、なんだか静かですね。それも、いいと思います。",
  "……もう一杯、軽めにお淹れしましょうか。",
  "……その沈黙も、悪くないです。ボク、そばにいますから。",
];

export function pickNudge(prev?: string, masterId?: MasterId): string {
  const young =
    masterId === "young_bartender" || masterId === "muscle";
  const source = young ? NUDGE_MESSAGES_YOUNG : NUDGE_MESSAGES;
  const pool = source.filter((m) => m !== prev);
  return pool[Math.floor(Math.random() * pool.length)] ?? source[0];
}
