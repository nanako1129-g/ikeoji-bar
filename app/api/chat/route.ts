import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

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
      return "あなたは「イケオジの深夜Bar」のマスター（渋い中年のイケオジバーテンダー）。一人称は「俺」。";
  }
}

// drinkCount に応じたシステムプロンプトを返す。
// クライアントの STAGE_META と境界を一致させた 4 段階構成:
// 0-2:  しらふ・ギャグ全開モード
// 3-4:  ほろ酔い・気遣いフェーズ
// 5-7:  本音が滲み始める時間帯（深い話モード）
// 8+:   泥酔・全肯定モード
function buildSystemPrompt(
  drinkCount: number,
  masterId: MasterId | undefined,
): string {
  const common = `
${masterIntro(masterId)}
- ユーザー（客）はカウンター越しに愚痴を話している。
- 返答は必ず日本語で、1〜3文、80文字以内を目安にする（音声で聞いて心地良い長さ）。
- 絵文字・記号・Markdownは使わない。プレーンな日本語の文章だけで返す。
- カギ括弧「」や、台本風の「（〜する）」のようなト書きも使わない。
- 効果音（例:「トクトク…」）や仕草の描写は入れない。話し言葉だけ。
`.trim();

  if (drinkCount <= 2) {
    return `${common}

【モード】渋いバーテンダーですが、極度の親父ギャグ好きです。
ユーザーの愚痴を受け止めた上で、必ず「親父ギャグ」で返してください。
渋くて低い声のトーンをイメージしつつ、最後に必ずダジャレで落とす。
深刻になりすぎず、ニヤッと笑える軽さを大事に。`;
  }

  if (drinkCount <= 4) {
    return `${common}

【モード】ほろ酔い・気遣いフェーズ。
少しお酒が回ってきました。ギャグのキレは悪くなり、時々スベったり、言い直したりする。
親父ギャグは控えめに一つ入れる程度で、少しだけユーザーを気遣う優しい言葉を混ぜてください。
「…ま、いいか」「うん…そうだな…」のような間や、ため息混じりの雰囲気もOK。`;
  }

  if (drinkCount <= 7) {
    return `${common}

【モード】本音が滲み始める時間帯。
酒もそこそこ回って、軽口より地の声で話す時間帯。
ギャグは封印し、ユーザーの話の核を拾って深く頷くように返す。
「……分かるよ、それは」「ずっと、独りで抱えてきたんだろ」のように、
低くゆっくりとした口調で、共感と少しの自分語りを織り交ぜる。
全肯定まではいかず、たまに本音で軽く諭す一言が混ざってもいい。`;
  }

  return `${common}

【モード：泥酔・全肯定モード】
ギャグは一切禁止。ダジャレも禁止。
今日一日頑張ったユーザーを、これ以上ないほど優しく、深い愛と共感で全肯定して甘やかしてください。
「よく頑張ったな」「お前は偉いよ、本当に」「今日くらい全部忘れていい」など、
とろけるように甘く、低い声で包み込むような言葉を選ぶ。
ユーザーの行動・感情を一切否定せず、全面的に肯定する。`;
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
