"use client";

import { useEffect, useMemo } from "react";
import type { ChatMessage } from "../_lib/constants";
import { getDrinkStage, STAGE_META } from "../_lib/constants";
import { playSfx } from "../_lib/audio";

type Props = {
  open: boolean;
  onClose: () => void;
  drinkCount: number;
  messages: ChatMessage[];
};

export default function ClosingModal({
  open,
  onClose,
  drinkCount,
  messages,
}: Props) {
  useEffect(() => {
    if (open) playSfx("glassPlace");
  }, [open]);

  const closing = useMemo(() => {
    const stage = getDrinkStage(drinkCount);
    if (stage === 0)
      return "――また、気が向いたら寄ってくれ。グラスは冷やして待ってる。";
    if (stage === 1)
      return "今夜はここまでにしておこう。家に着いたら、水を一杯な。";
    if (stage === 2)
      return "よく話してくれた。俺はちゃんと覚えてる。また飲もう。";
    return "お疲れさん、本当に。今夜は、ゆっくり眠れ。";
  }, [drinkCount]);

  if (!open) return null;

  const exchanges = messages.filter((m) => m.role === "user").length;
  const stageLabel = STAGE_META[getDrinkStage(drinkCount)].label;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-[color:var(--color-bar-gold)]/35 bg-gradient-to-b from-[#1a120a] to-[#070402] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-24 items-center justify-center rounded-full border border-[color:var(--color-bar-gold)]/40 bg-black/80 text-[10px] tracking-[0.4em] text-[color:var(--color-bar-gold-soft)]">
          お会計
        </div>

        <p className="text-center text-5xl">🥃</p>

        <h2 className="mt-4 text-center text-lg font-semibold tracking-wide text-[color:var(--color-bar-cream)]">
          今夜はここまで
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[color:var(--color-bar-gold)]/20 bg-black/40 px-3 py-3 text-center">
            <p className="text-[9px] tracking-[0.3em] text-[color:var(--color-bar-gold-soft)]/80">
              泥酔度
            </p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--color-bar-cream)]">
              {drinkCount}
            </p>
            <p className="text-[10px] text-[color:var(--color-bar-gold-soft)]">
              {stageLabel}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-bar-gold)]/20 bg-black/40 px-3 py-3 text-center">
            <p className="text-[9px] tracking-[0.3em] text-[color:var(--color-bar-gold-soft)]/80">
              語り合い
            </p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--color-bar-cream)]">
              {exchanges}
            </p>
            <p className="text-[10px] text-[color:var(--color-bar-gold-soft)]">
              往復
            </p>
          </div>
        </div>

        <p className="mt-5 rounded-xl border border-[color:var(--color-bar-gold)]/20 bg-black/30 px-4 py-3 text-center text-[13px] leading-relaxed text-[color:var(--color-bar-cream)]">
          {closing}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full border border-[color:var(--color-bar-gold)]/50 bg-gradient-to-br from-[color:var(--color-bar-gold)]/20 to-[color:var(--color-bar-amber)]/10 py-3 text-sm font-semibold tracking-widest text-[color:var(--color-bar-cream)] transition active:scale-[0.98]"
        >
          店を出る
        </button>
      </div>
    </div>
  );
}
