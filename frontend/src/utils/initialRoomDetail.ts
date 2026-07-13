import type { RoomEvent, RoomRecord } from "@mah-score/shared";

const storageKeyPrefix = "mah-score:initial-room-detail:";

interface InitialRoomDetail {
  readonly room: RoomRecord;
  readonly events: readonly RoomEvent[];
}

function getStorageKey(roomId: string): string {
  return `${storageKeyPrefix}${roomId}`;
}

function isRoomRecord(value: unknown, roomId: string): value is RoomRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "roomId" in value &&
    "version" in value &&
    "players" in value &&
    "status" in value &&
    "createdAt" in value &&
    "updatedAt" in value &&
    value.roomId === roomId &&
    typeof value.version === "number" &&
    Array.isArray(value.players) &&
    (value.status === "WAITING" || value.status === "PLAYING" || value.status === "FINISHED") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isRoomEvent(value: unknown, roomId: string): value is RoomEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "id" in value &&
    "roomId" in value &&
    "type" in value &&
    "version" in value &&
    "operator" in value &&
    "timestamp" in value &&
    "payload" in value &&
    typeof value.id === "string" &&
    value.roomId === roomId &&
    typeof value.type === "string" &&
    typeof value.version === "number" &&
    typeof value.operator === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.payload === "object" &&
    value.payload !== null &&
    !Array.isArray(value.payload)
  );
}

function parseInitialRoomDetail(value: unknown, roomId: string): InitialRoomDetail | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("room" in value) ||
    !("events" in value) ||
    !isRoomRecord(value.room, roomId) ||
    !Array.isArray(value.events)
  ) {
    return undefined;
  }

  const events = value.events.filter((event): event is RoomEvent => isRoomEvent(event, roomId));

  if (events.length !== value.events.length) {
    return undefined;
  }

  return {
    room: value.room,
    events,
  };
}

export function saveInitialRoomDetail(detail: InitialRoomDetail): void {
  try {
    sessionStorage.setItem(getStorageKey(detail.room.roomId), JSON.stringify(detail));
  } catch {
    // Initial room detail is an optimization. Failure should not block navigation.
  }
}

export function takeInitialRoomDetail(roomId: string): InitialRoomDetail | undefined {
  const storageKey = getStorageKey(roomId);

  try {
    const rawValue = sessionStorage.getItem(storageKey);

    if (rawValue === null) {
      return undefined;
    }

    sessionStorage.removeItem(storageKey);

    return parseInitialRoomDetail(JSON.parse(rawValue) as unknown, roomId);
  } catch {
    sessionStorage.removeItem(storageKey);
    return undefined;
  }
}
