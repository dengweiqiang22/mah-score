import type { CreateRoomResponse } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { getRedisConfigurationError } from "../../services/redis";
import { createRoom } from "../../services/roomService";

export async function POST(): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  try {
    const room = await createRoom();
    const data: CreateRoomResponse = {
      roomId: room.roomId,
    };

    return jsonSuccess(data, {
      status: 201,
    });
  } catch (error) {
    console.error("Failed to create room.", error);

    return jsonFailure("Failed to create room.", "ROOM_CREATE_FAILED", {
      status: 500,
    });
  }
}

const createRoomFunction = {
  async fetch(): Promise<Response> {
    return POST();
  },
};

export default createRoomFunction;
