import type { DetailsHTMLAttributes, ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "../../utils/className";

interface DisclosureProps extends DetailsHTMLAttributes<HTMLDetailsElement> {
  readonly children: ReactNode;
  readonly summary: ReactNode;
}

export function Disclosure({ children, className, summary, ...props }: DisclosureProps) {
  return (
    <details className={cn("group rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80", className)} {...props}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold tracking-normal text-stone-900">
        <span className="min-w-0">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
