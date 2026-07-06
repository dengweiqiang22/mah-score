import type { SyncRoomEventsResponse } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { readRoomEventsAfterVersion } from "../../services/eventStore";
import { getRedisConfigurationError } from "../../services/redis";
import { getRoom } from "../../services/roomService";
import { isValidRoomId } from "../../services/roomValidation";

function parseVersion(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const version = Number.parseInt(value, 10);

  if (!Number.isInteger(version) || version < 0) {
    return undefined;
  }

  return version;
}

export async function GET(request: Request): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  const searchParams = new URL(request.url).searchParams;
  const roomId = searchParams.get("roomId")?.trim();
  const version = parseVersion(searchParams.get("version"));

  if (roomId === undefined || !isValidRoomId(roomId)) {
    return jsonFailure("房间号必须是三位数字。", "INVALID_ROOM_ID", {
      status: 400,
    });
  }

  if (version === undefined) {
    return jsonFailure("Version 必须是非负整数。", "INVALID_VERSION", {
      status: 400,
    });
  }

  const room = await getRoom(roomId);

  if (room === undefined) {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  const data: SyncRoomEventsResponse = {
    events: await readRoomEventsAfterVersion(roomId, version),
    version: room.version,
  };

  return jsonSuccess(data);
}

const syncFunction = {
  async fetch(request: Request): Promise<Response> {
    return GET(request);
  },
};

export default syncFunction;
