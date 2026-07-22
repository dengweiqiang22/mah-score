import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer } from "../types/room.js";

function getStringPayloadValue(event: RoomEvent, key: string): string | undefined {
  const value = event.payload[key];

  return typeof value === "string" ? value : undefined;
}

export function getRoomOwnerPlayerId(
  events: readonly RoomEvent[],
  players: readonly RoomPlayer[],
): string | undefined {
  const roomCreatedEvent = events.find((event) => event.type === "ROOM_CREATED");
  const ownerPlayerId = roomCreatedEvent?.payload.ownerPlayerId;

  if (typeof ownerPlayerId === "string" && ownerPlayerId.length > 0) {
    return ownerPlayerId;
  }

  const ownerJoinEvent = events.find((event) => event.type === "PLAYER_JOINED");

  return ownerJoinEvent === undefined
    ? players[0]?.id
    : getStringPayloadValue(ownerJoinEvent, "playerId");
}
