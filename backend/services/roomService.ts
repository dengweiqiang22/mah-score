import type { RoomEvent, RoomRecord, RoomSnapshot } from "../../shared/src/index.js";

import {
  buildReplayEventsFromSnapshot,
  getRoomOwnerPlayerId,
  replayRoomEvents,
} from "../../shared/src/index.js";

import { redis } from "./redis.js";
import { appendRoomEvent, readRoomEvents } from "./eventStore.js";
import { createCandidateRoomId } from "./roomId.js";

const maxRoomIdAttempts = 20;
const minPlayersToStart = 2;
const maxPlayers = 4;
const roomLockTtlMilliseconds = 5000;

function getRoomKey(roomId: string): string {
  return `room:${roomId}`;
}

function getRoomLockKey(roomId: string): string {
  return `room:${roomId}:lock`;
}

function createPlayerId(): string {
  return `player_${crypto.randomUUID()}`;
}

function normalizeAvatarId(avatarId: string | undefined): string | undefined {
  const normalizedAvatarId = avatarId?.trim();

  return normalizedAvatarId === undefined || normalizedAvatarId.length === 0
    ? undefined
    : normalizedAvatarId;
}

function isRoomPlayer(value: unknown): value is RoomRecord["players"][number] {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "nickname" in value &&
    typeof value.id === "string" &&
    typeof value.nickname === "string" &&
    (!("avatarId" in value) || typeof value.avatarId === "string")
  );
}

function parsePlayers(value: unknown): RoomRecord["players"] {
  let parsedValue: unknown;

  try {
    parsedValue = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  } catch {
    return [];
  }

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue.filter((player): player is RoomRecord["players"][number] =>
    isRoomPlayer(player),
  );
}

function parseRoom(
  roomId: string,
  value: Record<string, unknown>,
  events: readonly RoomEvent[],
): RoomRecord | undefined {
  const version =
    typeof value.version === "number"
      ? value.version
      : typeof value.version === "string"
        ? Number.parseInt(value.version, 10)
        : undefined;

  if (version === undefined || Number.isNaN(version)) {
    return undefined;
  }

  const hashStatus =
    value.status === "WAITING" || value.status === "PLAYING" || value.status === "FINISHED"
      ? value.status
      : undefined;
  const firstEvent = events[0];
  const lastEvent = events.at(-1);
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : firstEvent?.timestamp;

  if (createdAt === undefined) {
    return undefined;
  }

  const legacyPlayers = parsePlayers(value.players);
  const snapshot: RoomSnapshot = {
    roomId,
    players: legacyPlayers,
    status: hashStatus ?? "WAITING",
    createdAt,
  };
  const replayState = replayRoomEvents(buildReplayEventsFromSnapshot(snapshot, events));

  return {
    roomId,
    version: Math.max(version, replayState.version),
    players: replayState.players.length > 0 ? replayState.players : legacyPlayers,
    status: replayState.status,
    createdAt,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : (lastEvent?.timestamp ?? createdAt),
  };
}

function parseRoomVersion(value: Record<string, unknown>): number | undefined {
  const version =
    typeof value.version === "number"
      ? value.version
      : typeof value.version === "string"
        ? Number.parseInt(value.version, 10)
        : undefined;

  if (version === undefined || Number.isNaN(version)) {
    return undefined;
  }

  return version;
}

function parseCreateRoomResult(value: unknown): boolean | undefined {
  if (!Array.isArray(value) || value.length < 1) {
    return undefined;
  }

  if (value[0] === 1) {
    return true;
  }

  if (value[0] === 0) {
    return false;
  }

  return undefined;
}

