import { Copy } from "lucide-react";

import { Button } from "../ui/Button";
import { ScoreValue } from "./ScoreValue";

interface FinalSettlementPlayer {
  readonly discardCount: number;
  readonly kongCount: number;
  readonly nickname: string;
  readonly playerId: string;
  readonly rank: number;
  readonly total: number;
  readonly winCount: number;
}

interface FinalSettlementPanelProps {
  readonly copyMessage?: string;
  readonly onBackHome: () => void;
  readonly onCopy: () => void;
  readonly players: readonly FinalSettlementPlayer[];
}

export function FinalSettlementPanel({
  copyMessage,
  onBackHome,
  onCopy,
  players,
}: FinalSettlementPanelProps) {
  return (
    <>
      <div className="grid gap-3">
        {players.map((player) => (
          <article
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80"
            key={player.playerId}
          >
            <p className="grid h-10 w-10 place-items-center rounded-md bg-stone-100 text-sm font-semibold text-stone-700">
              {player.rank}
            </p>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{player.nickname}</p>
              <p className="mt-1 text-xs font-medium text-stone-500">
                胡 {player.winCount} · 点炮 {player.discardCount} · 杠 {player.kongCount}
              </p>
            </div>
            <ScoreValue score={player.total} size="lg" />
          </article>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onCopy} variant="primary">
          <Copy className="h-4 w-4" />
          复制战绩
        </Button>
        <Button onClick={onBackHome}>返回首页</Button>
      </div>
      {copyMessage !== undefined ? (
        <p className="text-sm font-medium text-stone-500">{copyMessage}</p>
      ) : null}
    </>
  );
}
