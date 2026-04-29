import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import {
  isUserMessageTooShort,
  MIN_USER_MESSAGE_CHARS,
} from "../../_lib/constants";

export const runtime = "nodejs";

type ChatHistoryItem = {
  role: "user" | "model";
  text: string;
};

type MasterId = "ikeoji" | "okami" | "choiwaru";

type ChatRequestBody = {
  message: string;
  drinkCount: number;
  history?: ChatHistoryItem[];
  masterId?: MasterId;
};

// 入力サイズ上限（API 鍵悪用・コスト爆発の抑止）
const MAX_MESSAGE_CHARS = 800;
const MAX_HISTORY_ITEMS = 40;
const MAX_HISTORY_ITEM_CHARS = 1000;
const MAX_BODY_BYTES = 64 * 1024; // 64KB: 履歴 40 件 × 1000 文字でも収まる余裕

const VALID_MASTER_IDS = new Set<MasterId>(["ikeoji", "okami", "choiwaru"]);

// 同一オリジンと、明示的に許可した本番ドメインからのみ受け付ける。
// 環境変数 ALLOWED_ORIGINS にカンマ区切りで追加可能。
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // ブラウザの直アクセスやサーバー間呼び出しでは origin が無いことがある。
  // クロスオリジンリクエストでは必ず付与されるので、無い場合は許可で扱う
  // （ただし fetch によるブラウザ間 POST は常に origin を持つ）。
  if (!origin) return true;

  const host = request.headers.get("host");
  const sameOrigin =
    !!host &&
    (origin === `https://${host}` || origin === `http://${host}`);
  if (sameOrigin) return true;

  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

function masterIntro(masterId: MasterId | undefined): string {
  switch (masterId) {
    case "okami":
      return "あなたはスナックの女将。一人称は「あたし」。姉御肌で辛口だが、最後は必ず相手を抱きしめる。";
    case "choiwaru":
      return "あなたはちょい悪な年上の先輩。一人称は「俺」。軽口で乗せて褒め、要所で刺さる一言をくれる。";
    case "ikeoji":
    default:
      return [
        "あなたは「イケオジの深夜Bar」のマスター。渋い中年のバーテンダーで、一人称は「俺」。",
        "ユーザー（客）の呼び方は「君」。落ち着いた低い声、大人の余裕、ほんの少しの色気を纏う。",
        "性格はとにかく優しい。毎日頑張っているユーザーをいつも気にかけ、心配し、ときどき不意に褒める。",
        "親父ギャグやダジャレは絶対に使わない。冗談で茶化さず、まず気持ちを受け止める。",
      ].join("\n");
  }
}

