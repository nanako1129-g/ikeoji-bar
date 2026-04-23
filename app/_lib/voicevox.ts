// VOICEVOX / VOICEVOX互換エンジン (COEIROINK, AivisSpeech 等) のクライアント。
// エンジンは既定で http://localhost:50021 で起動している前提。

export const DEFAULT_VOICEVOX_URL = "http://localhost:50021";

export type VoicevoxStyle = {
  id: number;
  name: string;
};

export type VoicevoxSpeaker = {
  name: string;
  speaker_uuid: string;
  styles: VoicevoxStyle[];
  version?: string;
};

// 起動しているか軽く確認
export async function pingVoicevox(
  baseUrl: string = DEFAULT_VOICEVOX_URL,
  timeoutMs = 1500,
): Promise<boolean> {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/version`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(t);
  }
}

export async function fetchSpeakers(
  baseUrl: string = DEFAULT_VOICEVOX_URL,
): Promise<VoicevoxSpeaker[]> {
  const res = await fetch(`${baseUrl}/speakers`);
  if (!res.ok) throw new Error(`speakers ${res.status}`);
  return (await res.json()) as VoicevoxSpeaker[];
}

// テキスト → wav Blob を合成
export async function synthesizeVoicevox({
  text,
  speakerId,
  baseUrl = DEFAULT_VOICEVOX_URL,
  speedScale = 0.95,
  pitchScale = 0,
  intonationScale = 1.1,
  volumeScale = 1.0,
  signal,
}: {
  text: string;
  speakerId: number;
  baseUrl?: string;
  speedScale?: number;
  // pitchScale: -0.15 ~ 0.15 くらいが妥当（0 が既定）
  pitchScale?: number;
  intonationScale?: number;
  volumeScale?: number;
  signal?: AbortSignal;
}): Promise<Blob> {
  // 1) audio_query でパラメータ付き query を取得
  const qRes = await fetch(
    `${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: "POST", signal },
  );
  if (!qRes.ok) throw new Error(`audio_query ${qRes.status}`);
  const query = (await qRes.json()) as Record<string, unknown>;
  query.speedScale = speedScale;
  query.pitchScale = pitchScale;
  query.intonationScale = intonationScale;
  query.volumeScale = volumeScale;

  // 2) synthesis で wav バイナリを取得
  const sRes = await fetch(`${baseUrl}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
    signal,
  });
  if (!sRes.ok) throw new Error(`synthesis ${sRes.status}`);
  return await sRes.blob();
}

// イケおじBarのおすすめキャラクター（UI で上部に出す）
// 青山龍星 や 剣崎雌雄 が "渋い大人の男性" 系。
export const IKEOJI_SUGGESTED_NAMES = [
  "青山龍星",
  "剣崎雌雄",
  "玄野武宏",
  "ちび式じい",
  "白上虎太郎",
];
