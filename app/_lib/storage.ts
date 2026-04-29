import type { ChatMessage, MasterId } from "./constants";

const KEY = "ikeoji-bar:session:v1";

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
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.messages)) return null;
    return parsed;
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
