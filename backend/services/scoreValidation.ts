import type { KongType, RoomRecord, ScoreEventRequest, ScoreFan } from "@mah-score/shared";

import { kongTypes, scoreFans } from "@mah-score/shared";

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

  return {};
}
