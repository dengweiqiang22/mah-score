import { jsonFailure } from "../../services/apiResponse.js";
import { POST as createRoom } from "./create.js";
import { POST as appendRoomEvent } from "./event.js";
import { GET as getRoomEvents } from "./events.js";
import { GET as getRoomDetail } from "./index.js";
import { POST as joinRoom } from "./join.js";
import { POST as removePlayer } from "./player/remove.js";
import { POST as renamePlayer } from "./player/rename.js";
import { POST as recordScore } from "./score.js";
import { POST as startRoom } from "./start.js";
import { GET as syncRoomEvents } from "./sync.js";
import { POST as undoRoomEvent } from "./undo.js";

type RoomPostAction =
  | "create"
  | "join"
  | "start"
  | "score"
  | "undo"
  | "event"
  | "renamePlayer"
  | "removePlayer";

function getPostAction(value: unknown): RoomPostAction | undefined {
  if (typeof value !== "object" || value === null || !("action" in value)) {
    return undefined;
  }

  if (
    value.action === "create" ||
    value.action === "join" ||
    value.action === "start" ||
    value.action === "score" ||
    value.action === "undo" ||
    value.action === "event" ||
    value.action === "renamePlayer" ||
    value.action === "removePlayer"
  ) {
    return value.action;
  }

  return undefined;
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}

export async function GET(request: Request): Promise<Response> {
  const action = new URL(request.url).searchParams.get("action")?.trim();

  if (action === undefined || action === "" || action === "detail") {
    return getRoomDetail(request);
  }

  if (action === "events") {
    return getRoomEvents(request);
  }

  if (action === "sync") {
    return syncRoomEvents(request);
  }

  return jsonFailure("不支持的房间查询操作。", "ROOM_ACTION_NOT_SUPPORTED", {
    status: 404,
  });
}

export async function POST(request: Request): Promise<Response> {
  const action = getPostAction(await readRequestBody(request));

  if (action === undefined) {
    return jsonFailure("请求格式不正确。", "INVALID_REQUEST", {
      status: 400,
    });
  }

  if (action === "create") {
    return createRoom(request);
  }

  if (action === "join") {
    return joinRoom(request);
  }

  if (action === "start") {
    return startRoom(request);
  }

  if (action === "score") {
    return recordScore(request);
  }

  if (action === "undo") {
    return undoRoomEvent(request);
  }

  if (action === "event") {
    return appendRoomEvent(request);
  }

  if (action === "renamePlayer") {
    return renamePlayer(request);
  }

  return removePlayer(request);
}

const roomRouterFunction = {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return GET(request);
    }

    if (request.method === "POST") {
      return POST(request);
    }

    return jsonFailure("不支持的请求方法。", "METHOD_NOT_ALLOWED", {
      status: 405,
    });
  },
};

export default roomRouterFunction;
