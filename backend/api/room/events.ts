import type { GetRoomEventsResponse } from "../../../shared/src/index.js";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse.js";
import { readRoomEvents } from "../../services/eventStore.js";
import { getRedisConfigurationError } from "../../services/redis.js";
import { getRoom } from "../../services/roomService.js";
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

  const room = await getRoom(roomId);

  if (room === undefined) {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  const data: GetRoomEventsResponse = {
    events: await readRoomEvents(roomId),
  };

  return jsonSuccess(data);
}

const roomEventsFunction = {
  async fetch(request: Request): Promise<Response> {
    return GET(request);
  },
};

export default roomEventsFunction;
