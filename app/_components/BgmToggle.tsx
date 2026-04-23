"use client";

import { useEffect, useState } from "react";
import { startBgm, stopBgm } from "../_lib/audio";
import { haptic } from "../_lib/haptic";

type Props = {
  initialEnabled: boolean;
  onChange?: (enabled: boolean) => void;
};

export default function BgmToggle({ initialEnabled, onChange }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (enabled) {
      setPending(true);
      void startBgm().finally(() => setPending(false));
    } else {
      stopBgm();
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      stopBgm();
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        setEnabled((v) => {
          const next = !v;
          onChange?.(next);
          return next;
        });
      }}
      aria-pressed={enabled}
      aria-label={enabled ? "BGMを止める" : "BGMを流す"}
      title={enabled ? "BGMを止める" : "ムーディなBGMを流す"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition active:scale-95 ${
        enabled
          ? "border-[color:var(--color-bar-gold)]/70 bg-[color:var(--color-bar-gold)]/15 text-[color:var(--color-bar-gold)] shadow-[0_0_18px_rgba(212,175,55,0.35)]"
          : "border-[color:var(--color-bar-gold)]/30 bg-black/50 text-[color:var(--color-bar-gold-soft)]/70"
      }`}
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M9 10v8a2 2 0 1 1-4 0 2 2 0 0 1 2-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9 10V5l11-2v13a2 2 0 1 1-4 0 2 2 0 0 1 2-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pending && (
            <circle
              cx="19"
              cy="5"
              r="1.2"
              fill="currentColor"
              className="animate-pulse"
            />
          )}
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M9 10v8a2 2 0 1 1-4 0 2 2 0 0 1 2-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9 10V5l11-2v13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 4l16 16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
