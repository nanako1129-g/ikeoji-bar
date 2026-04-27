// 深夜Bar 用の軽量オーディオエンジン。
// - BGM: /sounds/bgm.mp3 があれば <audio> で再生、無ければ WebAudio で
//   ムーディなジャズ風アンビエンス（ピアノ + パッド + ベース + ビニール）を
//   手元で合成して流す。
// - SFX: WebAudio で氷の音やシェイカー音を合成。
//
// ユーザー操作のあとに init() を呼ぶ必要がある（自動再生ポリシー対策）。

type SfxKind = "ice" | "shaker" | "glassPlace" | "chimeUp" | "chimeDown";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

// BGM ファイルを差し替えたら数字を上げる（ブラウザ・CDN のキャッシュを避ける）
const BGM_FILE_QUERY = "?v=2";

// BGM 状態
let bgmElement: HTMLAudioElement | null = null;
let bgmSource: MediaElementAudioSourceNode | null = null;
let bgmLoadedUrl: string | null = null;
let bgmRunning = false;
let bgmTimers: number[] = [];
let bgmNoiseNodes: AudioNode[] = [];
/** stopBgm() フェード後の完全停止用タイマー */
let stopTimer: number | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(ctx.destination);
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.32; // ムーディに少し大きめだが全体が静音向けに作ってある
  bgmGain.connect(masterGain);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.55;
  sfxGain.connect(masterGain);
  return ctx;
}

export async function initAudio(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* noop */
    }
  }
}

// ----- BGM: mp3 があればそれを優先 -----

function bgmFileUrl(): string {
  return `/sounds/bgm.mp3${BGM_FILE_QUERY}`;
}

function teardownBgmElement(): void {
  if (bgmElement) {
    try {
      bgmElement.pause();
      bgmElement.removeAttribute("src");
      bgmElement.load();
    } catch {
      /* noop */
    }
  }
  bgmElement = null;
  try {
    bgmSource?.disconnect();
  } catch {
    /* noop */
  }
  bgmSource = null;
  bgmLoadedUrl = null;
}

/** フェードなしでファイルBGM・合成BGMを即停止（再開・中断時の二重鳴り防止） */
function stopBgmPlaybackImmediate(): void {
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  stopBgmDrone();
  if (bgmElement) {
    try {
      bgmElement.pause();
      bgmElement.currentTime = 0;
    } catch {
      /* noop */
    }
  }
}

async function tryLoadBgmElement(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const c = getCtx();
  if (!c || !bgmGain) return false;

  const url = bgmFileUrl();
  if (bgmElement && bgmLoadedUrl !== url) {
    teardownBgmElement();
  }
  if (bgmElement && bgmLoadedUrl === url) return true;

  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;
  } catch {
    return false;
  }

  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = "auto";
  audio.crossOrigin = "anonymous";
  audio.volume = 1;

  try {
    bgmSource = c.createMediaElementSource(audio);
    bgmSource.connect(bgmGain);
  } catch {
    return false;
  }
  bgmElement = audio;
  bgmLoadedUrl = url;
  return true;
}

// ----- BGM: ムーディな手づくりジャズ風アンビエンス -----
// Am を軸にした哀愁の漂うコード進行をゆっくりループする。
// 各バー（=コード1つ）は 8 秒。4 コードで 32 秒ループ。

const BAR_SEC = 8;

type ChordBar = {
  // コード構成音 (MIDI ノート番号)。低めに voicing して重くしないよう注意。
  chord: number[];
  // ベースのルート (低音)
  root: number;
  // この小節で使える旋律の音 (ペンタトニック中心)
  melody: number[];
};

