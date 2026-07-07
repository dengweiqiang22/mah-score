import type { AppendRoomEventResponse, UndoRoomEventRequest } from "@mah-score/shared";

import { jsonFailure, jsonSuccess } from "../../services/apiResponse";
import { appendRoomEvent, getLastUndoableEvent, readRoomEvents } from "../../services/eventStore";
import { isValidEventOperator } from "../../services/eventValidation";
import { readJsonBody } from "../../services/requestBody";
import { jsonRoomBusyFailure } from "../../services/roomFailure";
import { getRedisConfigurationError } from "../../services/redis";
import { getRoom, withRoomLock } from "../../services/roomService";
import { isValidRoomId } from "../../services/roomValidation";

function parseUndoRoomEventRequest(value: unknown): UndoRoomEventRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("roomId" in value) ||
    !("operator" in value) ||
    typeof value.roomId !== "string" ||
    typeof value.operator !== "string"
  ) {
    return undefined;
  }

  if ("targetEventId" in value && value.targetEventId !== undefined && typeof value.targetEventId !== "string") {
    return undefined;
  }

  return {
    roomId: value.roomId.trim(),
    operator: value.operator.trim(),
    targetEventId:
      "targetEventId" in value && typeof value.targetEventId === "string"
        ? value.targetEventId.trim()
        : undefined,
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
  const parsedRequest = parseUndoRoomEventRequest(requestBody);

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

  try {
    const data = await withRoomLock(parsedRequest.roomId, async (): Promise<AppendRoomEventResponse | Response> => {
      const lockedRoom = await getRoom(parsedRequest.roomId);

      if (lockedRoom === undefined) {
        return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
          status: 404,
        });
      }

      const events = await readRoomEvents(parsedRequest.roomId);
      const targetEvent = getLastUndoableEvent(events, parsedRequest.targetEventId);

      if (targetEvent === undefined) {
        return jsonFailure("没有可以撤销的记录。", "NO_UNDOABLE_EVENT", {
          status: 409,
        });
      }

      const event = await appendRoomEvent({
        roomId: parsedRequest.roomId,
        type: "UNDO",
        operator: parsedRequest.operator,
        payload: {
          targetEventId: targetEvent.id,
        },
      });

      return {
        event,
      };
    });

    if (data instanceof Response) {
      return data;
    }

    return jsonSuccess(data, {
      status: 201,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_BUSY") {
      return jsonRoomBusyFailure();
    }

    console.error("Failed to append undo event.", error);

    return jsonFailure("撤销失败，请稍后再试。", "UNDO_EVENT_APPEND_FAILED", {
      status: 500,
    });
  }
}

const undoFunction = {
  async fetch(request: Request): Promise<Response> {
    return POST(request);
  },
};

export default undoFunction;
