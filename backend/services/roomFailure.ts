import { jsonFailure } from "./apiResponse.js";

export function jsonRoomBusyFailure(init?: ResponseInit): Response {
  return jsonFailure("当前房间正在处理其他操作，请稍后再试。", "ROOM_BUSY", {
    status: 409,
    ...init,
  });
}

export function jsonUnexpectedRoomFailure(
  message: string,
  code: string,
  init?: ResponseInit,
): Response {
  return jsonFailure(message, code, init);
}
