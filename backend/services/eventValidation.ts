import type { RoomEventPayload, RoomEventType } from "../../shared/src/index.js";

const roomEventTypes = [
  "ROOM_CREATED",
  "PLAYER_JOINED",
  "PLAYER_RENAMED",
  "PLAYER_REMOVED",
  "GAME_STARTED",
  "GAME_FINISHED",
  "ROUND_CONFIRMED",
  "DISCARD_WIN",
  "SELF_DRAW",
  "KONG",
  "DRAW_GAME",
  "UNDO",
] as const satisfies readonly RoomEventType[];

export function isRoomEventType(value: string): value is RoomEventType {
  return roomEventTypes.some((eventType) => eventType === value);
}

export function isRoomEventPayload(value: unknown): value is RoomEventPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidEventOperator(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 64;
}
