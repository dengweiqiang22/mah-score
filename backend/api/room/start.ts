import type { StartRoomRequest } from "../../../shared/src/index.js";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse.js";
import { readJsonBody } from "../../services/requestBody.js";
import { jsonRoomBusyFailure } from "../../services/roomFailure.js";
import { getRedisConfigurationError } from "../../services/redis.js";
import { startRoom } from "../../services/roomService.js";
import { isValidRoomId } from "../../services/roomValidation.js";

function parseStartRoomRequest(value: unknown): StartRoomRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    typeof value.roomId !== "string"
  ) {
    return undefined;
  }

  return {
    roomId: value.roomId.trim(),
  };
}

function isExpectedStartRoomError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "ROOM_NOT_FOUND" ||
      error.message === "ROOM_NOT_STARTABLE" ||
      error.message === "ROOM_BUSY" ||
      error.message === "INVALID_PLAYER_COUNT")
  );
}

function getStartRoomFailure(error: unknown): Response {
  if (!(error instanceof Error)) {
    return jsonFailure("开始游戏失败，请稍后再试。", "ROOM_START_FAILED", {
      status: 500,
    });
  }

  if (error.message === "ROOM_NOT_FOUND") {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  if (error.message === "ROOM_NOT_STARTABLE") {
    return jsonFailure("当前房间不能开始游戏。", "ROOM_NOT_STARTABLE", {
      status: 409,
    });
  }

  if (error.message === "ROOM_BUSY") {
    return jsonRoomBusyFailure();
  }

  if (error.message === "INVALID_PLAYER_COUNT") {
    return jsonFailure("开始游戏需要 2 到 4 名玩家。", "INVALID_PLAYER_COUNT", {
      status: 400,
    });
  }

  return jsonFailure("开始游戏失败，请稍后再试。", "ROOM_START_FAILED", {
    status: 500,
  });
}

export async function POST(request: Request): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  const requestBody = await readJsonBody(request);
  const parsedRequest = parseStartRoomRequest(requestBody);

  if (parsedRequest === undefined) {
    return jsonFailure("请求格式不正确。", "INVALID_REQUEST", {
      status: 400,
    });
  }

  if (!isValidRoomId(parsedRequest.roomId)) {
    return jsonFailure("房间号必须是三位数字。", "INVALID_ROOM_ID", {
      status: 400,
    });
  }

  try {
    await startRoom(parsedRequest.roomId);

    return jsonSuccess({});
  } catch (error) {
    if (!isExpectedStartRoomError(error)) {
      console.error("Failed to start room.", error);
    }

    return getStartRoomFailure(error);
  }
}

const startRoomFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default startRoomFunction;