async function createInitialRoom(
  roomId: string,
  player: RoomRecord["players"][number],
  timestamp: string,
): Promise<boolean> {
  const roomCreatedEvent = {
    id: `event_${crypto.randomUUID()}`,
    roomId,
    type: "ROOM_CREATED",
    operator: "room",
    timestamp,
    payload: {
      ownerPlayerId: player.id,
    },
  };
  const playerJoinedEvent = {
    id: `event_${crypto.randomUUID()}`,
    roomId,
    type: "PLAYER_JOINED",
    operator: "room",
    timestamp,
    payload: {
      ...(player.avatarId === undefined ? {} : { avatarId: player.avatarId }),
      playerId: player.id,
      nickname: player.nickname,
    },
  };
  const createRoomScript = `
    if redis.call("EXISTS", KEYS[1]) ~= 0 then
      return {0}
    end

    local roomCreatedEvent = "{" ..
      "\\"id\\":" .. cjson.encode(ARGV[1]) .. "," ..
      "\\"roomId\\":" .. cjson.encode(ARGV[2]) .. "," ..
      "\\"type\\":" .. cjson.encode("ROOM_CREATED") .. "," ..
      "\\"version\\":1," ..
      "\\"operator\\":" .. cjson.encode("room") .. "," ..
      "\\"timestamp\\":" .. cjson.encode(ARGV[3]) .. "," ..
      "\\"payload\\":" .. ARGV[6] ..
    "}"

    local playerJoinedEvent = "{" ..
      "\\"id\\":" .. cjson.encode(ARGV[4]) .. "," ..
      "\\"roomId\\":" .. cjson.encode(ARGV[2]) .. "," ..
      "\\"type\\":" .. cjson.encode("PLAYER_JOINED") .. "," ..
      "\\"version\\":2," ..
      "\\"operator\\":" .. cjson.encode("room") .. "," ..
      "\\"timestamp\\":" .. cjson.encode(ARGV[3]) .. "," ..
      "\\"payload\\":" .. ARGV[5] ..
    "}"

    redis.call(
      "HSET",
      KEYS[1],
      "version",
      2,
      "status",
      "WAITING",
      "createdAt",
      ARGV[3],
      "updatedAt",
      ARGV[3]
    )
    redis.call("RPUSH", KEYS[2], roomCreatedEvent, playerJoinedEvent)

    return {1}
  `;
  const created = parseCreateRoomResult(
    await redis.eval(
      createRoomScript,
      [getRoomKey(roomId), `${getRoomKey(roomId)}:events`],
      [
        roomCreatedEvent.id,
        roomCreatedEvent.roomId,
        roomCreatedEvent.timestamp,
        playerJoinedEvent.id,
        JSON.stringify(playerJoinedEvent.payload),
        JSON.stringify(roomCreatedEvent.payload),
      ],
    ),
  );

  if (created === undefined) {
    throw new Error("ROOM_CREATE_FAILED");
  }

  return created;
}

async function createUnusedInitialRoom(
  player: RoomRecord["players"][number],
  timestamp: string,
): Promise<string> {
  for (let attempt = 0; attempt < maxRoomIdAttempts; attempt += 1) {
    const roomId = createCandidateRoomId();
    const created = await createInitialRoom(roomId, player, timestamp);

    if (created) {
      return roomId;
    }
  }

  throw new Error("Unable to allocate an unused room id.");
}

async function acquireRoomLock(roomId: string): Promise<string | undefined> {
  const lockToken = crypto.randomUUID();
  const locked = await redis.set(getRoomLockKey(roomId), lockToken, {
    nx: true,
    px: roomLockTtlMilliseconds,
  });

  if (locked === null) {
    return undefined;
  }

  return lockToken;
}

