import type { ScoreFan } from "@mah-score/shared";

import { useState } from "react";

export type DrawGameStep = "flower_pig" | "not_ready" | "ready_fan";

export interface DrawGameEntryPayload {
  readonly flowerPigPlayerIds?: readonly string[];
  readonly kongTaxRefundPlayerIds?: readonly string[];
  readonly notReadyPlayerIds?: readonly string[];
  readonly readyHands?: readonly {
    readonly maxFan: ScoreFan;
    readonly playerId: string;
  }[];
}

function togglePlayerId(playerIds: readonly string[], playerId: string): readonly string[] {
  return playerIds.includes(playerId)
    ? playerIds.filter((currentPlayerId) => currentPlayerId !== playerId)
    : [...playerIds, playerId];
}

export function useDrawGameEntry() {
  const [drawGameStep, setDrawGameStep] = useState<DrawGameStep>("flower_pig");
  const [drawFlowerPigPlayerIds, setDrawFlowerPigPlayerIds] = useState<readonly string[]>([]);
  const [drawNotReadyPlayerIds, setDrawNotReadyPlayerIds] = useState<readonly string[]>([]);
  const [drawReadyFans, setDrawReadyFans] = useState<Readonly<Record<string, ScoreFan>>>({});
  const [selectedDrawReadyFan, setSelectedDrawReadyFan] = useState<ScoreFan>(1);

  function resetDrawGameEntry() {
    setDrawGameStep("flower_pig");
    setDrawFlowerPigPlayerIds([]);
    setDrawNotReadyPlayerIds([]);
    setDrawReadyFans({});
    setSelectedDrawReadyFan(1);
  }

  function selectDrawGamePlayer(
    playerId: string,
    currentRoundWinnerIds: ReadonlySet<string>,
  ): string | undefined {
    if (currentRoundWinnerIds.has(playerId)) {
      return undefined;
    }

    if (drawGameStep === "flower_pig") {
      setDrawFlowerPigPlayerIds((currentValue) => togglePlayerId(currentValue, playerId));
      setDrawNotReadyPlayerIds((currentValue) =>
        currentValue.filter((currentPlayerId) => currentPlayerId !== playerId),
      );
      setDrawReadyFans((currentValue) =>
        Object.fromEntries(
          Object.entries(currentValue).filter(([currentPlayerId]) => currentPlayerId !== playerId),
        ),
      );
      return undefined;
    }

    if (drawFlowerPigPlayerIds.includes(playerId)) {
      return "花猪不参与查叫。";
    }

    if (drawGameStep === "not_ready") {
      setDrawNotReadyPlayerIds((currentValue) => togglePlayerId(currentValue, playerId));
      setDrawReadyFans((currentValue) =>
        Object.fromEntries(
          Object.entries(currentValue).filter(([currentPlayerId]) => currentPlayerId !== playerId),
        ),
      );
      return undefined;
    }

    setDrawNotReadyPlayerIds((currentValue) =>
      currentValue.filter((currentPlayerId) => currentPlayerId !== playerId),
    );
    setDrawReadyFans((currentValue) => ({
      ...currentValue,
      [playerId]: selectedDrawReadyFan,
    }));

    return undefined;
  }

  function createDrawGamePayload(): DrawGameEntryPayload {
    const readyHands = Object.entries(drawReadyFans).map(([playerId, maxFan]) => ({
      playerId,
      maxFan,
    }));
    const kongTaxRefundPlayerIds = Array.from(
      new Set([...drawFlowerPigPlayerIds, ...drawNotReadyPlayerIds]),
    );

    return {
      ...(drawFlowerPigPlayerIds.length === 0
        ? {}
        : { flowerPigPlayerIds: drawFlowerPigPlayerIds }),
      ...(drawNotReadyPlayerIds.length === 0 ? {} : { notReadyPlayerIds: drawNotReadyPlayerIds }),
      ...(readyHands.length === 0 ? {} : { readyHands }),
      ...(kongTaxRefundPlayerIds.length === 0 ? {} : { kongTaxRefundPlayerIds }),
    };
  }

  return {
    createDrawGamePayload,
    drawFlowerPigPlayerIds,
    drawGameSettlementSummary: `花猪 ${drawFlowerPigPlayerIds.length} · 未叫 ${drawNotReadyPlayerIds.length} · 有叫 ${
      Object.keys(drawReadyFans).length
    }`,
    drawGameStep,
    drawNotReadyPlayerIds,
    drawReadyFans,
    resetDrawGameEntry,
    selectedDrawReadyFan,
    selectDrawGamePlayer,
    setDrawGameStep,
    setSelectedDrawReadyFan,
  };
}
