import type {
  AppendRoomEventResponse,
  DrawGameScoreRequest,
  ScoreEventRequest,
  ScoreFan,
} from "../../../shared/src/index.js";

import { buildReplayEventsFromSnapshot, replayRoomEvents } from "../../../shared/src/index.js";
import { jsonFailure, jsonSuccess } from "../../services/apiResponse.js";
import { appendRoomEvent, readRoomEvents } from "../../services/eventStore.js";
import { isValidEventOperator } from "../../services/eventValidation.js";
import { readJsonBody } from "../../services/requestBody.js";
import { jsonRoomBusyFailure } from "../../services/roomFailure.js";
import { getRedisConfigurationError } from "../../services/redis.js";
import { getRoom, withRoomLock } from "../../services/roomService.js";
import { isValidRoomId } from "../../services/roomValidation.js";
import {
  getScoreEventPayload,
  getScoreRequestPlayerIds,
  isKongType,
  isScoreAction,
  isScoreFan,
  roomHasPlayer,
} from "../../services/scoreValidation.js";

interface ParseScoreEventRequestFailure {
  readonly code: string;
  readonly message: string;
}

type ParseScoreEventRequestResult =
  | {
      readonly request: ScoreEventRequest;
    }
  | {
      readonly failure: ParseScoreEventRequestFailure;
    };

function parseFailure(
  message = "请求格式不正确。",
  code = "INVALID_REQUEST",
): ParseScoreEventRequestResult {
  return {
    failure: {
      code,
      message,
    },
  };
}

function getOptionalScoreFan(value: object): ScoreFan | undefined {
  if (!("fan" in value)) {
    return undefined;
  }

  return isScoreFan(value.fan) ? value.fan : undefined;
}

function hasInvalidScoreFan(value: object): boolean {
  return "fan" in value && !isScoreFan(value.fan);
}

function getOptionalStringArray(value: object, key: string): readonly string[] | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const arrayValue = (value as Record<string, unknown>)[key];

  if (!Array.isArray(arrayValue) || !arrayValue.every((item) => typeof item === "string")) {
    return undefined;
  }

  return arrayValue.map((item) => item.trim()).filter((item) => item.length > 0);
}

function hasInvalidStringArray(value: object, key: string): boolean {
  return key in value && getOptionalStringArray(value, key) === undefined;
}

function getOptionalReadyHands(
  value: object,
): DrawGameScoreRequest["readyHands"] {
  if (!("readyHands" in value)) {
    return undefined;
  }

  const readyHandsValue = value.readyHands;

  if (!Array.isArray(readyHandsValue)) {
    return undefined;
  }

  const readyHands = readyHandsValue.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("playerId" in item) ||
      !("maxFan" in item) ||
      typeof item.playerId !== "string" ||
      !isScoreFan(item.maxFan)
    ) {
      return undefined;
    }

    return {
      playerId: item.playerId.trim(),
      maxFan: item.maxFan,
    };
  });

  return readyHands.every((item) => item !== undefined)
    ? readyHands.filter((item): item is NonNullable<(typeof readyHands)[number]> => item !== undefined)
    : undefined;
}

function hasInvalidReadyHands(value: object): boolean {
  return "readyHands" in value && getOptionalReadyHands(value) === undefined;
}

