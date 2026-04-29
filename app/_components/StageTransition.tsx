"use client";

import { useEffect, useRef, useState } from "react";
import {
  getDrinkStage,
  STAGE_META,
  type DrinkStage,
  type MasterId,
} from "../_lib/constants";
import { playSfx } from "../_lib/audio";
import { haptic } from "../_lib/haptic";

type Props = {
  drinkCount: number;
  masterId: MasterId;
};

/** 年下バーテンダーがしらふ→ほろ酔いに上がるとき：カウンター越しから「そば」。 */
const YOUNG_BESIDE_TRANSITION =
  "――ボク、ちょっと横に座りますね。……バーの奥じゃなく、あなたのそばで。";

export default function StageTransition({ drinkCount, masterId }: Props) {
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
      const prev = prevStageRef.current;
      prevStageRef.current = stage;
      const youngBeside =
        (masterId === "young_bartender" || masterId === "muscle") &&
        prev === 0 &&
        stage === 1;
      setMessage(
        youngBeside ? YOUNG_BESIDE_TRANSITION : STAGE_META[stage].transition,
      );
      setVisible(true);
      // 節目が上がる時はワインを注ぐ長めの音、戻る時はチャイムで控えめに
      playSfx(going === "up" ? "pourWine" : "chimeDown");
      haptic("success");
      const t = window.setTimeout(() => setVisible(false), 2800);
      return () => window.clearTimeout(t);
    }
  }, [drinkCount, masterId]);

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
