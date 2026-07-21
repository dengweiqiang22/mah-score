import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/className";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
}

const variantClassName: Record<ButtonVariant, string> = {
  danger: "bg-red-50 text-red-700 active:bg-red-100",
  ghost: "bg-transparent text-stone-700 active:bg-stone-100",
  primary: "bg-emerald-700 text-white active:bg-emerald-800",
  secondary: "bg-stone-100 text-stone-900 active:bg-stone-200",
};

const sizeClassName: Record<ButtonSize, string> = {
  lg: "h-12 px-4 text-base",
  md: "h-10 px-3 text-sm",
  sm: "h-8 px-3 text-xs",
};

export function Button({
  children,
  className,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variantClassName[variant],
        sizeClassName[size],
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
