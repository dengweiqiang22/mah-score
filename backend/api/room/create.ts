import type { CreateRoomRequest, CreateRoomResponse } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { readJsonBody } from "../../services/requestBody";
import { getRedisConfigurationError } from "../../services/redis";
import { createRoom } from "../../services/roomService";
import { isValidNickname } from "../../services/roomValidation";

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
    const room = await createRoom(parsedRequest.nickname);
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
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default createRoomFunction;
