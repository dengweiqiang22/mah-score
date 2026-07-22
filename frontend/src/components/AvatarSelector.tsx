import { avatarOptions } from "../utils/avatars";
import { cn } from "../utils/className";

interface AvatarSelectorProps {
  readonly onChange: (avatarId: string) => void;
  readonly value: string;
}

export function AvatarSelector({ onChange, value }: AvatarSelectorProps) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-stone-700">选择头像</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {avatarOptions.map((avatar) => {
          const isSelected = avatar.id === value;

          return (
            <button
              aria-label={avatar.label}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2",
                isSelected ? "ring-2 ring-emerald-700 ring-offset-2" : "ring-1 ring-stone-200",
              )}
              key={avatar.id}
              onClick={() => {
                onChange(avatar.id);
              }}
              type="button"
            >
              <img alt="" className="h-9 w-9" src={avatar.src} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
