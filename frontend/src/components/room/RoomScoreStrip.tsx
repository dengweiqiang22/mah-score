import type { RoomPlayer } from "@mah-score/shared";

import { cn } from "../../utils/className";
import { ScoreValue } from "./ScoreValue";

interface RoomScoreStripProps {
  readonly currentPlayerId?: string;
  readonly players: readonly RoomPlayer[];
  readonly scores: ReadonlyMap<string, number>;
}

function getAvatarLabel(nickname: string, index: number): string {
  const trimmedNickname = nickname.trim();

  if (trimmedNickname.length > 0) {
    return trimmedNickname.slice(0, 1).toUpperCase();
  }

  return `${index + 1}`;
}

export function RoomScoreStrip({ currentPlayerId, players, scores }: RoomScoreStripProps) {
  return (
    <section
      aria-label="玩家整场总分"
      className={cn(
        "grid gap-2 rounded-md bg-white/80 p-3 ring-1 ring-stone-200/70",
        players.length === 3 ? "grid-cols-3" : "grid-cols-4",
      )}
    >
      {players.map((player, index) => {
        const isCurrentPlayer = currentPlayerId === player.id;
        const score = scores.get(player.id) ?? 0;

        return (
          <div className="min-w-0 text-center" key={player.id}>
            <div
              className={cn(
                "mx-auto grid h-10 w-10 place-items-center rounded-full text-sm font-semibold",
                isCurrentPlayer
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  : "bg-stone-100 text-stone-700",
              )}
            >
              {getAvatarLabel(player.nickname, index)}
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-center gap-1">
              <p className="min-w-0 truncate text-xs font-semibold text-stone-800">
                {player.nickname}
              </p>
              {isCurrentPlayer ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 ring-1 ring-emerald-100">
                  我
                </span>
              ) : null}
            </div>
            <ScoreValue className="mt-1 block" score={score} size="sm" />
          </div>
        );
      })}
    </section>
  );
}
