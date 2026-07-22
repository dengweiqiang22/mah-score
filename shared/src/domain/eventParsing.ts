import type { RoomEvent, RoomEventPayload, RoomEventType } from "../types/event.js";

const roomEventTypes = new Set<RoomEventType>([
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
]);

function isRoomEventType(value: string): value is RoomEventType {
  return roomEventTypes.has(value as RoomEventType);
}

function parseRoomEventPayload(
  type: RoomEventType,
  payload: unknown,
): RoomEventPayload | undefined {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as RoomEventPayload;
  }

  if (type === "ROOM_CREATED" && Array.isArray(payload)) {
    return {};
  }

  return undefined;
}

export function parseRoomEvent(value: unknown): RoomEvent | undefined {
  let parsedValue: unknown;

  try {
    parsedValue = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  } catch {
    return undefined;
  }

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    !("id" in parsedValue) ||
    !("roomId" in parsedValue) ||
    !("type" in parsedValue) ||
    !("version" in parsedValue) ||
    !("operator" in parsedValue) ||
    !("timestamp" in parsedValue) ||
    !("payload" in parsedValue) ||
    typeof parsedValue.id !== "string" ||
    typeof parsedValue.roomId !== "string" ||
    typeof parsedValue.type !== "string" ||
    !isRoomEventType(parsedValue.type) ||
    typeof parsedValue.version !== "number" ||
    typeof parsedValue.operator !== "string" ||
    typeof parsedValue.timestamp !== "string"
  ) {
    return undefined;
  }

  const payload = parseRoomEventPayload(parsedValue.type, parsedValue.payload);

  if (payload === undefined) {
    return undefined;
  }

  return {
    id: parsedValue.id,
    roomId: parsedValue.roomId,
    type: parsedValue.type,
    version: parsedValue.version,
    operator: parsedValue.operator,
    timestamp: parsedValue.timestamp,
    payload,
  };
}
