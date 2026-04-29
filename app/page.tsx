"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import BgmToggle from "./_components/BgmToggle";
import ClosingModal from "./_components/ClosingModal";
import DrinkRecoCard from "./_components/DrinkRecoCard";
import LogDrawer from "./_components/LogDrawer";
import MasterSelect from "./_components/MasterSelect";
import StageTransition from "./_components/StageTransition";
import { initAudio, playSfx, preloadSfxFiles } from "./_lib/audio";
import {
  DEFAULT_MASTER_ID,
  getDrinkStage,
  isUserMessageTooShort,
  pickNudge,
  STAGE_META,
  type ChatMessage,
  type MasterId,
} from "./_lib/constants";
import { haptic } from "./_lib/haptic";
import {
  clearSession,
  loadSession,
  loadVoicePref,
  saveSession,
} from "./_lib/storage";
import {
  pickBestJapaneseVoiceForBarMaster,
  WEBSPEECH_DEFAULT_BAR_PITCH,
  WEBSPEECH_DEFAULT_BAR_RATE,
} from "./_lib/webSpeechVoice";
import { synthesizeVoicevox } from "./_lib/voicevox";

type MicState = "idle" | "listening" | "thinking" | "speaking";

const MIC_LABEL: Record<MicState, string> = {
  idle: "話しかける",
  listening: "聞いてるよ…",
  thinking: "マスター考え中…",
  speaking: "マスターが一言",
};

/** テキスト入力が既定のとき、アイドルはマイクを「音声でも」の補助として示す */
function micUiLabel(micState: MicState, textMode: boolean): string {
  if (micState === "idle" && textMode) return "音声でも話しかける";
  return MIC_LABEL[micState];
}

const STATE_BADGE: Record<MicState, string> = {
  idle: "カウンター越し",
  listening: "耳を傾けている",
  thinking: "一杯、注ぎながら",
  speaking: "語りかけ中",
};

const IDLE_NUDGE_MS = 30_000;

// マスター別の画像セット。pensive = idle 用（stage 0 のみで使う）。
// stage0〜3 = speaking/常時表示する各ステージの絵。
// 年下: master-young = カウンター越し／店内。master-young-beside = ほろ酔い〜（ステージ1〜3）、そばに座ったイメージ。
type MasterImageSet = {
  pensive: string;
  stage0: string;
  stage1: string;
  stage2: string;
  stage3: string;
};

const MASTER_IMAGE_SETS: Record<MasterId, MasterImageSet> = {
  ikeoji: {
    pensive: "/master-jiji-pensive.png",
    stage0: "/master-jiji.png",
    stage1: "/master-stage1.png",
    stage2: "/master-stage2.png",
    stage3: "/master-stage3.png",
  },
  young_bartender: {
    pensive: "/master-young.png",
    stage0: "/master-young.png",
    stage1: "/master-young-beside.png",
    stage2: "/master-young-beside.png",
    stage3: "/master-young-beside.png",
  },
  muscle: {
    pensive: "/master-young.png",
    stage0: "/master-young.png",
    stage1: "/master-young-beside.png",
    stage2: "/master-young-beside.png",
    stage3: "/master-young-beside.png",
  },
  okami: {
    pensive: "/master-jiji-pensive.png",
    stage0: "/master-jiji.png",
    stage1: "/master-stage1.png",
    stage2: "/master-stage2.png",
    stage3: "/master-stage3.png",
  },
  choiwaru: {
    pensive: "/master-jiji-pensive.png",
    stage0: "/master-jiji.png",
    stage1: "/master-stage1.png",
    stage2: "/master-stage2.png",
    stage3: "/master-stage3.png",
  },
};

const USER_MSG_TOO_SHORT_HINT =
  "……一文字だと、俺も何を返すか分からない。もう一呼吸、話してくれ。";

type Preset = {
  id: string;
  label: string;
  sub: string;
  message: string;
  icon: ReactNode;
};

const CheersIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <path
      d="M6 3h12l-1.2 7.2A5 5 0 0 1 12 14a5 5 0 0 1-4.8-3.8L6 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M12 14v6M8 20h8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const JokeIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M8 14c1 1.3 2.4 2 4 2s3-.7 4-2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="9" cy="10" r="1" fill="currentColor" />
    <circle cx="15" cy="10" r="1" fill="currentColor" />
  </svg>
);

export default function Page() {
  // ----- 基本状態 -----
  const [drinkCount, setDrinkCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "master",
      text: "いらっしゃい。今夜は何を飲む？……まあ、話を聞こうか。",
    },
  ]);
  const [interimText, setInterimText] = useState("");
  const [micState, setMicState] = useState<MicState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  // ----- 新機能用の状態 -----
  const [hydrated, setHydrated] = useState(false);
  const [masterId, setMasterId] = useState<MasterId>(DEFAULT_MASTER_ID);
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(false);
  // マスターの声 ON/OFF。OFF にすると喋らず、画面に字幕としてマスターの返事を出す。
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [logOpen, setLogOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [textMode, setTextMode] = useState(true);
  const [textDraft, setTextDraft] = useState("");
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const sendingRef = useRef<boolean>(false);
  const idleTimerRef = useRef<number | null>(null);
  const lastNudgeRef = useRef<string | undefined>(undefined);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  // 音声認識ハンドラから常に最新の sendMessage を呼べるようにする
  const sendMessageRef = useRef<(text: string) => Promise<void> | void>(
    () => undefined,
  );
  // speak() の中で「現在の voiceEnabled」を参照したいが、毎回 useCallback の依存に
  // 入れて作り直すと scheduleIdleNudge / sendMessage まで芋づる式に作り直しになる。
  // そこで ref で常に最新値を見るようにする。
  const voiceEnabledRef = useRef(voiceEnabled);

  // ----- localStorage からの復元 -----
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setDrinkCount(saved.drinkCount);
      if (saved.messages.length > 0) {
        setMessages([
          {
            id: "welcome-back",
            role: "master",
            text: "おかえり。……昨夜の続き、やるかい？",
          },
          ...saved.messages,
        ]);
      }
      setMasterId(
        saved.masterId === "muscle" ? "young_bartender" : saved.masterId,
      );
      setBgmEnabled(saved.bgmEnabled);
      // voiceEnabled が無い旧セッションは既定をそのまま（声オフ）。
      if (typeof saved.voiceEnabled === "boolean") {
        setVoiceEnabled(saved.voiceEnabled);
      }
    }
    setHydrated(true);
  }, []);

  // ----- 状態が変わるたびに localStorage に保存 -----
  useEffect(() => {
    if (!hydrated) return;
    saveSession({
      drinkCount,
      messages: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "welcome-back",
      ),
      masterId,
      bgmEnabled,
      voiceEnabled,
    });
  }, [hydrated, drinkCount, messages, masterId, bgmEnabled, voiceEnabled]);

  // ----- 音声認識 セットアップ -----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR =
      window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

    if (!SR || typeof window.speechSynthesis === "undefined") {
      setSupported(false);
      setTextMode(true);
      return;
    }

    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalText) finalTranscriptRef.current += finalText;
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setErrorText("……声が聞こえなかったみたいだ。もう一度どうぞ。");
      } else if (event.error === "not-allowed") {
        // ユーザーがマイク許可を拒否した／OS 側でブロックされている。
        // 文字モードに切り替えて続けられるようにする。
        setErrorText(
          "マイクが許可されていない。設定で許可するか、下の入力欄から文字でどうぞ。",
        );
        setTextMode(true);
      } else if (
        event.error === "network" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture"
      ) {
        // iOS Safari 等で頻発する音声認識サービスのエラー。
        // 復帰の見込みが薄いので即座に文字モードへ。
        setErrorText(
          "この端末では音声認識がうまく動かないようだ。下の入力欄から文字で話しかけてくれ。",
        );
        setTextMode(true);
      } else if (event.error !== "aborted") {
        setErrorText(
          `マイクで問題が起きた（${event.error}）。下の入力欄から文字でどうぞ。`,
        );
        setTextMode(true);
      }
      setMicState("idle");
    };

    recognition.onend = () => {
      const finalText = finalTranscriptRef.current.trim();
      setInterimText("");
      finalTranscriptRef.current = "";
      if (finalText) {
        void sendMessageRef.current(finalText);
      } else {
        setMicState((s) => (s === "listening" ? "idle" : s));
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, []);

  // 再生停止（両エンジン共通）
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = "";
      } catch {
        /* noop */
      }
      ttsAudioRef.current = null;
    }
    if (ttsAudioUrlRef.current) {
      URL.revokeObjectURL(ttsAudioUrlRef.current);
      ttsAudioUrlRef.current = null;
    }
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
  }, []);

  // VOICEVOX で合成して再生
  const speakViaVoicevox = useCallback(
    async (
      text: string,
      opts: {
        speakerId: number;
        speedScale: number;
        pitchScale: number;
        engineUrl?: string;
      },
    ): Promise<boolean> => {
      try {
        stopSpeaking();
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        const blob = await synthesizeVoicevox({
          text,
          speakerId: opts.speakerId,
          baseUrl: opts.engineUrl,
          speedScale: opts.speedScale,
          pitchScale: opts.pitchScale,
          signal: controller.signal,
        });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        ttsAudioRef.current = audio;
        ttsAudioUrlRef.current = url;
        audio.onplay = () => setMicState("speaking");
        const cleanup = () => {
          setMicState("idle");
          if (ttsAudioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            ttsAudioUrlRef.current = null;
          }
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        await audio.play();
        return true;
      } catch (e) {
        console.warn("VOICEVOX 合成に失敗。Web Speech API にフォールバック", e);
        return false;
      }
    },
    [stopSpeaking],
  );

  // Web Speech API で合成して再生
  const speakViaWebSpeech = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const pref = loadVoicePref();

    let chosen: SpeechSynthesisVoice | undefined =
      pref?.engine === "webspeech" && pref.voiceURI
        ? voices.find((v) => v.voiceURI === pref.voiceURI)
        : undefined;

    if (!chosen) {
      chosen = pickBestJapaneseVoiceForBarMaster(voices);
    }

    if (chosen) utter.voice = chosen;
    // Web Speech で明示保存済みならユーザー値、それ以外は「ナイスミドル寄せ」の既定（VOICEVOX失敗時のフォールバック含む）
    utter.pitch =
      pref?.engine === "webspeech" && typeof pref.pitch === "number"
        ? pref.pitch
        : WEBSPEECH_DEFAULT_BAR_PITCH;
    utter.rate =
      pref?.engine === "webspeech" && typeof pref.rate === "number"
        ? pref.rate
        : WEBSPEECH_DEFAULT_BAR_RATE;

    utter.onstart = () => setMicState("speaking");
    utter.onend = () => setMicState("idle");
    utter.onerror = () => setMicState("idle");

    window.speechSynthesis.speak(utter);
  }, []);

  // 統合 speak：保存された設定に応じて VOICEVOX or Web Speech を選択
  const speak = useCallback(
    (text: string) => {
      // 「マスターの声 OFF」になっていたら鳴らさない（字幕で読む運用のため）。
      // ここで return する場合、呼び出し元（sendMessage 等）は直前に
      // micState を "thinking" にしているので、そのままだと「考え中…」が
      // 永遠に続いてしまう。idle に戻して UI のロックを解く。
      if (!voiceEnabledRef.current) {
        setMicState((s) => (s === "thinking" || s === "speaking" ? "idle" : s));
        return;
      }
      const pref = loadVoicePref();
      if (
        pref?.engine === "voicevox" &&
        typeof pref.speakerId === "number"
      ) {
        void speakViaVoicevox(text, {
          speakerId: pref.speakerId,
          speedScale: pref.rate,
          pitchScale: pref.pitch,
          engineUrl: pref.engineUrl,
        }).then((ok) => {
          if (!ok) speakViaWebSpeech(text);
        });
        return;
      }
      speakViaWebSpeech(text);
    },
    [speakViaVoicevox, speakViaWebSpeech],
  );

  // voiceEnabled が変わったら ref を最新化。
  // OFF にした瞬間は再生中の音声を即座に止める。
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    if (!voiceEnabled) {
      stopSpeaking();
      // speaking 中に止めた場合の見た目を idle に戻す（onended が来ない可能性に備える）
      setMicState((s) => (s === "speaking" ? "idle" : s));
    }
  }, [voiceEnabled, stopSpeaking]);

  // ----- 字幕（声 OFF 時に表示するマスターの最新返答） -----
  const latestMasterText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "master") return messages[i].text;
    }
    return null;
  }, [messages]);

  // ----- API に送る履歴 -----
  const apiHistory = useMemo(
    () =>
      messages
        .filter((m) => m.id !== "welcome" && m.id !== "welcome-back")
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          text: m.text,
        })),
    [messages],
  );

  // ----- 無音タイマーのリセット -----
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleNudge = useCallback(() => {
    resetIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      if (sendingRef.current) return;
      if (micState === "listening" || micState === "thinking") return;
      const text = pickNudge(lastNudgeRef.current);
      lastNudgeRef.current = text;
      setMessages((prev) => [
        ...prev,
        { id: `nudge-${Date.now()}`, role: "master", text },
      ]);
      playSfx("glassPlace");
      haptic("tap");
      speak(text);
    }, IDLE_NUDGE_MS);
  }, [micState, resetIdleTimer, speak]);

  // 会話があるたびに無音タイマー再セット
  useEffect(() => {
    if (!hydrated) return;
    if (messages.length <= 1) return;
    scheduleIdleNudge();
    return resetIdleTimer;
  }, [messages, hydrated, scheduleIdleNudge, resetIdleTimer]);

  // ----- メッセージ送信 -----
  const sendMessage = useCallback(
    async (userText: string) => {
      // 無言（空・空白のみ）は API にも送らない。サーバーは拒否するが、ここで止める
      // と /api/chat への往復と「考え中」表示の誤作動を防げる（Gemini 消費もゼロ）。
      const trimmed = userText.trim();
      if (!trimmed) return;
      if (isUserMessageTooShort(trimmed)) {
        setErrorText(USER_MSG_TOO_SHORT_HINT);
        return;
      }

      if (sendingRef.current) return;
      sendingRef.current = true;
      resetIdleTimer();
      setErrorText(null);
      setMicState("thinking");
      void initAudio();
      preloadSfxFiles();
      playSfx("pourOnIce");
      haptic("confirm");

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            drinkCount,
            history: apiHistory,
            masterId,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { reply: string };
        const reply = data.reply ?? "……（マスターは静かに頷いた）";

        const masterMessage: ChatMessage = {
          id: `m-${Date.now()}`,
          role: "master",
          text: reply,
        };
        setMessages((prev) => [...prev, masterMessage]);
        setDrinkCount((c) => c + 1);
        playSfx("ice");
        speak(reply);
      } catch (error) {
        console.error(error);
        setErrorText(
          error instanceof Error
            ? `マスターが応えられなかった: ${error.message}`
            : "マスターが応えられなかった。",
        );
        setMicState("idle");
        haptic("warning");
      } finally {
        sendingRef.current = false;
      }
    },
    [apiHistory, drinkCount, masterId, resetIdleTimer, speak],
  );

  // 音声認識ハンドラ（初回マウント時に固定）から、毎レンダーで作り直される
  // 最新の sendMessage を呼べるようにする。
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleMicTap = useCallback(() => {
    if (!supported || micState === "thinking") return;
    void initAudio();
    preloadSfxFiles();
    resetIdleTimer();

    if (micState === "speaking") {
      stopSpeaking();
    }

    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (micState === "listening") {
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
      return;
    }

    setErrorText(null);
    setInterimText("");
    finalTranscriptRef.current = "";
    try {
      recognition.start();
      setMicState("listening");
      playSfx("ice");
      haptic("tap");
    } catch (err) {
      console.error(err);
      setErrorText("マイクの起動に失敗した。一度画面を更新してくれ。");
      setMicState("idle");
    }
  }, [micState, resetIdleTimer, stopSpeaking, supported]);

  const handlePreset = useCallback(
    (message: string) => {
      if (micState === "thinking") return;
      if (micState === "listening") {
        try {
          recognitionRef.current?.stop();
        } catch {
          /* noop */
        }
      }
      if (micState === "speaking") stopSpeaking();
      void sendMessage(message);
    },
    [micState, sendMessage, stopSpeaking],
  );

  const handleTextSubmit = useCallback(() => {
    const text = textDraft.trim();
    if (!text) return;
    if (isUserMessageTooShort(text)) {
      setErrorText(USER_MSG_TOO_SHORT_HINT);
      return;
    }
    if (micState === "thinking") return;
    if (micState === "listening") {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
    }
    if (micState === "speaking") stopSpeaking();
    setTextDraft("");
    void sendMessage(text);
  }, [micState, sendMessage, stopSpeaking, textDraft]);

  // お会計（夜の終わり）
  const handleCheckout = useCallback(() => {
    stopSpeaking();
    try {
      recognitionRef.current?.abort();
    } catch {
      /* noop */
    }
    playSfx("glassPlace");
    haptic("heavy");
    setClosingOpen(true);
  }, []);

  const handleCloseClosingModal = useCallback(() => {
    setClosingOpen(false);
    clearSession();
    setDrinkCount(0);
    setMessages([
      {
        id: "welcome",
        role: "master",
        text: "お帰り。……もう一杯、やろうか。",
      },
    ]);
    setMicState("idle");
    setErrorText(null);
    setInterimText("");
    lastNudgeRef.current = undefined;
  }, []);

  const drinkStage = getDrinkStage(drinkCount);
  const drunk = STAGE_META[drinkStage];
  const state = STATE_BADGE[micState];
  const masterImages = MASTER_IMAGE_SETS[masterId] ?? MASTER_IMAGE_SETS.ikeoji;
  const micLabelShown = micUiLabel(micState, textMode);

  const presets: Preset[] = [
    {
      id: "cheers",
      label: "乾杯",
      sub: "とりあえず一杯",
      message: "マスター、今日もお疲れ。とりあえず乾杯しようぜ。",
      icon: CheersIcon,
    },
    {
      id: "joke",
      label: "追いギャグ",
      sub: "もう一発",
      message: "マスター、もう一発、とっておきの親父ギャグ頼む。",
      icon: JokeIcon,
    },
  ];

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden">
      {/* 背景：ステージごとに 5 枚の絵を opacity で切り替え。
          ・stage 0: 考え顔 ↔ 笑顔（speaking）でクロスフェード（声OFFでもベースは pensive）
          ・stage 1〜3: そのステージ専用の絵を常時表示。speaking 中は少し明るく拡大して
            「語りかけている」ニュアンスを足す。
          ステージが上がる毎に絵が必ず切り替わるので、声 OFF でも画像進化が見える。 */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-black"
      >
        <div className="animate-bar-breath absolute inset-0">
          {/* stage 0 idle 用：考え顔 */}
          <Image
            src={masterImages.pensive}
            alt=""
            fill
            priority
            sizes="100vw"
            className={`object-cover object-center transition-[opacity,filter,transform] duration-1000 ease-in-out ${
              drinkStage === 0 && micState !== "speaking"
                ? micState === "listening"
                  ? "opacity-100 brightness-95 saturate-95"
                  : "opacity-100 brightness-90"
                : "opacity-0"
            }`}
          />
          {/* stage 0 speaking 用：柔らか笑顔 */}
          <Image
            src={masterImages.stage0}
            alt=""
            fill
            priority
            sizes="100vw"
            className={`object-cover object-center transition-[opacity,filter,transform] duration-1000 ease-in-out ${
              drinkStage === 0 && micState === "speaking"
                ? "scale-[1.015] opacity-100 brightness-110 saturate-110"
                : "opacity-0"
            }`}
          />
          {/* stage 1〜3：そのステージの絵を常時表示。speaking 中は少し明るく拡大 */}
          {[
            { stage: 1 as const, src: masterImages.stage1 },
            { stage: 2 as const, src: masterImages.stage2 },
            { stage: 3 as const, src: masterImages.stage3 },
          ].map(({ stage, src }) => {
            const active = drinkStage === stage;
            const speaking = active && micState === "speaking";
            return (
              <Image
                key={src}
                src={src}
                alt=""
                fill
                priority
                sizes="100vw"
                className={`object-cover object-center transition-[opacity,filter,transform] duration-1000 ease-in-out ${
                  active
                    ? speaking
                      ? "scale-[1.015] opacity-100 brightness-110 saturate-110"
                      : "opacity-100 brightness-90 saturate-95"
                    : "opacity-0"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* ランプのゆらぎ + ビネット（背景より上、コンテンツより下） */}
      <div
        aria-hidden
        className="animate-lamp pointer-events-none fixed -left-10 top-8 z-[1] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(224,168,74,0.45)_0%,transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-b from-black/60 via-transparent to-black/85"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[1] h-40 bg-gradient-to-b from-black/60 to-transparent"
      />

      {/* ヘッダー */}
      <header className="relative z-10 flex flex-col items-center gap-2.5 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex w-full items-center justify-between">
          <MasterSelect value={masterId} onChange={setMasterId} />

          <div className="flex items-center gap-2 rounded-full border border-[color:var(--color-bar-gold)]/30 bg-black/60 px-4 py-1.5 backdrop-blur-md">
            <span className="text-lg">🥃</span>
            <h1 className="text-[13px] font-semibold tracking-wide text-[color:var(--color-bar-cream)]">
              イケオジの深夜Bar
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setVoiceEnabled((v) => !v);
              }}
              aria-pressed={voiceEnabled}
              aria-label={voiceEnabled ? "マスターの声を切る" : "マスターの声を出す"}
              title={
                voiceEnabled
                  ? "マスターの声を切る（字幕モードへ）"
                  : "マスターの声を出す"
              }
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition active:scale-95 ${
                voiceEnabled
                  ? "border-[color:var(--color-bar-gold)]/70 bg-[color:var(--color-bar-gold)]/15 text-[color:var(--color-bar-gold)] shadow-[0_0_18px_rgba(212,175,55,0.35)]"
                  : "border-[color:var(--color-bar-gold)]/30 bg-black/50 text-[color:var(--color-bar-gold-soft)]/70"
              }`}
            >
              {voiceEnabled ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path
                    d="M4 10v4a1 1 0 0 0 1 1h3l4 3.5a1 1 0 0 0 1.6-.8V6.3A1 1 0 0 0 12 5.5L8 9H5a1 1 0 0 0-1 1z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path
                    d="M4 10v4a1 1 0 0 0 1 1h3l4 3.5a1 1 0 0 0 1.6-.8V6.3A1 1 0 0 0 12 5.5L8 9H5a1 1 0 0 0-1 1z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 9l5 6M22 9l-5 6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
            <BgmToggle
              initialEnabled={bgmEnabled}
              onChange={(next) => setBgmEnabled(next)}
            />
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setLogOpen(true);
              }}
              aria-label="今夜の記録を開く"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-bar-gold)]/30 bg-black/50 text-[color:var(--color-bar-gold-soft)] backdrop-blur transition active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                aria-hidden
              >
                <path
                  d="M5 4h12a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-3-2V6a2 2 0 0 1 2-2z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 9h8M8 13h8M8 17h5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--color-bar-gold)]/25 bg-black/55 px-3 py-1 backdrop-blur">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-3.5 w-3.5 text-[color:var(--color-bar-gold-soft)]"
              aria-hidden
            >
              <path
                d="M6 3h12l-1.2 7.2A5 5 0 0 1 12 14a5 5 0 0 1-4.8-3.8L6 3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M12 14v6M8 20h8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[11px] text-[color:var(--color-bar-cream)]/90">
              泥酔度{" "}
              <span className="font-semibold text-[color:var(--color-bar-cream)]">
                {drinkCount}
              </span>
              <span className="mx-1 text-[color:var(--color-bar-gold)]/40">
                |
              </span>
              <span className="text-[color:var(--color-bar-gold-soft)]">
                {drunk.label}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--color-bar-gold)]/25 bg-black/55 px-3 py-1 backdrop-blur">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                micState === "listening"
                  ? "bg-rose-400"
                  : micState === "thinking"
                    ? "bg-amber-300"
                    : micState === "speaking"
                      ? "bg-emerald-300"
                      : "bg-[color:var(--color-bar-gold-soft)]"
              }`}
            />
            <span className="text-[11px] text-[color:var(--color-bar-cream)]/90">
              マスター
              <span className="mx-1 text-[color:var(--color-bar-gold)]/40">
                |
              </span>
              <span className="font-semibold text-[color:var(--color-bar-gold-soft)]">
                {state}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* 中央スペース（イケオジの表情を見せる） */}
      <section className="flex-1" />

      {/* 下部オーバーレイ群（字幕は出さず、マスターの顔をなるべく見せる） */}
      <section className="relative z-10 flex flex-col items-center gap-1.5 px-3 pb-1">
        {/* エラー時のみ出す小バナー */}
        {errorText && (
          <p className="w-full max-w-sm rounded-xl border border-red-700/40 bg-red-900/40 px-3 py-1.5 text-center text-[11px] text-red-200 backdrop-blur">
            {errorText}
          </p>
        )}
        {!supported && (
          <p className="w-full max-w-sm rounded-xl border border-amber-700/40 bg-amber-900/40 px-3 py-1.5 text-center text-[11px] text-amber-200 backdrop-blur">
            このブラウザは音声入力に対応していないようだ。下の「文字で話す」で続けるか、Chrome
            か Safari の最新版で開いてくれ。
          </p>
        )}

        {/* 字幕：マスターの声 OFF のときだけ、最新の返答を文字で表示 */}
        {!voiceEnabled && latestMasterText && (
          <div
            aria-live="polite"
            className="w-full max-w-sm rounded-2xl border border-[color:var(--color-bar-gold)]/35 bg-black/65 px-4 py-2.5 text-[13px] leading-relaxed text-[color:var(--color-bar-cream)] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur"
          >
            <span className="mr-2 text-[10px] tracking-[0.25em] text-[color:var(--color-bar-gold-soft)]">
              MASTER
            </span>
            <span>「{latestMasterText}」</span>
          </div>
        )}

        {/* チップ行: 文字で話す / お会計 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              setTextMode((v) => {
                const next = !v;
                if (next) {
                  window.setTimeout(() => textInputRef.current?.focus(), 30);
                }
                return next;
              });
            }}
            aria-pressed={textMode}
            className={`rounded-full border px-3 py-1 text-[10px] tracking-[0.25em] backdrop-blur transition active:scale-95 ${
              textMode
                ? "border-[color:var(--color-bar-gold)]/60 bg-[color:var(--color-bar-gold)]/15 text-[color:var(--color-bar-gold)]"
                : "border-[color:var(--color-bar-gold)]/25 bg-black/45 text-[color:var(--color-bar-cream)]/70 hover:text-[color:var(--color-bar-cream)]"
            }`}
          >
            ✍️ 文字で話す
          </button>
          <button
            type="button"
            onClick={handleCheckout}
            className="rounded-full border border-[color:var(--color-bar-gold)]/25 bg-black/45 px-3 py-1 text-[10px] tracking-[0.3em] text-[color:var(--color-bar-cream)]/60 backdrop-blur transition hover:text-[color:var(--color-bar-cream)] active:scale-95"
          >
            ……そろそろ、お会計を
          </button>
        </div>

        {/* 今夜のおすすめ（極小チップ） */}
        <DrinkRecoCard drinkCount={drinkCount} />

        {/* テキスト入力欄（textMode 時のみ） */}
        {textMode && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTextSubmit();
            }}
            className="flex w-full max-w-sm items-end gap-2 rounded-2xl border border-[color:var(--color-bar-gold)]/30 bg-black/55 p-2 backdrop-blur"
          >
            <textarea
              ref={textInputRef}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleTextSubmit();
                }
              }}
              rows={1}
              placeholder="マスターに話しかける…（Enterで送信）"
              disabled={micState === "thinking"}
              className="min-h-[38px] max-h-28 flex-1 resize-none rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-[color:var(--color-bar-cream)] placeholder:text-[color:var(--color-bar-cream)]/40 outline-none focus:border-[color:var(--color-bar-gold)]/50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={
                !textDraft.trim() ||
                isUserMessageTooShort(textDraft) ||
                micState === "thinking"
              }
              aria-label="送信"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-bar-gold)]/60 bg-gradient-to-br from-[color:var(--color-bar-gold)] to-[color:var(--color-bar-amber)] text-[color:var(--color-bar-black)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                aria-hidden
              >
                <path
                  d="M4 12l16-8-6 16-2-7-8-1z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  fill="currentColor"
                />
              </svg>
            </button>
          </form>
        )}
      </section>

      {/* 下部ナビ */}
      <nav className="relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
        <div className="flex items-end justify-between gap-3">
          <PresetButton
            preset={presets[0]}
            onClick={() => handlePreset(presets[0].message)}
            disabled={!supported || micState === "thinking"}
          />

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleMicTap}
              disabled={!supported || micState === "thinking"}
              aria-pressed={micState === "listening"}
              aria-label={micLabelShown}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                micState === "listening"
                  ? "animate-mic-listening border-[color:var(--color-bar-gold)] bg-gradient-to-br from-[color:var(--color-bar-gold)] to-[color:var(--color-bar-amber)] text-[color:var(--color-bar-black)]"
                  : micState === "thinking"
                    ? "border-[color:var(--color-bar-gold)]/60 bg-black/70 text-[color:var(--color-bar-gold-soft)]"
                    : micState === "speaking"
                      ? "border-[color:var(--color-bar-gold)]/80 bg-black/70 text-[color:var(--color-bar-gold)]"
                      : "border-[color:var(--color-bar-gold)]/70 bg-gradient-to-br from-[#1a1108] to-[#0a0604] text-[color:var(--color-bar-gold)] shadow-[0_10px_40px_rgba(212,175,55,0.35)]"
              }`}
            >
              {micState === "thinking" ? (
                <svg
                  className="h-7 w-7 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="3"
                  />
                  <path
                    d="M22 12a10 10 0 0 1-10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-8 w-8"
                  aria-hidden
                >
                  <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                  <path
                    d="M5 11a7 7 0 0 0 14 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M12 18v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}
            </button>
            <p className="text-[10px] font-medium tracking-[0.2em] text-[color:var(--color-bar-cream)]/90">
              {micLabelShown}
            </p>
          </div>

          <PresetButton
            preset={presets[1]}
            onClick={() => handlePreset(presets[1].message)}
            disabled={!supported || micState === "thinking"}
          />
        </div>
      </nav>

      {/* ステージ移行の幕間 */}
      <StageTransition drinkCount={drinkCount} masterId={masterId} />

      {/* チャットログドロワー */}
      <LogDrawer
        open={logOpen}
        onClose={() => setLogOpen(false)}
        messages={messages.filter(
          (m) => m.id !== "welcome" && m.id !== "welcome-back",
        )}
        drinkCount={drinkCount}
      />

      {/* お会計 */}
      <ClosingModal
        open={closingOpen}
        onClose={handleCloseClosingModal}
        drinkCount={drinkCount}
        messages={messages}
      />
    </main>
  );
}

function PresetButton({
  preset,
  onClick,
  disabled,
}: {
  preset: Preset;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-20 w-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-[color:var(--color-bar-gold)]/25 bg-black/55 px-2 text-[color:var(--color-bar-cream)]/90 backdrop-blur-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-[color:var(--color-bar-gold-soft)]">
        {preset.icon}
      </span>
      <span className="text-[12px] font-semibold leading-tight">
        {preset.label}
      </span>
      <span className="text-[9px] tracking-wider text-[color:var(--color-bar-gold-soft)]/80">
        {preset.sub}
      </span>
    </button>
  );
}
