import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer } from "../types/room.js";
import type { KongType } from "../types/score.js";

import { getFanScore } from "./roomRules.js";

export interface DrawGameReadyHand {
  readonly maxFan: number;
  readonly playerId: string;
}

export interface DrawGameSettlementPayload {
  readonly flowerPigPlayerIds: readonly string[];
  readonly kongTaxRefundPlayerIds: readonly string[];
  readonly notReadyPlayerIds: readonly string[];
  readonly readyHands: readonly DrawGameReadyHand[];
}

export interface DrawGameSettlementFlow {
  readonly delta: number;
  readonly playerId: string;
}

export interface DrawGameSettlementFlowOptions {
  readonly includeKongTaxRefund?: boolean;
}

export interface DrawGameKongTaxRefundDetail {
  readonly delta: number;
  readonly kongType: KongType;
  readonly playerId: string;
}

interface KongTaxRefundEntry {
  readonly delta: number;
  readonly kongType: KongType;
  readonly payerPlayerId: string;
  readonly refundPlayerId: string;
}

function getPayloadString(payload: RoomEvent["payload"], key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPayloadStringArray(
  payload: RoomEvent["payload"],
  key: string,
): readonly string[] {
  const value = payload[key];

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getReadyHands(payload: RoomEvent["payload"]): readonly DrawGameReadyHand[] {
  const value = payload.readyHands;

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): DrawGameReadyHand | undefined => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("playerId" in item) ||
        !("maxFan" in item) ||
        typeof item.playerId !== "string" ||
        typeof item.maxFan !== "number"
      ) {
        return undefined;
      }

      return {
        maxFan: item.maxFan,
        playerId: item.playerId,
      };
    })
    .filter((item): item is DrawGameReadyHand => item !== undefined);
}

function isKongType(value: string | undefined): value is KongType {
  return (
    value === "DISCARD_KONG" ||
    value === "SUPPLEMENT_KONG" ||
    value === "CONCEALED_KONG"
  );
}

export function getDrawGameSettlementPayload(
  payload: RoomEvent["payload"],
): DrawGameSettlementPayload {
  const flowerPigPlayerIds = getPayloadStringArray(payload, "flowerPigPlayerIds");
  const notReadyPlayerIds = getPayloadStringArray(payload, "notReadyPlayerIds");
  const fallbackTaxRefundPlayerIds = Array.from(
    new Set([...flowerPigPlayerIds, ...notReadyPlayerIds]),
  );

  return {
    flowerPigPlayerIds,
    kongTaxRefundPlayerIds:
      "kongTaxRefundPlayerIds" in payload
        ? getPayloadStringArray(payload, "kongTaxRefundPlayerIds")
        : fallbackTaxRefundPlayerIds,
    notReadyPlayerIds,
    readyHands: getReadyHands(payload),
  };
}

function addFlow(
  flowMap: Map<string, number>,
  playerId: string,
  delta: number,
): void {
  flowMap.set(playerId, (flowMap.get(playerId) ?? 0) + delta);
}

function getActivePlayers(
  players: readonly RoomPlayer[],
  winnerIds: ReadonlySet<string>,
): readonly RoomPlayer[] {
  return players.filter((player) => !winnerIds.has(player.id));
}

function appendFlowerPigFlows(
  flowMap: Map<string, number>,
  activePlayers: readonly RoomPlayer[],
  flowerPigPlayerIds: ReadonlySet<string>,
): void {
  for (const flowerPigPlayerId of flowerPigPlayerIds) {
    if (!activePlayers.some((player) => player.id === flowerPigPlayerId)) {
      continue;
    }

    for (const player of activePlayers) {
      if (player.id === flowerPigPlayerId || flowerPigPlayerIds.has(player.id)) {
        continue;
      }

      addFlow(flowMap, flowerPigPlayerId, -9);
      addFlow(flowMap, player.id, 9);
    }
  }
}

function appendReadyHandFlows(
  flowMap: Map<string, number>,
  activePlayers: readonly RoomPlayer[],
  payload: DrawGameSettlementPayload,
): void {
  const activePlayerIds = new Set(activePlayers.map((player) => player.id));
  const flowerPigPlayerIds = new Set(payload.flowerPigPlayerIds);
  const readyHands = payload.readyHands.filter(
    (readyHand) => activePlayerIds.has(readyHand.playerId) && !flowerPigPlayerIds.has(readyHand.playerId),
  );

  for (const notReadyPlayerId of payload.notReadyPlayerIds) {
    if (!activePlayerIds.has(notReadyPlayerId) || flowerPigPlayerIds.has(notReadyPlayerId)) {
      continue;
    }

    for (const readyHand of readyHands) {
      const score = getFanScore(readyHand.maxFan);

      addFlow(flowMap, notReadyPlayerId, -score);
      addFlow(flowMap, readyHand.playerId, score);
    }
  }
}

