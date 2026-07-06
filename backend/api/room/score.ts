import type { AppendRoomEventResponse, ScoreEventRequest } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { appendRoomEvent } from "../../services/eventStore";
import { isValidEventOperator } from "../../services/eventValidation";
import { readJsonBody } from "../../services/requestBody";
import { getRedisConfigurationError } from "../../services/redis";
import { getRoom } from "../../services/roomService";
import { isValidRoomId } from "../../services/roomValidation";
import { getScoreEventPayload, isScoreAction, roomHasPlayer } from "../../services/scoreValidation";

function parseScoreEventRequest(value: unknown): ScoreEventRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    !("action" in value) ||
    !("operator" in value) ||
    typeof value.roomId !== "string" ||
    typeof value.action !== "string" ||
    typeof value.operator !== "string" ||
    !isScoreAction(value.action)
  ) {
    return undefined;
  }

  if (value.action === "DISCARD_WIN") {
    if (
      !("winnerId" in value) ||
      !("discarderId" in value) ||
      typeof value.winnerId !== "string" ||
      typeof value.discarderId !== "string"
    ) {
      return undefined;
    }

    return {
      roomId: value.roomId.trim(),
      action: value.action,
      operator: value.operator.trim(),
      winnerId: value.winnerId.trim(),
      discarderId: value.discarderId.trim(),
    };
  }

  if (value.action === "SELF_DRAW") {
    if (!("winnerId" in value) || typeof value.winnerId !== "string") {
      return undefined;
    }

    return {
      roomId: value.roomId.trim(),
      action: value.action,
      operator: value.operator.trim(),
      winnerId: value.winnerId.trim(),
    };
  }

  return {
    roomId: value.roomId.trim(),
    action: value.action,
    operator: value.operator.trim(),
  };
}

function getInvalidPlayerResponse(): Response {
  return jsonFailure("玩家不存在。", "PLAYER_NOT_FOUND", {
    status: 404,
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
  const parsedRequest = parseScoreEventRequest(requestBody);

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

  if (!isValidEventOperator(parsedRequest.operator)) {
    return jsonFailure("操作者不能为空。", "INVALID_OPERATOR", {
      status: 400,
    });
  }

  const room = await getRoom(parsedRequest.roomId);

  if (room === undefined) {
    return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
      status: 404,
    });
  }

  if (room.status !== "PLAYING") {
    return jsonFailure("游戏开始后才能计分。", "ROOM_NOT_PLAYING", {
      status: 409,
    });
  }

  if (parsedRequest.action === "DISCARD_WIN") {
    if (
      !roomHasPlayer(room, parsedRequest.winnerId) ||
      !roomHasPlayer(room, parsedRequest.discarderId)
    ) {
      return getInvalidPlayerResponse();
    }

    if (parsedRequest.winnerId === parsedRequest.discarderId) {
      return jsonFailure("赢家和放炮者不能是同一名玩家。", "INVALID_SCORE_PLAYERS", {
        status: 400,
      });
    }
  }

  if (parsedRequest.action === "SELF_DRAW" && !roomHasPlayer(room, parsedRequest.winnerId)) {
    return getInvalidPlayerResponse();
  }

  try {
    const event = await appendRoomEvent({
      roomId: parsedRequest.roomId,
      type: parsedRequest.action,
      operator: parsedRequest.operator,
      payload: getScoreEventPayload(parsedRequest),
    });
    const data: AppendRoomEventResponse = {
      event,
    };

    return jsonSuccess(data, {
      status: 201,
    });
  } catch (error) {
    console.error("Failed to append score event.", error);

    return jsonFailure("记录计分事件失败，请稍后再试。", "SCORE_EVENT_APPEND_FAILED", {
      status: 500,
    });
  }
}

const scoreFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default scoreFunction;
