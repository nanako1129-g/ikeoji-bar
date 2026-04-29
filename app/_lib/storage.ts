import {
  DEFAULT_MASTER_ID,
  type ChatMessage,
  type MasterId,
} from "./constants";

const KEY = "ikeoji-bar:session:v1";

/** 改ざん・肥大化したセッションでも UI が破綻しないように上限する */
const MAX_STORED_MESSAGES = 150;
const MAX_STORED_TEXT_CHARS = 8000;

const VALID_MASTER_IDS = new Set<MasterId>([
  "ikeoji",
  "young_bartender",
  "muscle",
  "okami",
  "choiwaru",
]);

function sanitizeMasterId(raw: unknown): MasterId {
  if (typeof raw !== "string" || !VALID_MASTER_IDS.has(raw as MasterId)) {
    return DEFAULT_MASTER_ID;
  }
  return raw === "muscle" ? "young_bartender" : (raw as MasterId);
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_STORED_MESSAGES)
    .flatMap((m, i): ChatMessage[] => {
      if (!m || typeof m !== "object") return [];
      const item = m as Partial<ChatMessage>;
      const role = item.role === "user" || item.role === "master" ? item.role : null;
      const text =
        typeof item.text === "string"
          ? item.text.slice(0, MAX_STORED_TEXT_CHARS).trim()
          : "";
      const id =
        typeof item.id === "string"
          ? item.id.slice(0, 160)
          : `restored-${i}-${Date.now()}`;
      if (!role || text.length === 0) return [];
      return [{ id, role, text }];
    });
}

export type StoredSession = {
  drinkCount: number;
  messages: ChatMessage[];
  masterId: MasterId;
  bgmEnabled: boolean;
  // v1 のときは保存されていなかったので optional。無い場合は画面上の既定（声オフ）を使う。
  voiceEnabled?: boolean;
  savedAt: number;
};

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.messages)) return null;
    const drinkCount =
      typeof parsed.drinkCount === "number" && Number.isFinite(parsed.drinkCount)
        ? Math.max(0, Math.min(99999, Math.floor(parsed.drinkCount)))
        : 0;
    const masterId = sanitizeMasterId(parsed.masterId);
    const messages = sanitizeMessages(parsed.messages);
    const bgmEnabled =
      typeof parsed.bgmEnabled === "boolean" ? parsed.bgmEnabled : false;
    const voiceEnabled =
      typeof parsed.voiceEnabled === "boolean"
        ? parsed.voiceEnabled
        : undefined;
    const savedAt =
      typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
        ? parsed.savedAt
        : Date.now();
    return {
      drinkCount,
      messages,
      masterId,
      bgmEnabled,
      voiceEnabled,
      savedAt,
    };
  } catch {
    return null;
  }
}

export function saveSession(data: Omit<StoredSession, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...data, savedAt: Date.now() }),
    );
  } catch {
    /* ストレージ容量オーバー等は黙殺 */
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

// ===== 音声（TTS）のお気に入り =====

const VOICE_KEY = "ikeoji-bar:voice:v2";

export type VoiceEngine = "webspeech" | "voicevox";

export type StoredVoicePref = {
  engine: VoiceEngine;
  // 共通表示用
  name: string;
  // webspeech 用
  voiceURI?: string;
  lang?: string;
  pitch: number; // webspeech: 0.5-1.5 / voicevox: pitchScale -0.15〜0.15
  rate: number; // webspeech: 0.5-1.5 / voicevox: speedScale 0.5-2.0
  // voicevox 用
  speakerId?: number;
  speakerName?: string;
  styleName?: string;
  engineUrl?: string;
};

export function loadVoicePref(): StoredVoicePref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VOICE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredVoicePref;
    if (!p || typeof p !== "object") return null;
    if (p.engine === "voicevox") {
      if (typeof p.speakerId !== "number") return null;
    } else if (p.engine === "webspeech") {
      if (!p.voiceURI) return null;
    } else {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function saveVoicePref(pref: StoredVoicePref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOICE_KEY, JSON.stringify(pref));
  } catch {
    /* noop */
  }
}

export function clearVoicePref(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VOICE_KEY);
  } catch {
    /* noop */
  }
}
