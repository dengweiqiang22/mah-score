import type { ReactNode } from "react";

import { LedgerRow } from "./LedgerRow";

interface RoundDetailPlayer {
  readonly expense: number;
  readonly income: number;
  readonly nickname: string;
  readonly playerId: string;
  readonly total: number;
}

interface RoundDetailPanelProps {
  readonly currentPlayerId?: string;
  readonly entries: readonly ReactNode[];
  readonly players: readonly RoundDetailPlayer[];
}

export function RoundDetailPanel({ currentPlayerId, entries, players }: RoundDetailPanelProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {players.map((player) => (
          <LedgerRow
            expense={player.expense}
            income={player.income}
            isCurrentPlayer={currentPlayerId === player.playerId}
            key={player.playerId}
            nickname={player.nickname}
            total={player.total}
          />
        ))}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-200 px-3 py-3">
          <p className="text-sm font-semibold text-stone-700">暂无本局明细</p>
          <p className="mt-1 text-xs text-stone-500">本局产生计分事件后会显示在这里。</p>
        </div>
      ) : (
        <div className="grid gap-2">{entries}</div>
      )}
    </div>
  );
}
