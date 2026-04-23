"use client";

import { useEffect, useRef, useState } from "react";
import { getDrinkStage, STAGE_META, type DrinkStage } from "../_lib/constants";
import { playSfx } from "../_lib/audio";
import { haptic } from "../_lib/haptic";

type Props = {
  drinkCount: number;
};

export default function StageTransition({ drinkCount }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const prevStageRef = useRef<DrinkStage | null>(null);

  useEffect(() => {
    const stage = getDrinkStage(drinkCount);
    if (prevStageRef.current === null) {
      prevStageRef.current = stage;
      return;
    }
    if (stage !== prevStageRef.current) {
      const going = stage > prevStageRef.current ? "up" : "down";
      prevStageRef.current = stage;
      setMessage(STAGE_META[stage].transition);
      setVisible(true);
      playSfx(going === "up" ? "chimeUp" : "chimeDown");
      haptic("success");
      const t = window.setTimeout(() => setVisible(false), 2800);
      return () => window.clearTimeout(t);
    }
  }, [drinkCount]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-8"
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <p className="animate-stage relative text-center text-base font-medium leading-relaxed text-[color:var(--color-bar-cream)] [text-shadow:0_2px_18px_rgba(0,0,0,0.8)]">
        {message}
      </p>
    </div>
  );
}
