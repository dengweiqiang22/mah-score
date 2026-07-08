import type { AppendRoomEventRequest, AppendRoomEventResponse } from "@mah-score/shared";

import { buildReplayEventsFromSnapshot, replayRoomEvents } from "@mah-score/shared";
import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { appendRoomEvent, readRoomEvents } from "../../services/eventStore";
import {
  isRoomEventPayload,
  isRoomEventType,
  isValidEventOperator,
} from "../../services/eventValidation";
import { readJsonBody } from "../../services/requestBody";
import { jsonUnexpectedRoomFailure } from "../../services/roomFailure";
import { getRedisConfigurationError } from "../../services/redis";
import { getRoom } from "../../services/roomService";
import { isValidRoomId } from "../../services/roomValidation";

function parseAppendRoomEventRequest(value: unknown): AppendRoomEventRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    !("type" in value) ||
    !("operator" in value) ||
    !("payload" in value) ||
    typeof value.roomId !== "string" ||
    typeof value.type !== "string" ||
    typeof value.operator !== "string" ||
    !isRoomEventPayload(value.payload)
  ) {
    return undefined;
  }

  if (!isRoomEventType(value.type)) {
    return undefined;
  }

  return {
    roomId: value.roomId.trim(),
    type: value.type,
    operator: value.operator.trim(),
    payload: value.payload,
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
  const parsedRequest = parseAppendRoomEventRequest(requestBody);

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

  if (parsedRequest.type !== "GAME_FINISHED" && parsedRequest.type !== "ROUND_CONFIRMED") {
    return jsonFailure("当前接口只允许记录结束游戏和确认本局事件。", "EVENT_TYPE_NOT_ALLOWED", {
      status: 400,
    });
  }

  if (parsedRequest.type === "GAME_FINISHED" || parsedRequest.type === "ROUND_CONFIRMED") {
    const room = await getRoom(parsedRequest.roomId);

    if (room === undefined) {
      return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
        status: 404,
      });
    }

    if (room.status !== "PLAYING") {
      return jsonFailure("当前房间不能结束游戏。", "ROOM_NOT_PLAYING", {
        status: 409,
      });
    }

    if (parsedRequest.type === "ROUND_CONFIRMED") {
      const roomEvents = await readRoomEvents(parsedRequest.roomId);
      const roomState = replayRoomEvents(
        buildReplayEventsFromSnapshot(
          {
            roomId: room.roomId,
            players: room.players,
            status: room.status,
            createdAt: room.createdAt,
          },
          roomEvents,
        ),
      );

      if (roomState.currentRound.status !== "FINISHED") {
        return jsonFailure("当前本局尚未结束。", "ROUND_NOT_FINISHED", {
          status: 409,
        });
      }
    }
  }

  try {
    const event = await appendRoomEvent(parsedRequest);
    const data: AppendRoomEventResponse = {
      event,
    };

    return jsonSuccess(data, {
      status: 201,
    });
  } catch (error) {
    if (!(error instanceof Error && error.message === "ROOM_NOT_FOUND")) {
      console.error("Failed to append room event.", error);
    }

    if (error instanceof Error && error.message === "ROOM_NOT_FOUND") {
      return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
        status: 404,
      });
    }

    return jsonUnexpectedRoomFailure("记录房间事件失败，请稍后再试。", "EVENT_APPEND_FAILED", {
      status: 500,
    });
  }
}

const roomEventFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default roomEventFunction;
