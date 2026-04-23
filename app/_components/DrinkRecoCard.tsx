"use client";

import { useMemo, useState } from "react";
import {
  getDrinkStage,
  pickRecoForStage,
  type DrinkReco,
} from "../_lib/constants";

type Props = {
  drinkCount: number;
};

export default function DrinkRecoCard({ drinkCount }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const reco: DrinkReco = useMemo(() => {
    const stage = getDrinkStage(drinkCount);
    return pickRecoForStage(stage, Math.floor(drinkCount / 1.3));
  }, [drinkCount]);

  if (dismissed) return null;

  return (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      aria-label={`今夜のおすすめ：${reco.name}（タップで閉じる）`}
      title={reco.note}
      className="animate-card-rise pointer-events-auto inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color:var(--color-bar-gold)]/25 bg-black/50 px-2.5 py-1 text-[color:var(--color-bar-cream)]/85 backdrop-blur-md transition active:scale-95"
    >
      <span className="text-xs leading-none text-[color:var(--color-bar-gold)]">
        🥃
      </span>
      <span className="text-[9px] tracking-[0.3em] text-[color:var(--color-bar-gold-soft)]/70">
        今夜
      </span>
      <span className="truncate text-[11px] font-medium text-[color:var(--color-bar-cream)]">
        {reco.name}
      </span>
    </button>
  );
}