// Am7 → Fmaj7 → Dm7 → E7  ……雨降りの夜みたいな進行
const PROGRESSION: ChordBar[] = [
  {
    chord: [57, 60, 64, 67], // A3 C4 E4 G4
    root: 45, // A2
    melody: [69, 72, 76, 79, 81], // A4 C5 E5 G5 A5
  },
  {
    chord: [53, 57, 60, 64], // F3 A3 C4 E4
    root: 41, // F2
    melody: [65, 69, 72, 74, 77], // F4 A4 C5 D5 F5
  },
  {
    chord: [50, 53, 57, 60], // D3 F3 A3 C4
    root: 38, // D2
    melody: [69, 72, 74, 77, 81], // A4 C5 D5 F5 A5
  },
  {
    chord: [52, 56, 59, 62], // E3 G#3 B3 D4 (E7)
    root: 40, // E2
    melody: [68, 71, 74, 76, 79], // G#4 B4 D5 E5 G5
  },
];

let progressionIndex = 0;

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// パッド: 長いサスティン、柔らかい三角波 + サイン
function schedulePad(bar: ChordBar, startTime: number, lengthSec: number) {
  const c = getCtx();
  if (!c || !bgmGain) return;

  bar.chord.forEach((midi, i) => {
    const freq = midiToFreq(midi);

    const osc = c.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = freq;
    // 声ごとに 1-4 セントのデチューンで温かみ
    osc.detune.value = (Math.random() - 0.5) * 8;

    const g = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100 + Math.random() * 400; // こもった感じ
    filter.Q.value = 0.7;

    osc.connect(g);
    g.connect(filter);
    filter.connect(bgmGain!);

    // 声ごとにレベルを微調整して低音はやや小さく
    const peak = 0.042 - i * 0.006;
    const attack = 2.4;
    const release = 2.4;

    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.exponentialRampToValueAtTime(peak, startTime + attack);
    g.gain.setValueAtTime(peak, startTime + lengthSec - release);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + lengthSec);

    osc.start(startTime);
    osc.stop(startTime + lengthSec + 0.3);
  });
}

// ベース: 短めのアタックを持ったサイン + 少しの倍音
function scheduleBassHit(midi: number, startTime: number, lengthSec: number) {
  const c = getCtx();
  if (!c || !bgmGain) return;

  const freq = midiToFreq(midi);
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  // 微かな倍音で存在感
  const osc2 = c.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = freq * 2;

  const g = c.createGain();
  const g2 = c.createGain();
  g2.gain.value = 0.15;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  filter.Q.value = 0.4;

  osc.connect(g);
  osc2.connect(g2);
  g2.connect(g);
  g.connect(filter);
  filter.connect(bgmGain!);

  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(0.35, startTime + 0.04);
  g.gain.exponentialRampToValueAtTime(0.12, startTime + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + lengthSec);

  osc.start(startTime);
  osc2.start(startTime);
  osc.stop(startTime + lengthSec + 0.1);
  osc2.stop(startTime + lengthSec + 0.1);
}

// ピアノ風: 速いアタック + ゆっくりした減衰 + LPフィルタ
function schedulePianoNote(midi: number, startTime: number) {
  const c = getCtx();
  if (!c || !bgmGain) return;

  const freq = midiToFreq(midi);

  const osc1 = c.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.value = freq;
  const osc2 = c.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = freq * 2.003; // ほのかに detune した 2 倍音
  const osc3 = c.createOscillator();
  osc3.type = "sine";
  osc3.frequency.value = freq * 3;

  const g1 = c.createGain();
  g1.gain.value = 1;
  const g2 = c.createGain();
  g2.gain.value = 0.35;
  const g3 = c.createGain();
  g3.gain.value = 0.12;

  const env = c.createGain();

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3600;
  filter.Q.value = 0.6;

  osc1.connect(g1);
  osc2.connect(g2);
  osc3.connect(g3);
  g1.connect(env);
  g2.connect(env);
  g3.connect(env);
  env.connect(filter);
  filter.connect(bgmGain!);

  const peak = 0.18;
  const duration = 2.4 + Math.random() * 1.2;

  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.exponentialRampToValueAtTime(peak, startTime + 0.008);
  env.gain.exponentialRampToValueAtTime(peak * 0.35, startTime + 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  // ピアノのフィルタも少し開いて、すぐ閉じる（倍音が減衰していく感じ）
  filter.frequency.setValueAtTime(3800, startTime);
  filter.frequency.exponentialRampToValueAtTime(1200, startTime + duration);

  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);
  osc1.stop(startTime + duration + 0.1);
  osc2.stop(startTime + duration + 0.1);
  osc3.stop(startTime + duration + 0.1);
}

