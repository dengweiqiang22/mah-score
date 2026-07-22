import type { ReactNode } from "react";

interface HistoryRoundItem {
  readonly entries: readonly ReactNode[];
  readonly entryCount: number;
  readonly isExpanded: boolean;
  readonly roundNumber: number;
}

interface HistoryRoundsPanelProps {
  readonly rounds: readonly HistoryRoundItem[];
  readonly onToggleRound: (roundNumber: number) => void;
}

export function HistoryRoundsPanel({ onToggleRound, rounds }: HistoryRoundsPanelProps) {
  return (
    <section className="grid gap-2">
      <div>
        <p className="text-sm font-semibold text-stone-700">历史局</p>
        <p className="mt-1 text-xs text-stone-500">查看已确认局的记录。</p>
      </div>
      {rounds.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-200 px-3 py-3">
          <p className="text-sm font-semibold text-stone-700">暂无历史局</p>
          <p className="mt-1 text-xs text-stone-500">确认本局后会出现在这里。</p>
        </div>
      ) : (
        rounds.map((round) => (
          <article className="grid gap-2 rounded-md bg-stone-50 p-3" key={round.roundNumber}>
            <button
              className="flex items-center justify-between gap-3 text-left"
              onClick={() => {
                onToggleRound(round.roundNumber);
              }}
              type="button"
            >
              <span className="text-sm font-semibold text-stone-900">
                第 {round.roundNumber} 局
              </span>
              <span className="text-xs font-medium text-stone-400">
                {round.isExpanded ? "收起" : `${round.entryCount} 笔`}
              </span>
            </button>
            {round.isExpanded ? <div className="grid gap-2">{round.entries}</div> : null}
          </article>
        ))
      )}
    </section>
  );
}
