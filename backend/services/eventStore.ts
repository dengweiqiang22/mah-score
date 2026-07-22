import type { RoomEvent, RoomEventPayload, RoomEventType } from "../../shared/src/index.js";

import { parseRoomEvent } from "../../shared/src/index.js";
import { redis } from "./redis.js";

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

function getEventStatusCache(type: RoomEventType): "PLAYING" | "FINISHED" | undefined {
  if (type === "GAME_STARTED") {
    return "PLAYING";
  }

  if (type === "GAME_FINISHED") {
    return "FINISHED";
  }

  return undefined;
}

function parseAppendRoomEventResult(value: unknown): { readonly version: number } | undefined {
  if (!Array.isArray(value) || value.length < 1) {
    return undefined;
  }

  const version = value[0];

  if (typeof version !== "number" || !Number.isInteger(version)) {
    return undefined;
  }

  return {
    version,
  };
}

export async function appendRoomEvent(input: AppendRoomEventInput): Promise<RoomEvent> {
  const timestamp = new Date().toISOString();
  const eventWithoutVersion = {
    id: createEventId(),
    roomId: input.roomId,
    type: input.type,
    operator: input.operator,
    timestamp,
    payload: input.payload,
  };
  const eventStatusCache = getEventStatusCache(input.type);
  const appendEventScript = `
    if redis.call("EXISTS", KEYS[1]) == 0 then
      return {0}
    end

    local version = redis.call("HINCRBY", KEYS[1], "version", 1)
    local event = "{" ..
      "\\"id\\":" .. cjson.encode(ARGV[1]) .. "," ..
      "\\"roomId\\":" .. cjson.encode(ARGV[2]) .. "," ..
      "\\"type\\":" .. cjson.encode(ARGV[3]) .. "," ..
      "\\"version\\":" .. version .. "," ..
      "\\"operator\\":" .. cjson.encode(ARGV[4]) .. "," ..
      "\\"timestamp\\":" .. cjson.encode(ARGV[5]) .. "," ..
      "\\"payload\\":" .. ARGV[6] ..
    "}"

    redis.call("RPUSH", KEYS[2], event)

    if ARGV[7] == "" then
      redis.call("HSET", KEYS[1], "updatedAt", ARGV[5])
    else
      redis.call("HSET", KEYS[1], "status", ARGV[7], "updatedAt", ARGV[5])
    end

    return {version}
  `;
  const scriptResult = parseAppendRoomEventResult(
    await redis.eval(
      appendEventScript,
      [getRoomKey(input.roomId), getRoomEventsKey(input.roomId)],
      [
        eventWithoutVersion.id,
        eventWithoutVersion.roomId,
        eventWithoutVersion.type,
        eventWithoutVersion.operator,
        eventWithoutVersion.timestamp,
        JSON.stringify(eventWithoutVersion.payload),
        eventStatusCache ?? "",
      ],
    ),
  );

  if (scriptResult === undefined) {
    throw new Error("EVENT_APPEND_FAILED");
  }

  if (scriptResult.version === 0) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const event: RoomEvent = {
    ...eventWithoutVersion,
    version: scriptResult.version,
  };

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
  const values = await redis.lrange<unknown>(getRoomEventsKey(roomId), version, -1);
  const events = values.flatMap((value) => {
    const event = parseRoomEvent(value);

    return event === undefined ? [] : [event];
  });

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
      (event.type === "DISCARD_WIN" ||
        event.type === "SELF_DRAW" ||
        event.type === "KONG" ||
        event.type === "DRAW_GAME") &&
      !undoneEventIds.has(event.id),
  );

  if (targetEventId !== undefined) {
    return undoableEvents.find((event) => event.id === targetEventId);
  }

  return undoableEvents.at(-1);
}
