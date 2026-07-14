import type { RoomEvent, RoomRecord, RoomSnapshot } from "../../shared/src/index.js";

import { buildReplayEventsFromSnapshot, replayRoomEvents } from "../../shared/src/index.js";

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

function isRoomPlayer(value: unknown): value is RoomRecord["players"][number] {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "nickname" in value &&
    typeof value.id === "string" &&
    typeof value.nickname === "string"
  );
}

function parsePlayers(value: unknown): RoomRecord["players"] {
  const parsedValue = typeof value === "string" ? (JSON.parse(value) as unknown) : value;

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue.filter(
    (player): player is RoomRecord["players"][number] =>
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

  if (
    version === undefined ||
    Number.isNaN(version) ||
    typeof value.status === "undefined" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return undefined;
  }

  if (value.status !== "WAITING" && value.status !== "PLAYING" && value.status !== "FINISHED") {
    return undefined;
  }

  const legacyPlayers = parsePlayers(value.players);
  const snapshot: RoomSnapshot = {
    roomId,
    players: legacyPlayers,
    status: value.status,
    createdAt: value.createdAt,
  };
  const replayState = replayRoomEvents(buildReplayEventsFromSnapshot(snapshot, events));

  return {
    roomId,
    version,
    players: replayState.players.length > 0 ? replayState.players : legacyPlayers,
    status: replayState.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
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

async function createUnusedRoomId(): Promise<string> {
  for (let attempt = 0; attempt < maxRoomIdAttempts; attempt += 1) {
    const roomId = createCandidateRoomId();
    const roomExists = await redis.exists(getRoomKey(roomId));

    if (roomExists === 0) {
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
): Promise<{ readonly room: RoomRecord; readonly events: readonly RoomEvent[] }> {
  const roomId = await createUnusedRoomId();
  const now = new Date().toISOString();
  const player = {
    id: createPlayerId(),
    nickname,
  };
  const room: RoomRecord = {
    roomId,
    version: 0,
    players: [player],
    status: "WAITING",
    createdAt: now,
    updatedAt: now,
  };

  await redis.hset(getRoomKey(roomId), {
    version: room.version,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  });

  await appendRoomEvent({
    roomId,
    type: "ROOM_CREATED",
    operator: "room",
    payload: {},
  });

  await appendRoomEvent({
    roomId,
    type: "PLAYER_JOINED",
    operator: "room",
    payload: {
      playerId: player.id,
      nickname: player.nickname,
    },
  });

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
): Promise<RoomRecord["players"][number]> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);
    const normalizedNickname = nickname.trim();

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
      id: createPlayerId(),
      nickname: normalizedNickname,
    };

    await appendRoomEvent({
      roomId,
      type: "PLAYER_JOINED",
      operator: "room",
      payload: {
        playerId: player.id,
        nickname: player.nickname,
      },
    });

    return player;
  });
}

export async function renamePlayer(
  roomId: string,
  playerId: string,
  nickname: string,
): Promise<RoomRecord["players"][number]> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);
    const normalizedNickname = nickname.trim();

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

    if (room.players.some((player) => player.id !== playerId && player.nickname === normalizedNickname)) {
      throw new Error("PLAYER_NICKNAME_EXISTS");
    }

    const updatedPlayers = room.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
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

export async function removePlayer(roomId: string, playerId: string): Promise<void> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);

    if (room === undefined) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "WAITING") {
      throw new Error("ROOM_NOT_EDITABLE");
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
