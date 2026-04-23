"use client";

import { useEffect, useRef, useState } from "react";
import { MASTERS, type MasterId } from "../_lib/constants";
import { haptic } from "../_lib/haptic";

type Props = {
  value: MasterId;
  onChange: (id: MasterId) => void;
};

export default function MasterSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const current = MASTERS.find((m) => m.id === value) ?? MASTERS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          haptic("tap");
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="マスターを選ぶ"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-bar-gold)]/30 bg-black/50 text-[color:var(--color-bar-gold-soft)] backdrop-blur transition active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-11 z-30 w-64 rounded-2xl border border-[color:var(--color-bar-gold)]/25 bg-[#0c0804]/95 p-2 shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          <p className="px-2 py-1 text-[9px] tracking-[0.3em] text-[color:var(--color-bar-gold-soft)]/80">
            マスターを選ぶ
          </p>
          <ul className="flex flex-col gap-1">
            {MASTERS.map((m) => {
              const selected = m.id === value;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!m.available}
                    onClick={() => {
                      if (!m.available) return;
                      haptic("confirm");
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col items-start rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      selected
                        ? "border-[color:var(--color-bar-gold)]/60 bg-[color:var(--color-bar-gold)]/10"
                        : "border-transparent hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[color:var(--color-bar-cream)]">
                        {m.name}
                      </span>
                      {!m.available && (
                        <span className="rounded-full border border-[color:var(--color-bar-gold)]/30 px-1.5 py-0.5 text-[8px] tracking-[0.2em] text-[color:var(--color-bar-gold-soft)]/80">
                          準備中
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-[color:var(--color-bar-gold-soft)]/80">
                      {m.tagline}
                    </span>
                    <span className="mt-1 text-[11px] leading-snug text-[color:var(--color-bar-cream)]/65">
                      {m.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pb-1 pt-2 text-[9px] text-[color:var(--color-bar-cream)]/40">
            現在は「{current.name}」が接客中
          </p>
        </div>
      )}
    </div>
  );
}
