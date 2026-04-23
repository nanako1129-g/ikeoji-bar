export type HapticKind =
  | "tap"
  | "confirm"
  | "success"
  | "warning"
  | "heavy";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  confirm: 14,
  success: [10, 40, 18],
  warning: [30, 60, 30],
  heavy: 32,
};

export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* noop */
  }
}
