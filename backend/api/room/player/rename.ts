import type { RenamePlayerRequest } from "../../../../shared/src/index.js";

import { jsonFailure, jsonSuccess } from "../../../services/apiResponse.js";
import { readJsonBody } from "../../../services/requestBody.js";
import { jsonRoomBusyFailure } from "../../../services/roomFailure.js";
import { getRedisConfigurationError } from "../../../services/redis.js";
import { renamePlayer } from "../../../services/roomService.js";
import {
  isExpectedPlayerEditError,
  isValidNickname,
  isValidRoomId,
} from "../../../services/roomValidation.js";

function parseRenamePlayerRequest(value: unknown): RenamePlayerRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    !("playerId" in value) ||
    !("nickname" in value) ||
    typeof value.roomId !== "string" ||
    typeof value.playerId !== "string" ||
    typeof value.nickname !== "string"
  ) {
    return undefined;
  }

  return {
    roomId: value.roomId.trim(),
    playerId: value.playerId.trim(),
    nickname: value.nickname.trim(),
  };
}

function getRenameFailure(error: unknown): Response {
  if (!(error instanceof Error)) {
    return jsonFailure("修改昵称失败，请稍后再试。", "PLAYER_RENAME_FAILED", {
      status: 500,
    });
  }

  if (error.message === "ROOM_NOT_FOUND") {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  if (error.message === "ROOM_NOT_EDITABLE") {
    return jsonFailure("当前房间不能修改玩家。", "ROOM_NOT_EDITABLE", {
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

  if (error.message === "PLAYER_NICKNAME_EXISTS") {
    return jsonFailure("昵称已存在。", "PLAYER_NICKNAME_EXISTS", {
      status: 409,
    });
  }

  return jsonFailure("修改昵称失败，请稍后再试。", "PLAYER_RENAME_FAILED", {
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
  const parsedRequest = parseRenamePlayerRequest(requestBody);

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

  if (!isValidNickname(parsedRequest.nickname)) {
    return jsonFailure("昵称长度必须为 1 到 12 个字符。", "INVALID_NICKNAME", {
      status: 400,
    });
  }

  try {
    await renamePlayer(parsedRequest.roomId, parsedRequest.playerId, parsedRequest.nickname);

    return jsonSuccess({});
  } catch (error) {
    if (!isExpectedPlayerEditError(error)) {
      console.error("Failed to rename player.", error);
    }

    return getRenameFailure(error);
  }
}

const renamePlayerFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default renamePlayerFunction;