function appendKongTaxRefundFlows(
  flowMap: Map<string, number>,
  players: readonly RoomPlayer[],
  currentRoundEvents: readonly RoomEvent[],
  refundPlayerIds: ReadonlySet<string>,
): void {
  for (const entry of createKongTaxRefundEntries(players, currentRoundEvents, refundPlayerIds)) {
    addFlow(flowMap, entry.refundPlayerId, -entry.delta);
    addFlow(flowMap, entry.payerPlayerId, entry.delta);
  }
}

function createKongTaxRefundEntries(
  players: readonly RoomPlayer[],
  currentRoundEvents: readonly RoomEvent[],
  refundPlayerIds: ReadonlySet<string>,
): readonly KongTaxRefundEntry[] {
  const winnerIds = new Set<string>();
  const entries: KongTaxRefundEntry[] = [];

  for (const event of currentRoundEvents) {
    if (event.type === "DISCARD_WIN" || event.type === "SELF_DRAW") {
      const winnerId = getPayloadString(event.payload, "winnerId");

      if (winnerId !== undefined) {
        winnerIds.add(winnerId);
      }

      continue;
    }

    if (event.type !== "KONG") {
      continue;
    }

    const playerId = getPayloadString(event.payload, "playerId");

    if (playerId === undefined || !refundPlayerIds.has(playerId)) {
      continue;
    }

    const kongType = getPayloadString(event.payload, "kongType");

    if (!isKongType(kongType)) {
      continue;
    }

    if (kongType === "DISCARD_KONG") {
      const fromPlayerId = getPayloadString(event.payload, "fromPlayerId");

      if (fromPlayerId === undefined || winnerIds.has(fromPlayerId)) {
        continue;
      }

      entries.push({
        delta: 1,
        kongType,
        payerPlayerId: fromPlayerId,
        refundPlayerId: playerId,
      });
      continue;
    }

    const payerScore = kongType === "CONCEALED_KONG" ? 2 : 1;
    const activePlayers = getActivePlayers(players, winnerIds);

    for (const player of activePlayers) {
      if (player.id === playerId) {
        continue;
      }

      entries.push({
        delta: payerScore,
        kongType,
        payerPlayerId: player.id,
        refundPlayerId: playerId,
      });
    }
  }

  return entries;
}

export function createDrawGameSettlementFlows(
  players: readonly RoomPlayer[],
  winnerIds: ReadonlySet<string>,
  currentRoundEvents: readonly RoomEvent[],
  payload: DrawGameSettlementPayload,
  options: DrawGameSettlementFlowOptions = {},
): readonly DrawGameSettlementFlow[] {
  const flowMap = new Map<string, number>();
  const activePlayers = getActivePlayers(players, winnerIds);
  const flowerPigPlayerIds = new Set(payload.flowerPigPlayerIds);
  const includeKongTaxRefund = options.includeKongTaxRefund ?? true;

  appendFlowerPigFlows(flowMap, activePlayers, flowerPigPlayerIds);
  appendReadyHandFlows(flowMap, activePlayers, payload);

  if (includeKongTaxRefund) {
    appendKongTaxRefundFlows(
      flowMap,
      players,
      currentRoundEvents,
      new Set(payload.kongTaxRefundPlayerIds),
    );
  }

  return [...flowMap.entries()]
    .map(([playerId, delta]) => ({
      playerId,
      delta,
    }))
    .filter((flow) => flow.delta !== 0);
}

export function createDrawGameKongTaxRefundDetails(
  players: readonly RoomPlayer[],
  currentRoundEvents: readonly RoomEvent[],
  refundPlayerIds: ReadonlySet<string>,
): readonly DrawGameKongTaxRefundDetail[] {
  const detailMap = new Map<string, DrawGameKongTaxRefundDetail>();

  for (const entry of createKongTaxRefundEntries(players, currentRoundEvents, refundPlayerIds)) {
    const key = `${entry.refundPlayerId}:${entry.kongType}`;
    const current = detailMap.get(key);

    detailMap.set(key, {
      delta: (current?.delta ?? 0) - entry.delta,
      kongType: entry.kongType,
      playerId: entry.refundPlayerId,
    });
  }

  return [...detailMap.values()].filter((detail) => detail.delta !== 0);
}