// 常時走らせる薄いビニールノイズ（深夜ラウンジ感）
function startVinyl() {
  const c = getCtx();
  if (!c || !bgmGain) return;

  const bufferSize = c.sampleRate * 2;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  // ブラウン寄りのノイズ
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.4;

  const g = c.createGain();
  g.gain.value = 0.015; // かなり薄く

  src.connect(filter);
  filter.connect(g);
  g.connect(bgmGain);

  src.start();
  bgmNoiseNodes = [src, filter, g];
}

function stopVinyl() {
  bgmNoiseNodes.forEach((n) => {
    try {
      if ("stop" in n && typeof (n as AudioScheduledSourceNode).stop === "function") {
        (n as AudioScheduledSourceNode).stop();
      }
      n.disconnect();
    } catch {
      /* noop */
    }
  });
  bgmNoiseNodes = [];
}

function scheduleBar(startTime: number) {
  const bar = PROGRESSION[progressionIndex % PROGRESSION.length];
  progressionIndex++;

  // パッド（小節いっぱい + 少しの overlap でつなぎが滑らかに）
  schedulePad(bar, startTime, BAR_SEC + 1.5);

  // ベース: 小節頭とハーフで
  scheduleBassHit(bar.root, startTime + 0.02, 2.0);
  scheduleBassHit(bar.root + 7, startTime + BAR_SEC / 2 + 0.05, 1.8);

  // ピアノ旋律: 2〜4 音を小節内にばらまく（ランダムにスキップすることも）
  const noteCount = 2 + Math.floor(Math.random() * 3);
  const gridStep = BAR_SEC / (noteCount + 1);
  for (let i = 0; i < noteCount; i++) {
    if (Math.random() < 0.22) continue; // たまに休符
    const t = startTime + gridStep * (i + 1) + (Math.random() - 0.5) * 0.4;
    const note = bar.melody[Math.floor(Math.random() * bar.melody.length)];
    // 20% の確率でオクターブ上
    const octaved = Math.random() < 0.2 ? note + 12 : note;
    schedulePianoNote(octaved, Math.max(t, startTime + 0.1));
  }
}

function startBgmDrone() {
  const c = getCtx();
  if (!c) return;
  if (bgmRunning) return;
  bgmRunning = true;
  progressionIndex = 0;

  startVinyl();

  // 最初の小節をすぐ、次の小節を定期的にスケジュール
  let nextStart = c.currentTime + 0.25;
  scheduleBar(nextStart);
  nextStart += BAR_SEC;

  const tick = () => {
    if (!bgmRunning) return;
    const cc = getCtx();
    if (!cc) return;
    // ルックアヘッド: 現在時刻 + 1.5s 以内なら次の小節を予約
    while (nextStart < cc.currentTime + 1.5) {
      scheduleBar(nextStart);
      nextStart += BAR_SEC;
    }
    bgmTimers.push(window.setTimeout(tick, 1000));
  };
  tick();
}

function stopBgmDrone() {
  bgmRunning = false;
  bgmTimers.forEach((t) => window.clearTimeout(t));
  bgmTimers = [];
  stopVinyl();
}

const BGM_LEVEL = 0.32;
const BGM_FADE_IN_SEC = 2.0;
const BGM_FADE_OUT_SEC = 1.2;

function fadeIn() {
  const c = getCtx();
  if (!c || !bgmGain) return;
  const now = c.currentTime;
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(Math.max(bgmGain.gain.value, 0.0001), now);
  bgmGain.gain.exponentialRampToValueAtTime(BGM_LEVEL, now + BGM_FADE_IN_SEC);
}

