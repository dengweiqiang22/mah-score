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
      <div className="grid grid-cols-8 gap-1.5">
        {avatarOptions.map((avatar) => {
          const isSelected = avatar.id === value;

          return (
            <button
              aria-label={avatar.label}
              className={cn(
                "grid aspect-square min-w-0 place-items-center overflow-hidden rounded-full border-2 bg-stone-50 p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-1",
                isSelected ? "border-emerald-700" : "border-stone-200",
              )}
              key={avatar.id}
              onClick={() => {
                onChange(avatar.id);
              }}
              type="button"
            >
              <img alt="" className="h-full w-full rounded-full" src={avatar.src} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