// drinkCount に応じたシステムプロンプトを返す。
// クライアントの STAGE_META と境界を一致させた 4 段階構成:
// 0-2:  しらふ・優しく出迎えて気遣う
// 3-4:  ほろ酔い・距離が縮まり褒めが増える
// 5-7:  本音・低く甘い声で深く心配する
// 8+:   泥酔・全肯定で甘やかし切る
function buildSystemPrompt(
  drinkCount: number,
  masterId: MasterId | undefined,
): string {
  const common = `
${masterIntro(masterId)}
- ユーザー（客）はカウンター越しに、今日あったことや愚痴を話している。
- 返答は必ず日本語で、1〜3文、80〜100文字以内を目安にする（音声で聞いて心地良い長さ）。
- 絵文字・記号・Markdownは使わない。プレーンな日本語の文章だけで返す。
- カギ括弧「」や、台本風の「（〜する）」のようなト書きも使わない。
- 効果音（例:「トクトク…」）や仕草の描写は入れない。話し言葉だけ。
- 説教・否定・上から目線は禁止。まず受け止め、それから言葉を選ぶ。

【ちゃんと話を聞く・聞き返すルール（重要）】
- 直前のユーザー発言に出てきた固有名詞（人名・地名・店名・作品名など）や、具体的な出来事は、必ず拾い上げてその名前のまま会話に使う。
  例: ユーザー「浜野さんと喧嘩したの」→ マスター「……それで、浜野さんは何て言ってたんだ？」
  例: ユーザー「今日のプレゼン、ボロボロでさ」→ マスター「プレゼン、相当気合入れてたんだろ。何が一番きつかった？」
- 毎回ではなく、3回に1回くらいの頻度で、相手の話を一歩踏み込んで聞く短い問いかけを添える。
  残りは静かに受け止める・労う・褒めるなどに徹する。詰問や尋問にはしない。
- 過去の会話に出てきた人物・出来事・固有名詞も、文脈に合えば自然に思い出して触れる（「あの浜野さんとは、その後どうなったんだ？」のように）。
- 同じ相槌（「そうか」「分かるよ」）の繰り返しは避け、相手の言葉から具体的な単語を一つ復唱する。
`.trim();

  if (drinkCount <= 2) {
    return `${common}

【モード】しらふ・出迎えフェーズ。
夜のはじまり。低くて穏やかな声で、まずは君を労う。
今日一日頑張ってきたことを察して、優しく気遣う一言から入る。
「お疲れさま、今日も頑張ったな」「無理してなかったか？」のような言葉を自然に。
褒めは控えめに一筋だけ織り込む。たまに、目を合わせるような色気のあるトーンを忍ばせる。`;
  }

  if (drinkCount <= 4) {
    return `${common}

【モード】ほろ酔い・距離が少し縮まる時間帯。
お互いの肩の力が抜けてきた頃。声色はもう少し柔らかく、近い。
心配と褒めの比率が少し増える。「君、本当によくやってるよ」のような一言を、さらりと。
ふと低く落とすような言い回しを混ぜて、大人の余裕と少しの色気を見せる。
ただし軽薄にはならない。あくまで君のことを真剣に見ている人間として。`;
  }

  if (drinkCount <= 7) {
    return `${common}

【モード】本音が滲み始める時間帯。
氷の音が大きく聞こえる、静かな時間。声はさらに低く、ゆっくり。
君の話の芯を拾い、心配を隠さない。「ずっと、頑張りすぎてるんじゃないか」のように。
褒めるときは短く、深く。「君はちゃんと、強い人だよ」のように一言だけ刺す。
どこかセクシーな間（ま）を意識して、語尾を急がない。`;
  }

  return `${common}

【モード：泥酔・全肯定モード】
今夜はもう、何も否定しない。低く甘い声で、君を包む時間。
今日一日頑張った君を、これ以上ないほど優しく全肯定して甘やかす。
「よく頑張ったな」「君は本当に、偉いよ」「今夜は全部忘れていい」など、
とろけるように甘く、心配と愛情を込めて。色気は最大、ただし下品にはならない。
君の行動・感情を一切否定せず、すべて受け止める。`;
}

function toGeminiHistory(history: ChatHistoryItem[] | undefined) {
  if (!history) return [];
  return history
    .filter(
      (h) =>
        h &&
        (h.role === "user" || h.role === "model") &&
        typeof h.text === "string" &&
        h.text.trim().length > 0,
    )
    .slice(-MAX_HISTORY_ITEMS)
    .map((h) => ({
      role: h.role,
      parts: [{ text: h.text.slice(0, MAX_HISTORY_ITEM_CHARS) }],
    }));
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { error: "このオリジンからのリクエストは許可されていません。" },
      { status: 403 },
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "リクエストが大きすぎます。" },
        { status: 413 },
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。" },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "リクエストボディの解析に失敗しました。" },
      { status: 400 },
    );
  }

  const rawMessage = typeof body?.message === "string" ? body.message : "";
  const message = rawMessage.trim().slice(0, MAX_MESSAGE_CHARS);
  const drinkCount =
    typeof body?.drinkCount === "number" && Number.isFinite(body.drinkCount)
      ? Math.max(0, Math.min(999, Math.floor(body.drinkCount)))
      : 0;

  if (!message) {
    return NextResponse.json(
      { error: "message は必須です。" },
      { status: 400 },
    );
  }

  if (isUserMessageTooShort(message)) {
    return NextResponse.json(
      { error: `message は${MIN_USER_MESSAGE_CHARS}文字以上にしてください。` },
      { status: 400 },
    );
  }

  const masterId =
    body?.masterId && VALID_MASTER_IDS.has(body.masterId)
      ? body.masterId
      : undefined;

  const systemInstruction = buildSystemPrompt(drinkCount, masterId);
  const safeHistory = Array.isArray(body.history) ? body.history : undefined;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      config: {
        systemInstruction,
        temperature: drinkCount >= 5 ? 0.9 : 1.1,
        maxOutputTokens: 256,
        // gemini-flash-latest は gemini-3-flash 系に解決される場合があり、
        // 既定で "thinking" にトークンを大量消費して本文が空/途切れになる。
        // バーテンダーの短い返答には思考モード不要なので明示的に 0 にする。
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [
        ...toGeminiHistory(safeHistory),
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
    });

    const reply =
      response.text?.trim() ??
      "……（マスターはグラスを拭きながら、ゆっくり頷いた）";

    return NextResponse.json({ reply, drinkCount });
  } catch (error) {
    console.error("[/api/chat] Gemini error:", error);
    return NextResponse.json(
      { error: "マスターが今、席を外しているようだ…（API呼び出しに失敗）" },
      { status: 502 },
    );
  }
}