function fadeOut(): number {
  const c = getCtx();
  if (!c || !bgmGain) return 0;
  const now = c.currentTime;
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(Math.max(bgmGain.gain.value, 0.0001), now);
  bgmGain.gain.exponentialRampToValueAtTime(0.0001, now + BGM_FADE_OUT_SEC);
  return BGM_FADE_OUT_SEC * 1000;
}

export async function startBgm(): Promise<void> {
  await initAudio();
  const c = getCtx();
  if (!c) return;

  // 直前の stopBgm フェード待ちをキャンセルしただけだとドローン／要素が残るため、
  // 必ず同期で止めてからどちらか一方だけを開始する（iOS で play 成否が変わる場合も含む）。
  stopBgmPlaybackImmediate();

  const hasFile = await tryLoadBgmElement();
  if (hasFile && bgmElement) {
    try {
      await bgmElement.play();
      fadeIn();
      return;
    } catch {
      try {
        bgmElement.pause();
        bgmElement.currentTime = 0;
      } catch {
        /* noop */
      }
    }
  }
  startBgmDrone();
  fadeIn();
}

export function stopBgm(): void {
  const fadeMs = fadeOut();

  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
  }
  stopTimer = window.setTimeout(() => {
    stopTimer = null;
    stopBgmPlaybackImmediate();
  }, fadeMs + 80);
}

// 互換用（ミュート相当）。UI からは startBgm/stopBgm を使うことを推奨。
export function setBgmMuted(muted: boolean): void {
  if (muted) {
    fadeOut();
  } else {
    fadeIn();
  }
}

// ----- SFX -----

function adsr(
  gain: GainNode,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  peak = 1,
) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(sustain, 0.0001),
    t + attack + decay,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    t + attack + decay + release,
  );
}

function makeNoiseBuffer(durationSec: number) {
  const c = getCtx();
  if (!c) return null;
  const buffer = c.createBuffer(1, c.sampleRate * durationSec, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.6;
  }
  return buffer;
}

function playIceClink() {
  const c = getCtx();
  if (!c || !sfxGain) return;

  [2600, 3400].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq + (Math.random() - 0.5) * 120;
    const g = c.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(sfxGain!);
    adsr(g, 0.002, 0.04, 0.02, 0.25 + i * 0.05, 0.5);
    osc.start();
    osc.stop(c.currentTime + 0.5);
  });
}

function playShaker() {
  const c = getCtx();
  if (!c || !sfxGain) return;
  const buf = makeNoiseBuffer(0.5);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3200;
  const g = c.createGain();
  src.connect(hp);
  hp.connect(g);
  g.connect(sfxGain);
  adsr(g, 0.01, 0.08, 0.08, 0.25, 0.35);
  src.start();
  src.stop(c.currentTime + 0.5);
}

function playGlassPlace() {
  const c = getCtx();
  if (!c || !sfxGain) return;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 180;
  const g = c.createGain();
  osc.connect(g);
  g.connect(sfxGain);
  adsr(g, 0.005, 0.08, 0.02, 0.3, 0.6);
  osc.start();
  osc.stop(c.currentTime + 0.45);

  const buf = makeNoiseBuffer(0.08);
  if (buf) {
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const gn = c.createGain();
    src.connect(lp);
    lp.connect(gn);
    gn.connect(sfxGain);
    adsr(gn, 0.002, 0.04, 0.01, 0.08, 0.4);
    src.start();
    src.stop(c.currentTime + 0.1);
  }
}

function playChime(direction: "up" | "down") {
  const c = getCtx();
  if (!c || !sfxGain) return;
  const notes =
    direction === "up" ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = c.createGain();
    osc.connect(g);
    g.connect(sfxGain!);
    const t = c.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

export function playSfx(kind: SfxKind): void {
  initAudio();
  switch (kind) {
    case "ice":
      playIceClink();
      break;
    case "shaker":
      playShaker();
      break;
    case "glassPlace":
      playGlassPlace();
      break;
    case "chimeUp":
      playChime("up");
      break;
    case "chimeDown":
      playChime("down");
      break;
  }
}
