import { describe, expect, it } from "vitest";
import {
  DRINK_RECOS,
  NUDGE_MESSAGES,
  getDrinkStage,
  isUserMessageTooShort,
  pickNudge,
  pickRecoForStage,
  wantsYoungCounterMoment,
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

describe("isUserMessageTooShort", () => {
  it("空・空白・1文字は短すぎる", () => {
    expect(isUserMessageTooShort("")).toBe(true);
    expect(isUserMessageTooShort("  ")).toBe(true);
    expect(isUserMessageTooShort("あ")).toBe(true);
  });

  it("2文字以上は送ってよい", () => {
    expect(isUserMessageTooShort("いい")).toBe(false);
    expect(isUserMessageTooShort("ok")).toBe(false);
  });
});

describe("wantsYoungCounterMoment", () => {
  it("おかわり・おつまみ・追加などで true", () => {
    expect(wantsYoungCounterMoment("おかわりちょうだい")).toBe(true);
    expect(wantsYoungCounterMoment("もう一杯ください")).toBe(true);
    expect(wantsYoungCounterMoment("おつまみ作って")).toBe(true);
    expect(wantsYoungCounterMoment("おつまみください")).toBe(true);
    expect(wantsYoungCounterMoment("追加でお願い")).toBe(true);
    expect(wantsYoungCounterMoment("料理して")).toBe(true);
  });

  it("該当しない雑談は false", () => {
    expect(wantsYoungCounterMoment("今日つらかった")).toBe(false);
    expect(wantsYoungCounterMoment("そうだね")).toBe(false);
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