function parseScoreEventRequest(value: unknown): ParseScoreEventRequestResult {
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
    return parseFailure();
  }

  if (value.action === "DISCARD_WIN") {
    if (
      !("winnerId" in value) ||
      !("discarderId" in value) ||
      typeof value.winnerId !== "string" ||
      typeof value.discarderId !== "string" ||
      hasInvalidScoreFan(value)
    ) {
      if (hasInvalidScoreFan(value)) {
        return parseFailure("番数必须是 1 到 4 之间的整数。", "INVALID_SCORE_FAN");
      }

      return parseFailure();
    }

    const fan = getOptionalScoreFan(value);

    return {
      request: {
        roomId: value.roomId.trim(),
        action: value.action,
        operator: value.operator.trim(),
        winnerId: value.winnerId.trim(),
        discarderId: value.discarderId.trim(),
        ...(fan === undefined ? {} : { fan }),
      },
    };
  }

  if (value.action === "SELF_DRAW") {
    if (!("winnerId" in value) || typeof value.winnerId !== "string" || hasInvalidScoreFan(value)) {
      if (hasInvalidScoreFan(value)) {
        return parseFailure("番数必须是 1 到 4 之间的整数。", "INVALID_SCORE_FAN");
      }

      return parseFailure();
    }

    const fan = getOptionalScoreFan(value);

    return {
      request: {
        roomId: value.roomId.trim(),
        action: value.action,
        operator: value.operator.trim(),
        winnerId: value.winnerId.trim(),
        ...(fan === undefined ? {} : { fan }),
      },
    };
  }

  if (value.action === "KONG") {
    if (
      !("playerId" in value) ||
      !("kongType" in value) ||
      typeof value.playerId !== "string" ||
      typeof value.kongType !== "string" ||
      !isKongType(value.kongType)
    ) {
      if (
        "kongType" in value &&
        typeof value.kongType === "string" &&
        !isKongType(value.kongType)
      ) {
        return parseFailure("杠牌类型不正确。", "INVALID_KONG_TYPE");
      }

      return parseFailure();
    }

    if (value.kongType === "DISCARD_KONG") {
      if (!("fromPlayerId" in value) || typeof value.fromPlayerId !== "string") {
        return parseFailure("直杠必须提供引杠玩家。", "INVALID_KONG_FROM_PLAYER");
      }

      return {
        request: {
          roomId: value.roomId.trim(),
          action: value.action,
          operator: value.operator.trim(),
          playerId: value.playerId.trim(),
          kongType: value.kongType,
          fromPlayerId: value.fromPlayerId.trim(),
        },
      };
    }

    return {
      request: {
        roomId: value.roomId.trim(),
        action: value.action,
        operator: value.operator.trim(),
        playerId: value.playerId.trim(),
        kongType: value.kongType,
      },
    };
  }

  if (
    hasInvalidStringArray(value, "flowerPigPlayerIds") ||
    hasInvalidStringArray(value, "kongTaxRefundPlayerIds") ||
    hasInvalidStringArray(value, "notReadyPlayerIds") ||
    hasInvalidReadyHands(value)
  ) {
    return parseFailure("流局结算格式不正确。", "INVALID_DRAW_GAME_SETTLEMENT");
  }

  const flowerPigPlayerIds = getOptionalStringArray(value, "flowerPigPlayerIds");
  const kongTaxRefundPlayerIds = getOptionalStringArray(value, "kongTaxRefundPlayerIds");
  const notReadyPlayerIds = getOptionalStringArray(value, "notReadyPlayerIds");
  const readyHands = getOptionalReadyHands(value);

  return {
    request: {
      roomId: value.roomId.trim(),
      action: value.action,
      operator: value.operator.trim(),
      ...(flowerPigPlayerIds === undefined ? {} : { flowerPigPlayerIds }),
      ...(kongTaxRefundPlayerIds === undefined ? {} : { kongTaxRefundPlayerIds }),
      ...(notReadyPlayerIds === undefined ? {} : { notReadyPlayerIds }),
      ...(readyHands === undefined ? {} : { readyHands }),
    },
  };
}

function getInvalidPlayerResponse(): Response {
  return jsonFailure("玩家不存在。", "PLAYER_NOT_FOUND", {
    status: 404,
  });
}

function getScoreWinnerId(request: ScoreEventRequest): string | undefined {
  if (request.action === "DISCARD_WIN" || request.action === "SELF_DRAW") {
    return request.winnerId;
  }

  return undefined;
}

