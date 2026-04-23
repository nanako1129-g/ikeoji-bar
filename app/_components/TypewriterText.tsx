"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  // 1文字あたりの遅延 (ms)。音声の読み上げ時間に合わせて外から調整可。
  charDelay?: number;
  onDone?: () => void;
};

export default function TypewriterText({
  text,
  charDelay = 55,
  onDone,
}: Props) {
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const prevTextRef = useRef<string>("");

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setRevealed(0);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!text) return;

    timerRef.current = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= text.length) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          onDone?.();
          return r;
        }
        return r + 1;
      });
    }, charDelay);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, charDelay, onDone]);

  const visible = text.slice(0, revealed);
  const hidden = text.slice(revealed);
  const isDone = revealed >= text.length;

  return (
    <span>
      <span>{visible}</span>
      {!isDone && (
        <span
          aria-hidden
          className="animate-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-[color:var(--color-bar-gold)]"
        />
      )}
      {hidden && (
        <span aria-hidden className="opacity-0">
          {hidden}
        </span>
      )}
    </span>
  );
}
