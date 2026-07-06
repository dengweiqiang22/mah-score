import type { RoomRecord, ScoreEventRequest } from "@mah-score/shared";

export function isScoreAction(value: string): value is ScoreEventRequest["action"] {
  return value === "DISCARD_WIN" || value === "SELF_DRAW" || value === "DRAW_GAME";
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
    };
  }

  if (request.action === "SELF_DRAW") {
    return {
      winnerId: request.winnerId,
    };
  }

  return {};
}
