import type { ReactNode } from "react";

import { Info } from "lucide-react";

import { cn } from "../../utils/className";

type EntryStatusVariant = "default" | "success" | "warning";

interface EntryStatusProps {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly title?: string;
  readonly variant?: EntryStatusVariant;
}

const variantClassName: Record<EntryStatusVariant, string> = {
  default: "bg-emerald-50 text-emerald-900 ring-emerald-100",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  warning: "bg-amber-50 text-amber-950 ring-amber-200",
};

export function EntryStatus({
  action,
  children,
  title = "当前步骤",
  variant = "default",
}: EntryStatusProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ring-1",
        variantClassName[variant],
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold opacity-70">{title}</p>
          <p className="mt-0.5 break-words font-semibold leading-5">{children}</p>
        </div>
      </div>
      {action !== undefined ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
