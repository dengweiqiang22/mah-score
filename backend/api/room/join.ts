import type { JoinRoomRequest, JoinRoomResponse } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { readJsonBody } from "../../services/requestBody";
import { getRedisConfigurationError } from "../../services/redis";
import { joinRoom } from "../../services/roomService";

function parseJoinRoomRequest(value: unknown): JoinRoomRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    !("nickname" in value) ||
    typeof value.roomId !== "string" ||
    typeof value.nickname !== "string"
  ) {
    return undefined;
  }

  return {
    roomId: value.roomId.trim(),
    nickname: value.nickname.trim(),
  };
}

function isValidRoomId(roomId: string): boolean {
  return /^\d{3}$/u.test(roomId);
}

function getJoinRoomFailure(error: unknown): Response {
  if (!(error instanceof Error)) {
    return jsonFailure("加入房间失败，请稍后再试。", "ROOM_JOIN_FAILED", {
      status: 500,
    });
  }

  if (error.message === "ROOM_NOT_FOUND") {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  if (error.message === "ROOM_NOT_JOINABLE") {
    return jsonFailure("当前房间不能加入。", "ROOM_NOT_JOINABLE", {
      status: 409,
    });
  }

  if (error.message === "ROOM_FULL") {
    return jsonFailure("房间人数已满。", "ROOM_FULL", {
      status: 409,
    });
  }

  if (error.message === "PLAYER_NICKNAME_EXISTS") {
    return jsonFailure("昵称已存在。", "PLAYER_NICKNAME_EXISTS", {
      status: 409,
    });
  }

  return jsonFailure("加入房间失败，请稍后再试。", "ROOM_JOIN_FAILED", {
    status: 500,
  });
}

function isExpectedJoinRoomError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "ROOM_NOT_FOUND" ||
      error.message === "ROOM_NOT_JOINABLE" ||
      error.message === "ROOM_FULL" ||
      error.message === "PLAYER_NICKNAME_EXISTS")
  );
}

export async function POST(request: Request): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  const requestBody = await readJsonBody(request);
  const parsedRequest = parseJoinRoomRequest(requestBody);

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

  if (parsedRequest.nickname.length === 0 || parsedRequest.nickname.length > 12) {
    return jsonFailure("昵称长度必须为 1 到 12 个字符。", "INVALID_NICKNAME", {
      status: 400,
    });
  }

  try {
    const player = await joinRoom(parsedRequest.roomId, parsedRequest.nickname);
    const data: JoinRoomResponse = {
      roomId: parsedRequest.roomId,
      playerId: player.id,
    };

    return jsonSuccess(data);
  } catch (error) {
    if (!isExpectedJoinRoomError(error)) {
      console.error("Failed to join room.", error);
    }

    return getJoinRoomFailure(error);
  }
}

const joinRoomFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default joinRoomFunction;