export async function POST(request: Request): Promise<Response> {
  const redisConfigurationError = getRedisConfigurationError();

  if (redisConfigurationError !== undefined) {
    return jsonFailure(redisConfigurationError, "REDIS_NOT_CONFIGURED", {
      status: 500,
    });
  }

  const requestBody = await readJsonBody(request);
  const parseResult = parseScoreEventRequest(requestBody);

  if ("failure" in parseResult) {
    return jsonFailure(parseResult.failure.message, parseResult.failure.code, {
      status: 400,
    });
  }

  const parsedRequest = parseResult.request;

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

  if (
    parsedRequest.action === "DRAW_GAME" &&
    getScoreRequestPlayerIds(parsedRequest).some((playerId) => !roomHasPlayer(room, playerId))
  ) {
    return getInvalidPlayerResponse();
  }

  if (parsedRequest.action === "KONG") {
    if (!roomHasPlayer(room, parsedRequest.playerId)) {
      return getInvalidPlayerResponse();
    }

    if (parsedRequest.kongType === "DISCARD_KONG") {
      if (!roomHasPlayer(room, parsedRequest.fromPlayerId)) {
        return getInvalidPlayerResponse();
      }

      if (parsedRequest.playerId === parsedRequest.fromPlayerId) {
        return jsonFailure("杠牌玩家和引杠玩家不能是同一名玩家。", "INVALID_KONG_PLAYERS", {
          status: 400,
        });
      }
    }
  }

  try {
    const data = await withRoomLock(parsedRequest.roomId, async (): Promise<AppendRoomEventResponse | Response> => {
      const lockedRoom = await getRoom(parsedRequest.roomId);

      if (lockedRoom === undefined) {
        return jsonFailure("房间不存在。", "ROOM_NOT_FOUND", {
          status: 404,
        });
      }

      if (lockedRoom.status !== "PLAYING") {
        return jsonFailure("游戏开始后才能计分。", "ROOM_NOT_PLAYING", {
          status: 409,
        });
      }

      const winnerId = getScoreWinnerId(parsedRequest);
      const shouldValidateCurrentRound =
        winnerId !== undefined ||
        parsedRequest.action === "KONG" ||
        parsedRequest.action === "DRAW_GAME";

      if (shouldValidateCurrentRound) {
        const roomEvents = await readRoomEvents(lockedRoom.roomId);
        const roomState = replayRoomEvents(
          buildReplayEventsFromSnapshot(
            {
              roomId: lockedRoom.roomId,
              players: lockedRoom.players,
              status: lockedRoom.status,
              createdAt: lockedRoom.createdAt,
            },
            roomEvents,
          ),
        );

        if (roomState.currentRound.status === "FINISHED") {
          return jsonFailure("本局已经结束，请先确认账单后再记录下一局。", "ROUND_ALREADY_FINISHED", {
            status: 409,
          });
        }

        if (winnerId !== undefined && roomState.currentRound.winnerIds.includes(winnerId)) {
          return jsonFailure("该玩家本局已经胡牌。", "ROUND_WINNER_ALREADY_EXISTS", {
            status: 409,
          });
        }

        if (parsedRequest.action === "KONG") {
          if (roomState.currentRound.winnerIds.includes(parsedRequest.playerId)) {
            return jsonFailure("已胡牌玩家本局不能再记录杠牌。", "KONG_PLAYER_ALREADY_WON", {
              status: 409,
            });
          }

          if (
            parsedRequest.kongType === "DISCARD_KONG" &&
            roomState.currentRound.winnerIds.includes(parsedRequest.fromPlayerId)
          ) {
            return jsonFailure("已胡牌玩家本局不能作为引杠玩家。", "KONG_FROM_PLAYER_ALREADY_WON", {
              status: 409,
            });
          }
        }
      }

      const event = await appendRoomEvent({
        roomId: parsedRequest.roomId,
        type: parsedRequest.action,
        operator: parsedRequest.operator,
        payload: getScoreEventPayload(parsedRequest),
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
