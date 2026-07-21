import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/className";

type NoticeVariant = "default" | "danger" | "warning";

interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly variant?: NoticeVariant;
}

const variantClassName: Record<NoticeVariant, string> = {
  danger: "bg-red-50 text-red-700 ring-red-200",
  default: "bg-stone-100 text-stone-600 ring-stone-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
};

export function Notice({ children, className, variant = "default", ...props }: NoticeProps) {
  return (
    <div className={cn("rounded-md px-4 py-3 text-sm leading-6 ring-1", variantClassName[variant], className)} {...props}>
      {children}
    </div>
  );
}