async function releaseRoomLock(roomId: string, lockToken: string): Promise<void> {
  const releaseScript = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    end

    return 0
  `;

  try {
    await redis.eval(releaseScript, [getRoomLockKey(roomId)], [lockToken]);
  } catch (error) {
    console.error("Failed to release room lock.", error);
  }
}

export async function withRoomLock<T>(roomId: string, operation: () => Promise<T>): Promise<T> {
  const lockToken = await acquireRoomLock(roomId);

  if (lockToken === undefined) {
    throw new Error("ROOM_BUSY");
  }

  try {
    return await operation();
  } finally {
    await releaseRoomLock(roomId, lockToken);
  }
}

export async function createRoomDetail(
  nickname: string,
  avatarId?: string,
): Promise<{ readonly room: RoomRecord; readonly events: readonly RoomEvent[] }> {
  const now = new Date().toISOString();
  const normalizedAvatarId = normalizeAvatarId(avatarId);
  const player = {
    ...(normalizedAvatarId === undefined ? {} : { avatarId: normalizedAvatarId }),
    id: createPlayerId(),
    nickname,
  };
  const roomId = await createUnusedInitialRoom(player, now);

  const createdRoomDetail = await getRoomDetail(roomId);

  if (createdRoomDetail === undefined) {
    throw new Error("ROOM_NOT_FOUND");
  }

  return createdRoomDetail;
}

export async function createRoom(nickname: string): Promise<RoomRecord> {
  const createdRoomDetail = await createRoomDetail(nickname);

  return createdRoomDetail.room;
}

export async function getRoom(roomId: string): Promise<RoomRecord | undefined> {
  const [roomValue, events] = await Promise.all([
    redis.hgetall(getRoomKey(roomId)),
    readRoomEvents(roomId),
  ]);

  if (roomValue === null) {
    return undefined;
  }

  return parseRoom(roomId, roomValue, events);
}

export async function getRoomDetail(
  roomId: string,
): Promise<{ readonly room: RoomRecord; readonly events: readonly RoomEvent[] } | undefined> {
  const [roomValue, events] = await Promise.all([
    redis.hgetall(getRoomKey(roomId)),
    readRoomEvents(roomId),
  ]);

  if (roomValue === null) {
    return undefined;
  }

  const room = parseRoom(roomId, roomValue, events);

  if (room === undefined) {
    return undefined;
  }

  return {
    room,
    events,
  };
}

export async function getRoomVersion(roomId: string): Promise<number | undefined> {
  const roomValue = await redis.hgetall(getRoomKey(roomId));

  if (roomValue === null) {
    return undefined;
  }

  return parseRoomVersion(roomValue);
}

export async function joinRoom(
  roomId: string,
  nickname: string,
  avatarId?: string,
): Promise<RoomRecord["players"][number]> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);
    const normalizedNickname = nickname.trim();
    const normalizedAvatarId = normalizeAvatarId(avatarId);

    if (room === undefined) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "WAITING") {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    if (room.players.length >= maxPlayers) {
      throw new Error("ROOM_FULL");
    }

    if (room.players.some((player) => player.nickname === normalizedNickname)) {
      throw new Error("PLAYER_NICKNAME_EXISTS");
    }

    const player = {
      ...(normalizedAvatarId === undefined ? {} : { avatarId: normalizedAvatarId }),
      id: createPlayerId(),
      nickname: normalizedNickname,
    };

    await appendRoomEvent({
      roomId,
      type: "PLAYER_JOINED",
      operator: "room",
      payload: {
        ...(player.avatarId === undefined ? {} : { avatarId: player.avatarId }),
        playerId: player.id,
        nickname: player.nickname,
      },
    });

    return player;
  });
}

export async function renamePlayer(
  roomId: string,
  requesterPlayerId: string,
  playerId: string,
  nickname: string,
  avatarId?: string,
): Promise<RoomRecord["players"][number]> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);
    const normalizedNickname = nickname.trim();
    const normalizedAvatarId = normalizeAvatarId(avatarId);

    if (room === undefined) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "WAITING") {
      throw new Error("ROOM_NOT_EDITABLE");
    }

    const playerExists = room.players.some((player) => player.id === playerId);

    if (!playerExists) {
      throw new Error("PLAYER_NOT_FOUND");
    }

    if (requesterPlayerId !== playerId) {
      throw new Error("PLAYER_EDIT_FORBIDDEN");
    }

    if (
      room.players.some(
        (player) => player.id !== playerId && player.nickname === normalizedNickname,
      )
    ) {
      throw new Error("PLAYER_NICKNAME_EXISTS");
    }

    const updatedPlayers = room.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            ...(normalizedAvatarId === undefined ? {} : { avatarId: normalizedAvatarId }),
            nickname: normalizedNickname,
          }
        : player,
    );
    const renamedPlayer = updatedPlayers.find((player) => player.id === playerId);

    await appendRoomEvent({
      roomId,
      type: "PLAYER_RENAMED",
      operator: "room",
      payload: {
        ...(normalizedAvatarId === undefined ? {} : { avatarId: normalizedAvatarId }),
        playerId,
        nickname: normalizedNickname,
      },
    });

    if (renamedPlayer === undefined) {
      throw new Error("PLAYER_NOT_FOUND");
    }

    return renamedPlayer;
  });
}

export async function removePlayer(
  roomId: string,
  requesterPlayerId: string,
  playerId: string,
): Promise<void> {
  return withRoomLock(roomId, async () => {
    const roomDetail = await getRoomDetail(roomId);

    if (roomDetail === undefined) {
      throw new Error("ROOM_NOT_FOUND");
    }

    const { events, room } = roomDetail;

    if (room.status !== "WAITING") {
      throw new Error("ROOM_NOT_EDITABLE");
    }

    if (requesterPlayerId !== getRoomOwnerPlayerId(events, room.players)) {
      throw new Error("ROOM_OWNER_REQUIRED");
    }

    const updatedPlayers = room.players.filter((player) => player.id !== playerId);

    if (updatedPlayers.length === room.players.length) {
      throw new Error("PLAYER_NOT_FOUND");
    }

    await appendRoomEvent({
      roomId,
      type: "PLAYER_REMOVED",
      operator: "room",
      payload: {
        playerId,
      },
    });
  });
}

export async function startRoom(roomId: string): Promise<RoomRecord> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);

    if (room === undefined) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "WAITING") {
      throw new Error("ROOM_NOT_STARTABLE");
    }

    if (room.players.length < minPlayersToStart || room.players.length > maxPlayers) {
      throw new Error("INVALID_PLAYER_COUNT");
    }

    await appendRoomEvent({
      roomId,
      type: "GAME_STARTED",
      operator: "room",
      payload: {},
    });

    const startedRoom = await getRoom(roomId);

    if (startedRoom === undefined) {
      throw new Error("ROOM_NOT_FOUND");
    }

    return startedRoom;
  });
}
