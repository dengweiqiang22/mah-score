import type { RoomRecord } from "@mah-score/shared";

import { redis } from "./redis";
import { createCandidateRoomId } from "./roomId";

const maxRoomIdAttempts = 20;
const maxPlayers = 4;

function getRoomKey(roomId: string): string {
  return `room:${roomId}`;
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

function parseRoom(roomId: string, value: Record<string, unknown>): RoomRecord | undefined {
  const version =
    typeof value.version === "number"
      ? value.version
      : typeof value.version === "string"
        ? Number.parseInt(value.version, 10)
        : undefined;

  if (
    version === undefined ||
    Number.isNaN(version) ||
    typeof value.status !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return undefined;
  }

  if (value.status !== "WAITING" && value.status !== "PLAYING" && value.status !== "FINISHED") {
    return undefined;
  }

  return {
    roomId,
    version,
    players: parsePlayers(value.players),
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
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

export async function createRoom(): Promise<RoomRecord> {
  const roomId = await createUnusedRoomId();
  const now = new Date().toISOString();
  const room: RoomRecord = {
    roomId,
    version: 0,
    players: [],
    status: "WAITING",
    createdAt: now,
    updatedAt: now,
  };

  await redis.hset(getRoomKey(roomId), {
    version: room.version,
    players: JSON.stringify(room.players),
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  });

  return room;
}

export async function getRoom(roomId: string): Promise<RoomRecord | undefined> {
  const roomValue = await redis.hgetall(getRoomKey(roomId));

  if (roomValue === null) {
    return undefined;
  }

  return parseRoom(roomId, roomValue);
}

export async function joinRoom(
  roomId: string,
  nickname: string,
): Promise<RoomRecord["players"][number]> {
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
  const updatedPlayers = [...room.players, player];
  const now = new Date().toISOString();

  await redis.hset(getRoomKey(roomId), {
    players: JSON.stringify(updatedPlayers),
    updatedAt: now,
  });

  return player;
}

export async function renamePlayer(
  roomId: string,
  playerId: string,
  nickname: string,
): Promise<RoomRecord["players"][number]> {
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
  const now = new Date().toISOString();

  await redis.hset(getRoomKey(roomId), {
    players: JSON.stringify(updatedPlayers),
    updatedAt: now,
  });

  if (renamedPlayer === undefined) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  return renamedPlayer;
}

export async function removePlayer(roomId: string, playerId: string): Promise<void> {
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

  const now = new Date().toISOString();

  await redis.hset(getRoomKey(roomId), {
    players: JSON.stringify(updatedPlayers),
    updatedAt: now,
  });
}
