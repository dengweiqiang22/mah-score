import { LedgerRow } from "./LedgerRow";

interface PlayerLedgerItem {
  readonly expense: number;
  readonly income: number;
  readonly nickname: string;
  readonly playerId: string;
  readonly total: number;
}

interface PlayerLedgerPanelProps {
  readonly currentPlayerId?: string;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly players: readonly PlayerLedgerItem[];
}

export function PlayerLedgerPanel({
  currentPlayerId,
  isExpanded,
  onToggle,
  players,
}: PlayerLedgerPanelProps) {
  return (
    <section className="grid gap-2">
      <button
        className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <span>
          <span className="block text-sm font-semibold text-stone-900">玩家总账</span>
          <span className="mt-1 block text-xs text-stone-500">查看整场收入、支出和净变化。</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-stone-400">
          {isExpanded ? "收起" : "展开"}
        </span>
      </button>
      {isExpanded ? (
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
      ) : null}
    </section>
  );
}
