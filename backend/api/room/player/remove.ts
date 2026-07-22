import type { RemovePlayerRequest } from "../../../../shared/src/index.js";

import { jsonFailure, jsonSuccess } from "../../../services/apiResponse.js";
import { readJsonBody } from "../../../services/requestBody.js";
import { jsonRoomBusyFailure } from "../../../services/roomFailure.js";
import { getRedisConfigurationError } from "../../../services/redis.js";
import { removePlayer } from "../../../services/roomService.js";
import { isExpectedPlayerEditError, isValidRoomId } from "../../../services/roomValidation.js";

function parseRemovePlayerRequest(value: unknown): RemovePlayerRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    !("playerId" in value) ||
    !("requesterPlayerId" in value) ||
    typeof value.roomId !== "string" ||
    typeof value.playerId !== "string" ||
    typeof value.requesterPlayerId !== "string"
  ) {
    return undefined;
  }

  return {
    roomId: value.roomId.trim(),
    playerId: value.playerId.trim(),
    requesterPlayerId: value.requesterPlayerId.trim(),
  };
}

function getRemoveFailure(error: unknown): Response {
  if (!(error instanceof Error)) {
    return jsonFailure("删除玩家失败，请稍后再试。", "PLAYER_REMOVE_FAILED", {
      status: 500,
    });
  }

  if (error.message === "ROOM_NOT_FOUND") {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  if (error.message === "ROOM_NOT_EDITABLE") {
    return jsonFailure("当前房间不能删除玩家。", "ROOM_NOT_EDITABLE", {
      status: 409,
    });
  }

  if (error.message === "ROOM_BUSY") {
    return jsonRoomBusyFailure();
  }

  if (error.message === "PLAYER_NOT_FOUND") {
    return jsonFailure("玩家不存在。", "PLAYER_NOT_FOUND", {
      status: 404,
    });
  }

  if (error.message === "ROOM_OWNER_REQUIRED") {
    return jsonFailure("只有房主可以删除玩家。", "ROOM_OWNER_REQUIRED", {
      status: 403,
    });
  }

  return jsonFailure("删除玩家失败，请稍后再试。", "PLAYER_REMOVE_FAILED", {
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
  const parsedRequest = parseRemovePlayerRequest(requestBody);

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

  if (parsedRequest.playerId.length === 0) {
    return jsonFailure("玩家不存在。", "PLAYER_NOT_FOUND", {
      status: 404,
    });
  }

  if (parsedRequest.requesterPlayerId.length === 0) {
    return jsonFailure("玩家身份无效。", "INVALID_REQUESTER", {
      status: 403,
    });
  }

  try {
    await removePlayer(
      parsedRequest.roomId,
      parsedRequest.requesterPlayerId,
      parsedRequest.playerId,
    );

    return jsonSuccess({});
  } catch (error) {
    if (!isExpectedPlayerEditError(error)) {
      console.error("Failed to remove player.", error);
    }

    return getRemoveFailure(error);
  }
}

const removePlayerFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default removePlayerFunction;
