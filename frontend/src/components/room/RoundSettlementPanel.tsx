import { Button } from "../ui/Button";
import { SettlementPlayerRow } from "./SettlementPlayerRow";

interface RoundSettlementPlayer {
  readonly expense: number;
  readonly income: number;
  readonly isCurrentPlayer?: boolean;
  readonly isTopPlayer?: boolean;
  readonly nickname: string;
  readonly playerId: string;
  readonly total: number;
}

interface RoundSettlementPanelProps {
  readonly eventCount: number;
  readonly isConfirmDisabled: boolean;
  readonly isConfirming: boolean;
  readonly onConfirm: () => void;
  readonly players: readonly RoundSettlementPlayer[];
  readonly resultLabel: string;
  readonly roundNumber: number;
  readonly topScoreLabel: string;
}

export function RoundSettlementPanel({
  eventCount,
  isConfirmDisabled,
  isConfirming,
  onConfirm,
  players,
  resultLabel,
  roundNumber,
  topScoreLabel,
}: RoundSettlementPanelProps) {
  return (
    <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
      <div>
        <p className="text-sm font-semibold text-stone-500">第 {roundNumber} 局</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">本局结算</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-md bg-stone-50 px-3 py-2">
        <div>
          <p className="text-xs font-medium text-stone-400">结果</p>
          <p className="mt-1 truncate text-sm font-semibold text-stone-800">{resultLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone-400">最高分</p>
          <p className="mt-1 truncate text-sm font-semibold text-stone-800">{topScoreLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone-400">事件</p>
          <p className="mt-1 text-sm font-semibold text-stone-800">{eventCount} 笔</p>
        </div>
      </div>

      <div className="grid">
        {players.map((player) => (
          <SettlementPlayerRow
            expense={player.expense}
            income={player.income}
            isCurrentPlayer={player.isCurrentPlayer}
            isTopPlayer={player.isTopPlayer}
            key={player.playerId}
            nickname={player.nickname}
            total={player.total}
          />
        ))}
      </div>

      <Button disabled={isConfirmDisabled} onClick={onConfirm} size="lg" variant="primary">
        {isConfirming ? "确认中..." : "确认本局，开始下一局"}
      </Button>
    </section>
  );
}
