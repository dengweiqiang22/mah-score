import type { CreateRoomRequest, CreateRoomResponse } from "../../../shared/src/index.js";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse.js";
import { readJsonBody } from "../../services/requestBody.js";
import { jsonUnexpectedRoomFailure } from "../../services/roomFailure.js";
import { getRedisConfigurationError } from "../../services/redis.js";
import { createRoomDetail } from "../../services/roomService.js";
import { isValidNickname } from "../../services/roomValidation.js";

function parseCreateRoomRequest(value: unknown): CreateRoomRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("nickname" in value) ||
    typeof value.nickname !== "string"
  ) {
    return undefined;
  }

  return {
    nickname: value.nickname.trim(),
  };
}

export async function POST(request: Request): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  const requestBody = await readJsonBody(request);
  const parsedRequest = parseCreateRoomRequest(requestBody);

  if (parsedRequest === undefined) {
    return jsonFailure("请求格式不正确。", "INVALID_REQUEST", {
      status: 400,
    });
  }

  if (!isValidNickname(parsedRequest.nickname)) {
    return jsonFailure("昵称长度必须为 1 到 12 个字符。", "INVALID_NICKNAME", {
      status: 400,
    });
  }

  try {
    const roomDetail = await createRoomDetail(parsedRequest.nickname);
    const { room, events } = roomDetail;
    const owner = room.players[0];

    if (owner === undefined) {
      return jsonUnexpectedRoomFailure("创建房间失败，请稍后再试。", "ROOM_CREATE_FAILED", {
        status: 500,
      });
    }

    const data: CreateRoomResponse = {
      roomId: room.roomId,
      playerId: owner.id,
      room,
      events,
    };

    return jsonSuccess(data, {
      status: 201,
    });
  } catch (error) {
    console.error("Failed to create room.", error);

    return jsonUnexpectedRoomFailure("创建房间失败，请稍后再试。", "ROOM_CREATE_FAILED", {
      status: 500,
    });
  }
}

const createRoomFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default createRoomFunction;
