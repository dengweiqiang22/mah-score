import type { RoomEvent, RoomEventPayload, RoomEventType } from "@mah-score/shared";

import { redis } from "./redis";
import { getRoom } from "./roomService";

interface AppendRoomEventInput {
  readonly roomId: string;
  readonly type: RoomEventType;
  readonly operator: string;
  readonly payload: RoomEventPayload;
}

function getRoomKey(roomId: string): string {
  return `room:${roomId}`;
}

function getRoomEventsKey(roomId: string): string {
  return `room:${roomId}:events`;
}

function createEventId(): string {
  return `event_${crypto.randomUUID()}`;
}

function parseRoomEvent(value: unknown): RoomEvent | undefined {
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
    typeof parsedValue.version !== "number" ||
    typeof parsedValue.operator !== "string" ||
    typeof parsedValue.timestamp !== "string" ||
    typeof parsedValue.payload !== "object" ||
    parsedValue.payload === null ||
    Array.isArray(parsedValue.payload)
  ) {
    return undefined;
  }

  return parsedValue as RoomEvent;
}

export async function appendRoomEvent(input: AppendRoomEventInput): Promise<RoomEvent> {
  const room = await getRoom(input.roomId);

  if (room === undefined) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const timestamp = new Date().toISOString();
  const version = await redis.hincrby(getRoomKey(input.roomId), "version", 1);
  const event: RoomEvent = {
    id: createEventId(),
    roomId: input.roomId,
    type: input.type,
    version,
    operator: input.operator,
    timestamp,
    payload: input.payload,
  };

  await redis.rpush(getRoomEventsKey(input.roomId), JSON.stringify(event));
  await redis.hset(getRoomKey(input.roomId), {
    updatedAt: timestamp,
  });

  return event;
}

export async function readRoomEvents(roomId: string): Promise<readonly RoomEvent[]> {
  const values = await redis.lrange<unknown>(getRoomEventsKey(roomId), 0, -1);

  return values.flatMap((value) => {
    const event = parseRoomEvent(value);

    return event === undefined ? [] : [event];
  });
}

export async function readRoomEventsAfterVersion(
  roomId: string,
  version: number,
): Promise<readonly RoomEvent[]> {
  const events = await readRoomEvents(roomId);

  return events.filter((event) => event.version > version);
}

function getUndoTargetEventId(event: RoomEvent): string | undefined {
  const value = event.payload.targetEventId;

  return typeof value === "string" ? value : undefined;
}

export function getLastUndoableEvent(
  events: readonly RoomEvent[],
  targetEventId?: string,
): RoomEvent | undefined {
  const undoneEventIds = new Set<string>();

  for (const event of events) {
    if (event.type === "UNDO") {
      const undoTargetEventId = getUndoTargetEventId(event);

      if (undoTargetEventId !== undefined) {
        undoneEventIds.add(undoTargetEventId);
      }
    }
  }

  const undoableEvents = events.filter(
    (event) =>
      event.type !== "UNDO" &&
      (event.type === "DISCARD_WIN" || event.type === "SELF_DRAW" || event.type === "DRAW_GAME") &&
      !undoneEventIds.has(event.id),
  );

  if (targetEventId !== undefined) {
    return undoableEvents.find((event) => event.id === targetEventId);
  }

  return undoableEvents.at(-1);
}
