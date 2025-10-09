"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatsInfoBoxProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function StatsInfoBox({ label, children, className }: StatsInfoBoxProps) {
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <p className="text-pretty text-sm leading-relaxed text-slate-100/90">
        {children}
      </p>
    ) : (
      children
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-slate-100/90 shadow-inner",
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
        {label}
      </p>
      <div className="text-pretty text-sm leading-relaxed text-slate-100/90 [&>p]:m-0 [&>p]:text-pretty [&>p]:leading-relaxed [&>p]:text-slate-100/90">
        {content}
      </div>
    </div>
  );
}
