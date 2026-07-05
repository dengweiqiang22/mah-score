interface HomeActionButtonProps {
  readonly children: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly variant: "primary" | "secondary";
}

const variantClassName: Record<HomeActionButtonProps["variant"], string> = {
  primary: "bg-emerald-700 text-white shadow-sm active:bg-emerald-800",
  secondary: "border border-stone-300 bg-white text-stone-950 active:bg-stone-100",
};

export function HomeActionButton({ children, disabled = false, onClick, variant }: HomeActionButtonProps) {
  return (
    <button
      className={`h-14 w-full rounded-md px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${variantClassName[variant]}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
