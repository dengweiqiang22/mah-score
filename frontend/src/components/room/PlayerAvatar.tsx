import { getAvatarOption } from "../../utils/avatars";
import { cn } from "../../utils/className";

type PlayerAvatarSize = "sm" | "md" | "lg";

interface PlayerAvatarProps {
  readonly avatarId?: string;
  readonly className?: string;
  readonly isCurrentPlayer?: boolean;
  readonly nickname: string;
  readonly size?: PlayerAvatarSize;
}

const sizeClassName: Record<PlayerAvatarSize, string> = {
  lg: "h-12 w-12",
  md: "h-10 w-10",
  sm: "h-8 w-8",
};

const imageSizeClassName: Record<PlayerAvatarSize, string> = {
  lg: "h-full w-full",
  md: "h-full w-full",
  sm: "h-full w-full",
};

export function PlayerAvatar({
  avatarId,
  className,
  isCurrentPlayer = false,
  nickname,
  size = "md",
}: PlayerAvatarProps) {
  const avatar = getAvatarOption(avatarId);

  return (
    <span
      aria-label={`${nickname}头像：${avatar.label}`}
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border bg-stone-50",
        isCurrentPlayer ? "border-emerald-300" : "border-stone-200",
        sizeClassName[size],
        className,
      )}
      role="img"
    >
      <img alt="" className={cn("rounded-full", imageSizeClassName[size])} src={avatar.src} />
    </span>
  );
}
