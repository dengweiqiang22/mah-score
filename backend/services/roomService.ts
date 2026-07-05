import type { RoomRecord } from "@mah-score/shared";

import { redis } from "./redis";
import { createCandidateRoomId } from "./roomId";

const maxRoomIdAttempts = 20;

function getRoomKey(roomId: string): string {
  return `room:${roomId}`;
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
