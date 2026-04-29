/**
 * Web Speech API の日本語声は OS・ブラウザで名前がバラバラなので、
 * Bar のマスター（渋め・中大男性）に寄せるヒューリスティック選定。
 */

/** Web Speech の SpeechSynthesisUtterance.pitch に使う既定値（低め＝落ち着いた大人男性寄り） */
export const WEBSPEECH_DEFAULT_BAR_PITCH = 0.82;
/** ゆったりめで機械っぽさをやや抑える */
export const WEBSPEECH_DEFAULT_BAR_RATE = 0.91;

export function scoreJapaneseVoiceForBarMaster(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let s = 0;

  // 品質がよく聞こえやすい系
  if (/premium|enhanced|neural|natural|wavenet/.test(n)) s += 48;
  if (/siri/.test(n)) s += 38;

  // 男性・落ち着き・中年っぽいとされる名前（macOS / Chrome / Edge でよく見る）
  if (/otoya|male|grandpa|grandfather/.test(n)) s += 85;
  if (/ichiro|ichirō|itsuwa|oren|o-ren/.test(n)) s += 58;
  if (/eddy|reed|rocko|hattori|hatto|david|davido/.test(n)) s += 46;
  if (/tomoya|gentaro|takehiro|kyoto/.test(n)) s += 28;

  // 女性・少女寄りはマスター人格とずれるので強めに下げる
  if (
    /kyoko|nanami|female|woman|girl|haruka|ayumi|naomi|sayaka|akari|yuki\s*f|microsoft\s*zira/.test(
      n,
    )
  ) {
    s -= 130;
  }

  // ローカル音声はレイテンシと安定感がありやすい
  if (v.localService) s += 14;

  return s;
}

export function pickBestJapaneseVoiceForBarMaster(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const ja = voices.filter((v) => v.lang?.toLowerCase().startsWith("ja"));
  if (ja.length === 0) return undefined;
  return [...ja].sort(
    (a, b) =>
      scoreJapaneseVoiceForBarMaster(b) - scoreJapaneseVoiceForBarMaster(a),
  )[0];
}
