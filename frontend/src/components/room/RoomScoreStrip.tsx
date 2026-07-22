import type { RoomPlayer } from "@mah-score/shared";

import { cn } from "../../utils/className";
import { PlayerAvatar } from "./PlayerAvatar";
import { formatScoreValue } from "./ScoreValue";

interface RoomScoreStripProps {
  readonly currentPlayerId?: string;
  readonly players: readonly RoomPlayer[];
  readonly scores: ReadonlyMap<string, number>;
}

export function RoomScoreStrip({ currentPlayerId, players, scores }: RoomScoreStripProps) {
  return (
    <section
      aria-label="玩家整场总分"
      className={cn(
        "grid gap-2 rounded-md bg-white/80 px-3 py-2 ring-1 ring-stone-200/70",
        players.length === 3 ? "grid-cols-3" : "grid-cols-4",
      )}
    >
      {players.map((player) => {
        const isCurrentPlayer = currentPlayerId === player.id;
        const score = scores.get(player.id) ?? 0;

        return (
          <div className="min-w-0 text-center" key={player.id}>
            <div className="relative mx-auto h-10 w-10">
              <PlayerAvatar
                avatarId={player.avatarId}
                className="h-full w-full"
                isCurrentPlayer={isCurrentPlayer}
                nickname={player.nickname}
              />
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 grid h-[15px] place-items-center rounded-b-full bg-white/90 text-[10px] font-semibold leading-none tabular-nums shadow-sm",
                  score > 0 ? "text-emerald-700" : score < 0 ? "text-red-700" : "text-stone-500",
                )}
              >
                {formatScoreValue(score)}
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center justify-center gap-1">
              <p className="min-w-0 truncate text-xs font-semibold text-stone-800">
                {player.nickname}
              </p>
              {isCurrentPlayer ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 ring-1 ring-emerald-100">
                  我
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
