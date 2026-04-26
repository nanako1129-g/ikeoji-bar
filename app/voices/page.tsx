"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearVoicePref,
  loadVoicePref,
  saveVoicePref,
  type StoredVoicePref,
} from "../_lib/storage";
import {
  DEFAULT_VOICEVOX_URL,
  IKEOJI_SUGGESTED_NAMES,
  fetchSpeakers,
  pingVoicevox,
  synthesizeVoicevox,
  type VoicevoxSpeaker,
} from "../_lib/voicevox";

const SAMPLE_TEXT =
  "いらっしゃい。今夜は冷えるな。まずは一杯、どうだい？　今日あったこと、ゆっくり聞かせてくれ。";

type Tab = "webspeech" | "voicevox";

export default function VoicesDebugPage() {
  const [tab, setTab] = useState<Tab>("webspeech");
  const [savedPref, setSavedPref] = useState<StoredVoicePref | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [text, setText] = useState(SAMPLE_TEXT);

  const showHint = useCallback((msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 2800);
  }, []);

  useEffect(() => {
    const pref = loadVoicePref();
    if (pref) {
      setSavedPref(pref);
      setTab(pref.engine);
    }
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-black px-4 py-8 text-[color:var(--color-bar-cream)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[color:var(--color-bar-gold)]">
          音声プレビュー
        </h1>
        <Link
          href="/"
          className="rounded-full border border-[color:var(--color-bar-gold)]/40 px-3 py-1 text-xs text-[color:var(--color-bar-gold-soft)]"
        >
          ← Barに戻る
        </Link>
      </div>

      {savedPref && (
        <div className="mt-3 rounded border border-[color:var(--color-bar-gold)]/40 bg-[color:var(--color-bar-gold)]/10 p-3 text-xs text-[color:var(--color-bar-gold-soft)]">
          現在使用中：<span className="font-semibold">{savedPref.name}</span>
          <span className="mx-2 opacity-50">|</span>
          {savedPref.engine === "voicevox" ? "VOICEVOX" : "ブラウザ内蔵"}
          <button
            type="button"
            onClick={() => {
              clearVoicePref();
              setSavedPref(null);
              showHint("保存を解除した（自動選択に戻る）");
            }}
            className="ml-3 rounded border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200"
          >
            解除
          </button>
        </div>
      )}

      {hint && (
        <div className="mt-3 rounded border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {hint}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("webspeech")}
          className={`rounded-full px-4 py-1.5 text-xs transition ${
            tab === "webspeech"
              ? "bg-[color:var(--color-bar-gold)] text-[color:var(--color-bar-black)]"
              : "border border-white/20 text-[color:var(--color-bar-cream)]/70"
          }`}
        >
          ブラウザ内蔵（無料・即）
        </button>
        <button
          type="button"
          onClick={() => setTab("voicevox")}
          className={`rounded-full px-4 py-1.5 text-xs transition ${
            tab === "voicevox"
              ? "bg-[color:var(--color-bar-gold)] text-[color:var(--color-bar-black)]"
              : "border border-white/20 text-[color:var(--color-bar-cream)]/70"
          }`}
        >
          VOICEVOX（無料・高音質）
        </button>
      </div>

      <section className="mt-4">
        <label className="flex flex-col text-sm">
          読ませるセリフ
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="mt-1 rounded border border-white/20 bg-black/50 p-2 text-[color:var(--color-bar-cream)]"
          />
        </label>
      </section>

      {tab === "webspeech" ? (
        <WebSpeechTab
          text={text}
          savedURI={
            savedPref?.engine === "webspeech"
              ? (savedPref.voiceURI ?? null)
              : null
          }
          onSaved={(p) => {
            setSavedPref(p);
            showHint(`保存した：${p.name}`);
          }}
        />
      ) : (
        <VoicevoxTab
          text={text}
          savedSpeakerId={
            savedPref?.engine === "voicevox"
              ? (savedPref.speakerId ?? null)
              : null
          }
          onSaved={(p) => {
            setSavedPref(p);
            showHint(`保存した：${p.name}`);
          }}
        />
      )}
    </main>
  );
}

// ---------------- Web Speech API タブ ----------------

function WebSpeechTab({
  text,
  savedURI,
  onSaved,
}: {
  text: string;
  savedURI: string | null;
  onSaved: (p: StoredVoicePref) => void;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pitch, setPitch] = useState(0.9);
  const [rate, setRate] = useState(0.95);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const play = (voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.pitch = pitch;
    u.rate = rate;
    u.onstart = () => setPlaying(voice.voiceURI);
    u.onend = () => setPlaying(null);
    u.onerror = () => setPlaying(null);
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(null);
  };

  const save = (v: SpeechSynthesisVoice) => {
    const p: StoredVoicePref = {
      engine: "webspeech",
      name: v.name,
      voiceURI: v.voiceURI,
      lang: v.lang,
      pitch,
      rate,
    };
    saveVoicePref(p);
    onSaved(p);
  };

  const jaVoices = voices.filter((v) => v.lang?.startsWith("ja"));

  return (
    <>
      <section className="mt-6 rounded-xl border border-[color:var(--color-bar-gold)]/30 bg-black/40 p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col">
            pitch ({pitch.toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-48"
            />
          </label>
          <label className="flex flex-col">
            rate ({rate.toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-48"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={stop}
          className="mt-3 rounded border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs text-red-200"
        >
          ■ 止める
        </button>
      </section>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--color-bar-gold)]/80">
          日本語音声（{jaVoices.length} 件）
        </h2>
        <ul className="mt-3 space-y-2">
          {jaVoices.map((v) => {
            const isSaved = savedURI === v.voiceURI;
            return (
              <li
                key={v.voiceURI}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                  isSaved
                    ? "border-[color:var(--color-bar-gold)]/60 bg-[color:var(--color-bar-gold)]/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-xs text-[color:var(--color-bar-cream)]/50">
                      {v.lang}
                    </span>
                    {v.localService ? (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">
                        local
                      </span>
                    ) : (
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                        remote
                      </span>
                    )}
                    {isSaved && (
                      <span className="rounded bg-[color:var(--color-bar-gold)]/30 px-1.5 py-0.5 text-[10px] text-[color:var(--color-bar-gold)]">
                        ⭐ 使用中
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => play(v)}
                    className={`rounded border px-3 py-1 text-xs ${
                      playing === v.voiceURI
                        ? "border-[color:var(--color-bar-gold)] bg-[color:var(--color-bar-gold)]/20 text-[color:var(--color-bar-gold)]"
                        : "border-white/20 bg-black/40 text-[color:var(--color-bar-cream)]/90"
                    }`}
                  >
                    {playing === v.voiceURI ? "再生中" : "▶ 試聴"}
                  </button>
                  <button
                    type="button"
                    onClick={() => save(v)}
                    className="rounded border border-[color:var(--color-bar-gold)]/50 bg-[color:var(--color-bar-gold)]/10 px-3 py-1 text-xs text-[color:var(--color-bar-gold)]"
                  >
                    ⭐ この声を使う
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

// ---------------- VOICEVOX タブ ----------------

function VoicevoxTab({
  text,
  savedSpeakerId,
  onSaved,
}: {
  text: string;
  savedSpeakerId: number | null;
  onSaved: (p: StoredVoicePref) => void;
}) {
  const [engineUrl, setEngineUrl] = useState(DEFAULT_VOICEVOX_URL);
  const [status, setStatus] = useState<"checking" | "up" | "down">("checking");
  const [speakers, setSpeakers] = useState<VoicevoxSpeaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [speedScale, setSpeedScale] = useState(0.95);
  const [pitchScale, setPitchScale] = useState(-0.02);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* noop */
      }
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // ページ離脱時に未解放の URL を確実に始末する
  useEffect(() => {
    return releaseAudio;
  }, [releaseAudio]);

  const check = useCallback(async () => {
    setStatus("checking");
    setError(null);
    try {
      const ok = await pingVoicevox(engineUrl);
      if (!ok) {
        setStatus("down");
        return;
      }
      setStatus("up");
      setLoading(true);
      const sp = await fetchSpeakers(engineUrl);
      setSpeakers(sp);
    } catch (e) {
      setStatus("down");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [engineUrl]);

  useEffect(() => {
    void check();
  }, [check]);

  const play = async (_speaker: VoicevoxSpeaker, style: VoicevoxStyleLike) => {
    try {
      releaseAudio();
      setPlayingId(style.id);
      const blob = await synthesizeVoicevox({
        text,
        speakerId: style.id,
        baseUrl: engineUrl,
        speedScale,
        pitchScale,
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      const cleanup = () => {
        setPlayingId(null);
        if (audioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
        }
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    } catch (e) {
      setPlayingId(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = (speaker: VoicevoxSpeaker, style: VoicevoxStyleLike) => {
    const p: StoredVoicePref = {
      engine: "voicevox",
      name: `${speaker.name}（${style.name}）`,
      speakerId: style.id,
      speakerName: speaker.name,
      styleName: style.name,
      pitch: pitchScale,
      rate: speedScale,
      engineUrl,
    };
    saveVoicePref(p);
    onSaved(p);
  };

  // 「渋い大人男性」を優先表示
  const suggested = speakers.filter((s) =>
    IKEOJI_SUGGESTED_NAMES.includes(s.name),
  );
  const others = speakers.filter(
    (s) => !IKEOJI_SUGGESTED_NAMES.includes(s.name),
  );

  return (
    <>
      <section className="mt-6 rounded-xl border border-[color:var(--color-bar-gold)]/30 bg-black/40 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-[color:var(--color-bar-cream)]/70">
            エンジンURL
          </span>
          <input
            type="text"
            value={engineUrl}
            onChange={(e) => setEngineUrl(e.target.value)}
            className="min-w-[220px] rounded border border-white/20 bg-black/50 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={check}
            className="rounded border border-[color:var(--color-bar-gold)]/50 bg-[color:var(--color-bar-gold)]/10 px-3 py-1 text-xs text-[color:var(--color-bar-gold)]"
          >
            再チェック
          </button>
          <span
            className={`text-xs ${
              status === "up"
                ? "text-emerald-300"
                : status === "down"
                  ? "text-red-300"
                  : "text-[color:var(--color-bar-cream)]/50"
            }`}
          >
            {status === "up"
              ? "● 起動中"
              : status === "down"
                ? "● 接続できない"
                : "確認中…"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col">
            速さ speedScale ({speedScale.toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={speedScale}
              onChange={(e) => setSpeedScale(parseFloat(e.target.value))}
              className="w-48"
            />
          </label>
          <label className="flex flex-col">
            高さ pitchScale ({pitchScale.toFixed(2)})
            <input
              type="range"
              min={-0.15}
              max={0.15}
              step={0.01}
              value={pitchScale}
              onChange={(e) => setPitchScale(parseFloat(e.target.value))}
              className="w-48"
            />
          </label>
        </div>
      </section>

      {status === "down" && (
        <section className="mt-6 rounded-xl border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-100">
          <p className="font-semibold">VOICEVOX エンジンに繋がらなかった。</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
            <li>
              <a
                href="https://voicevox.hiroshiba.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-bar-gold)] underline"
              >
                VOICEVOX 公式サイト
              </a>{" "}
              から Mac 版を DL → インストール → 起動
            </li>
            <li>
              アプリが立ち上がると内部で {DEFAULT_VOICEVOX_URL}{" "}
              にAPIが立つ（自動）
            </li>
            <li>
              この画面の「再チェック」を押す
              → 緑の「● 起動中」に変わったらOK
            </li>
          </ol>
          {error && <p className="mt-2 text-xs opacity-80">詳細: {error}</p>}
        </section>
      )}

      {status === "up" && (
        <>
          {loading && (
            <p className="mt-4 text-xs text-[color:var(--color-bar-cream)]/60">
              話者一覧を取得中…
            </p>
          )}

          {suggested.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm uppercase tracking-widest text-[color:var(--color-bar-gold)]/80">
                ⭐ イケおじBar おすすめ
              </h2>
              <SpeakerList
                list={suggested}
                savedSpeakerId={savedSpeakerId}
                playingId={playingId}
                onPlay={play}
                onSave={save}
              />
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-sm uppercase tracking-widest text-[color:var(--color-bar-gold)]/80">
              全話者（{others.length} 人）
            </h2>
            <SpeakerList
              list={others}
              savedSpeakerId={savedSpeakerId}
              playingId={playingId}
              onPlay={play}
              onSave={save}
            />
          </section>

          <p className="mt-6 text-[10px] text-[color:var(--color-bar-cream)]/40">
            ※
            合成音声はキャラクターごとに利用規約があります。配信・商用利用時は各キャラの規約を確認してクレジット表記を。
          </p>
        </>
      )}
    </>
  );
}

type VoicevoxStyleLike = { id: number; name: string };

function SpeakerList({
  list,
  savedSpeakerId,
  playingId,
  onPlay,
  onSave,
}: {
  list: VoicevoxSpeaker[];
  savedSpeakerId: number | null;
  playingId: number | null;
  onPlay: (s: VoicevoxSpeaker, style: VoicevoxStyleLike) => void;
  onSave: (s: VoicevoxSpeaker, style: VoicevoxStyleLike) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {list.map((sp) => (
        <li
          key={sp.speaker_uuid}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-3"
        >
          <div className="text-sm font-medium">{sp.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sp.styles.map((st) => {
              const isSaved = savedSpeakerId === st.id;
              const isPlaying = playingId === st.id;
              return (
                <div
                  key={st.id}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    isSaved
                      ? "border-[color:var(--color-bar-gold)]/60 bg-[color:var(--color-bar-gold)]/10"
                      : "border-white/15 bg-black/30"
                  }`}
                >
                  <span className="text-[color:var(--color-bar-cream)]/80">
                    {st.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPlay(sp, st)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      isPlaying
                        ? "bg-[color:var(--color-bar-gold)]/30 text-[color:var(--color-bar-gold)]"
                        : "bg-white/10 text-[color:var(--color-bar-cream)]/90"
                    }`}
                  >
                    {isPlaying ? "…" : "▶"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSave(sp, st)}
                    className="rounded bg-[color:var(--color-bar-gold)]/15 px-1.5 py-0.5 text-[10px] text-[color:var(--color-bar-gold)]"
                  >
                    ⭐
                  </button>
                  {isSaved && (
                    <span className="text-[10px] text-[color:var(--color-bar-gold)]">
                      使用中
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}
