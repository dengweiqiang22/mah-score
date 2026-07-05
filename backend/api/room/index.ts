import type { GetRoomResponse } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { getRedisConfigurationError } from "../../services/redis";
import { getRoom } from "../../services/roomService";
import { isValidRoomId } from "../../services/roomValidation";

export async function GET(request: Request): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();

  if (roomId === undefined || !isValidRoomId(roomId)) {
    return jsonFailure("房间号必须是三位数字。", "INVALID_ROOM_ID", {
      status: 400,
    });
  }

  const room = await getRoom(roomId);

  if (room === undefined) {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  const data: GetRoomResponse = {
    room,
  };

  return jsonSuccess(data);
}

const roomFunction = {
  async fetch(request: Request): Promise<Response> {
    return GET(request);
  },
};

export default roomFunction;
