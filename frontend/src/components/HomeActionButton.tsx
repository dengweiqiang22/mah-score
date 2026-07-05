interface HomeActionButtonProps {
  readonly children: string;
  readonly variant: "primary" | "secondary";
}

const variantClassName: Record<HomeActionButtonProps["variant"], string> = {
  primary: "bg-emerald-700 text-white shadow-sm active:bg-emerald-800",
  secondary: "border border-stone-300 bg-white text-stone-950 active:bg-stone-100",
};

export function HomeActionButton({ children, variant }: HomeActionButtonProps) {
  return (
    <button
      className={`h-14 w-full rounded-md px-4 text-base font-semibold ${variantClassName[variant]}`}
      type="button"
    >
      {children}
    </button>
  );
}
