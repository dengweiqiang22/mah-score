import type { KongType, RoomRecord, ScoreEventRequest, ScoreFan } from "../../shared/src/index.js";

import { kongTypes, scoreFans } from "../../shared/src/index.js";

export function isScoreAction(value: string): value is ScoreEventRequest["action"] {
  return value === "DISCARD_WIN" || value === "SELF_DRAW" || value === "KONG" || value === "DRAW_GAME";
}

export function isScoreFan(value: unknown): value is ScoreFan {
  return typeof value === "number" && scoreFans.some((fan) => fan === value);
}

export function isKongType(value: string): value is KongType {
  return kongTypes.some((kongType) => kongType === value);
}

export function roomHasPlayer(room: RoomRecord, playerId: string): boolean {
  return room.players.some((player) => player.id === playerId);
}

export function getScoreRequestPlayerIds(request: ScoreEventRequest): readonly string[] {
  if (request.action === "DISCARD_WIN") {
    return [request.winnerId, request.discarderId];
  }

  if (request.action === "SELF_DRAW") {
    return [request.winnerId];
  }

  if (request.action === "KONG") {
    return request.kongType === "DISCARD_KONG"
      ? [request.playerId, request.fromPlayerId]
      : [request.playerId];
  }

  return [
    ...(request.flowerPigPlayerIds ?? []),
    ...(request.kongTaxRefundPlayerIds ?? []),
    ...(request.notReadyPlayerIds ?? []),
    ...(request.readyHands ?? []).map((readyHand) => readyHand.playerId),
  ];
}

export function getScoreEventPayload(
  request: ScoreEventRequest,
): Readonly<Record<string, unknown>> {
  if (request.action === "DISCARD_WIN") {
    return {
      winnerId: request.winnerId,
      discarderId: request.discarderId,
      ...(request.fan === undefined ? {} : { fan: request.fan }),
    };
  }

  if (request.action === "SELF_DRAW") {
    return {
      winnerId: request.winnerId,
      ...(request.fan === undefined ? {} : { fan: request.fan }),
    };
  }

  if (request.action === "KONG") {
    return {
      playerId: request.playerId,
      kongType: request.kongType,
      ...(request.kongType === "DISCARD_KONG" ? { fromPlayerId: request.fromPlayerId } : {}),
    };
  }

  return {
    ...(request.flowerPigPlayerIds === undefined
      ? {}
      : { flowerPigPlayerIds: request.flowerPigPlayerIds }),
    ...(request.kongTaxRefundPlayerIds === undefined
      ? {}
      : { kongTaxRefundPlayerIds: request.kongTaxRefundPlayerIds }),
    ...(request.notReadyPlayerIds === undefined
      ? {}
      : { notReadyPlayerIds: request.notReadyPlayerIds }),
    ...(request.readyHands === undefined ? {} : { readyHands: request.readyHands }),
  };
}
