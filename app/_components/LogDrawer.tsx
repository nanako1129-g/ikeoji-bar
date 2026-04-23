"use client";

import { useEffect } from "react";
import type { ChatMessage } from "../_lib/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  drinkCount: number;
};

export default function LogDrawer({
  open,
  onClose,
  messages,
  drinkCount,
}: Props) {
  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="animate-drawer relative mx-auto flex h-[80vh] w-full max-w-md flex-col rounded-t-3xl border-t border-[color:var(--color-bar-gold)]/25 bg-gradient-to-b from-[#1a120a] to-[#070402] shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-[color:var(--color-bar-gold)]/15 px-5 py-4">
          <div>
            <p className="text-[10px] tracking-[0.35em] text-[color:var(--color-bar-gold-soft)]/80">
              今夜の記録
            </p>
            <p className="mt-0.5 text-sm text-[color:var(--color-bar-cream)]/80">
              グラス{" "}
              <span className="font-semibold text-[color:var(--color-bar-cream)]">
                {drinkCount}
              </span>
              杯目 ／ 会話{" "}
              <span className="font-semibold text-[color:var(--color-bar-cream)]">
                {messages.filter((m) => m.role === "user").length}
              </span>
              往復
            </p>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-bar-gold)]/30 bg-black/40 text-[color:var(--color-bar-cream)]/80 transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="mt-12 text-center text-xs text-[color:var(--color-bar-cream)]/50">
              まだ何も話していない。
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === "user" ? "flex justify-start" : "flex justify-end"
                  }
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "rounded-tl-sm border border-white/10 bg-white/10 text-[color:var(--color-bar-cream)]/95"
                        : "rounded-tr-sm border border-[color:var(--color-bar-gold)]/25 bg-[#1a140b]/80 text-[color:var(--color-bar-cream)]"
                    }`}
                  >
                    <p className="mb-0.5 text-[9px] tracking-[0.3em] opacity-70">
                      {m.role === "user" ? "あなた" : "マスター"}
                    </p>
                    <p>{m.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
