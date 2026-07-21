import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/className";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  readonly children: ReactNode;
}

export function Section({ children, className, ...props }: SectionProps) {
  return (
    <section className={cn("grid gap-3 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80", className)} {...props}>
      {children}
    </section>
  );
}
