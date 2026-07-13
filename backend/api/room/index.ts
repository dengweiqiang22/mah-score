import type { GetRoomDetailResponse } from "../../../shared/src/index.js";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse.js";
import { getRedisConfigurationError } from "../../services/redis.js";
import { getRoomDetail } from "../../services/roomService.js";
import { isValidRoomId } from "../../services/roomValidation.js";

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

  const roomDetail = await getRoomDetail(roomId);

  if (roomDetail === undefined) {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  const data: GetRoomDetailResponse = {
    room: roomDetail.room,
    events: roomDetail.events,
  };

  return jsonSuccess(data);
}

const roomFunction = {
  async fetch(request: Request): Promise<Response> {
    return GET(request);
  },
};

export default roomFunction;
