import { describe, expect, it } from "vitest";
import {
  DRINK_RECOS,
  NUDGE_MESSAGES,
  getDrinkStage,
  pickNudge,
  pickRecoForStage,
} from "./constants";

describe("getDrinkStage", () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 2],
    [7, 2],
    [8, 3],
    [99, 3],
  ])("drinkCount=%i → stage %i", (drinkCount, expected) => {
    expect(getDrinkStage(drinkCount)).toBe(expected);
  });
});

describe("pickRecoForStage", () => {
  it("各ステージで該当ステージのおすすめだけが返る", () => {
    for (const stage of [0, 1, 2, 3] as const) {
      const reco = pickRecoForStage(stage, 0);
      expect(reco.stage).toBe(stage);
    }
  });

  it("seed が変わると同一ステージ内で巡回する", () => {
    const stage0Pool = DRINK_RECOS.filter((r) => r.stage === 0);
    const seen = new Set<string>();
    for (let i = 0; i < stage0Pool.length * 3; i++) {
      seen.add(pickRecoForStage(0, i).name);
    }
    expect(seen.size).toBe(stage0Pool.length);
  });
});

describe("pickNudge", () => {
  it("prev と同じメッセージは返さない", () => {
    for (let i = 0; i < 50; i++) {
      const prev = NUDGE_MESSAGES[i % NUDGE_MESSAGES.length];
      const next = pickNudge(prev);
      expect(next).not.toBe(prev);
      expect(NUDGE_MESSAGES).toContain(next);
    }
  });

  it("prev 未指定でも常に既知のメッセージを返す", () => {
    for (let i = 0; i < 20; i++) {
      const next = pickNudge(undefined);
      expect(NUDGE_MESSAGES).toContain(next);
    }
  });
});
