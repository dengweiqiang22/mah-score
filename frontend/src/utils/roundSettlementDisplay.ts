import type { RoomEvent, ScoreHistoryItem } from "@mah-score/shared";

import { getDrawGameSettlementPayload } from "@mah-score/shared";

function getPayloadPlayerId(event: RoomEvent, key: string): string | undefined {
  const value = event.payload[key];

  return typeof value === "string" ? value : undefined;
}

export function getDrawGameTaxRefundedKongEventIds(
  entries: readonly ScoreHistoryItem[],
): ReadonlySet<string> {
  const drawGameItem = entries.find((item) => item.event.type === "DRAW_GAME" && !item.isUndone);

  if (drawGameItem === undefined) {
    return new Set();
  }

  const refundPlayerIds = new Set(
    getDrawGameSettlementPayload(drawGameItem.event.payload).kongTaxRefundPlayerIds,
  );

  return new Set(
    entries
      .filter((item) => {
        if (item.event.type !== "KONG" || item.isUndone) {
          return false;
        }

        const playerId = getPayloadPlayerId(item.event, "playerId");

        return playerId !== undefined && refundPlayerIds.has(playerId);
      })
      .map((item) => item.event.id),
  );
}

export function getCurrentRoundSettlementEntries(
  entries: readonly ScoreHistoryItem[],
): readonly ScoreHistoryItem[] {
  const taxRefundedKongEventIds = getDrawGameTaxRefundedKongEventIds(entries);

  if (taxRefundedKongEventIds.size === 0) {
    return entries;
  }

  return entries
    .filter((item) => !taxRefundedKongEventIds.has(item.event.id))
    .map((item) =>
      item.event.type === "DRAW_GAME" && item.displayFlows !== undefined
        ? {
            ...item,
            flows: item.displayFlows,
          }
        : item,
    );
}
