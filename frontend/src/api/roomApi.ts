import type {
  ApiResponse,
  AppendRoomEventRequest,
  CreateRoomResponse,
  CreateRoomRequest,
  GetRoomDetailResponse,
  GetRoomEventsResponse,
  GetRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  RemovePlayerRequest,
  RenamePlayerRequest,
  ScoreEventRequest,
  StartRoomRequest,
  SyncRoomEventsResponse,
  UndoRoomEventRequest,
} from "@mah-score/shared";

type EmptyResponse = Record<string, never>;

type RoomPostAction =
  | "create"
  | "join"
  | "start"
  | "score"
  | "undo"
  | "event"
  | "renamePlayer"
  | "removePlayer";

async function postRoomAction<TResponse, TRequest extends object>(
  action: RoomPostAction,
  request: TRequest,
): Promise<ApiResponse<TResponse>> {
  const response = await fetch("/api/room", {
    body: JSON.stringify({
      ...request,
      action,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<TResponse>;

  return data;
}

export async function createRoom(request: CreateRoomRequest): Promise<ApiResponse<CreateRoomResponse>> {
  return postRoomAction("create", request);
}

export async function joinRoom(request: JoinRoomRequest): Promise<ApiResponse<JoinRoomResponse>> {
  return postRoomAction("join", request);
}

export async function getRoom(roomId: string): Promise<ApiResponse<GetRoomResponse>> {
  const response = await fetch(`/api/room?roomId=${encodeURIComponent(roomId)}`);
  const data = (await response.json()) as ApiResponse<GetRoomResponse>;

  return data;
}

export async function getRoomDetail(roomId: string): Promise<ApiResponse<GetRoomDetailResponse>> {
  const response = await fetch(`/api/room?roomId=${encodeURIComponent(roomId)}`);
  const data = (await response.json()) as ApiResponse<GetRoomDetailResponse>;

  return data;
}

export async function getRoomEvents(roomId: string): Promise<ApiResponse<GetRoomEventsResponse>> {
  const response = await fetch(`/api/room?action=events&roomId=${encodeURIComponent(roomId)}`);
  const data = (await response.json()) as ApiResponse<GetRoomEventsResponse>;

  return data;
}

export async function renamePlayer(request: RenamePlayerRequest): Promise<ApiResponse<EmptyResponse>> {
  return postRoomAction("renamePlayer", request);
}

export async function removePlayer(request: RemovePlayerRequest): Promise<ApiResponse<EmptyResponse>> {
  return postRoomAction("removePlayer", request);
}

export async function startRoom(request: StartRoomRequest): Promise<ApiResponse<EmptyResponse>> {
  return postRoomAction("start", request);
}

export async function recordScoreEvent(
  request: ScoreEventRequest,
): Promise<ApiResponse<EmptyResponse>> {
  return postRoomAction("score", request);
}

export async function recordRoomEvent(
  request: AppendRoomEventRequest,
): Promise<ApiResponse<EmptyResponse>> {
  return postRoomAction("event", request);
}

export async function undoRoomEvent(
  request: UndoRoomEventRequest,
): Promise<ApiResponse<EmptyResponse>> {
  return postRoomAction("undo", request);
}

export async function syncRoomEvents(
  roomId: string,
  version: number,
): Promise<ApiResponse<SyncRoomEventsResponse>> {
  const response = await fetch(
    `/api/room?action=sync&roomId=${encodeURIComponent(roomId)}&version=${encodeURIComponent(version.toString())}`,
  );
  const data = (await response.json()) as ApiResponse<SyncRoomEventsResponse>;

  return data;
}
