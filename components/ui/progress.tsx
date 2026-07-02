"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: "primary" | "mint" | "success" | "warning" | "danger";
}

const toneToBar: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  primary: "bg-primary",
  mint: "bg-mint",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  className,
  ...props
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-300 ease-out", toneToBar[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface DonutGaugeProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  /** Center label (defaults to `value`). */
  label?: React.ReactNode;
  /** Sub label under the center label (defaults to `/ max`). */
  subLabel?: React.ReactNode;
  tone?: "auto" | "primary" | "mint" | "success" | "warning" | "danger";
  className?: string;
}

const toneToStroke: Record<Exclude<DonutGaugeProps["tone"], "auto" | undefined>, string> = {
  primary: "var(--primary)",
  mint: "#10B5A0",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

/**
 * Donut ring gauge (library seat overview, chapel progress...).
 * tone="auto" colors by availability ratio: >=40% success, >=15% warning, else danger.
 */
export function DonutGauge({
  value,
  max,
  size = 92,
  strokeWidth = 9,
  label,
  subLabel,
  tone = "auto",
  className,
}: DonutGaugeProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const resolvedTone =
    tone === "auto" ? (ratio >= 0.4 ? "success" : ratio >= 0.15 ? "warning" : "danger") : tone;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneToStroke[resolvedTone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none text-foreground">
          {label ?? value}
        </span>
        <span className="mt-0.5 font-mono text-[10px] leading-none text-subtle">
          {subLabel ?? `/ ${max}`}
        </span>
      </div>
    </div>
  );
}
