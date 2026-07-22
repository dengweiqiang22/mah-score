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
  readonly isConfirmDisabled: boolean;
  readonly isConfirming: boolean;
  readonly onConfirm: () => void;
  readonly players: readonly RoundSettlementPlayer[];
  readonly roundNumber: number;
}

export function RoundSettlementPanel({
  isConfirmDisabled,
  isConfirming,
  onConfirm,
  players,
  roundNumber,
}: RoundSettlementPanelProps) {
  return (
    <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
      <div>
        <p className="text-sm font-semibold text-stone-500">第 {roundNumber} 局</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">本局结算</h2>
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
