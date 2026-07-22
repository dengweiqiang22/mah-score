import { cn } from "../../utils/className";

type ScoreValueSize = "sm" | "md" | "lg" | "xl";

interface ScoreValueProps {
  readonly className?: string;
  readonly score: number;
  readonly size?: ScoreValueSize;
}

const sizeClassName: Record<ScoreValueSize, string> = {
  lg: "text-2xl",
  md: "text-base",
  sm: "text-sm",
  xl: "text-3xl",
};

export function formatScoreValue(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export function ScoreValue({ className, score, size = "md" }: ScoreValueProps) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        sizeClassName[size],
        score > 0 ? "text-emerald-700" : score < 0 ? "text-red-700" : "text-stone-500",
        className,
      )}
    >
      {formatScoreValue(score)}
    </span>
  );
}
