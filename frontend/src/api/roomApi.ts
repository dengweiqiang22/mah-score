import type {
  ApiResponse,
  AppendRoomEventRequest,
  CreateRoomResponse,
  CreateRoomRequest,
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

export async function createRoom(request: CreateRoomRequest): Promise<ApiResponse<CreateRoomResponse>> {
  const response = await fetch("/api/room/create", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = (await response.json()) as ApiResponse<CreateRoomResponse>;

  return data;
}

export async function joinRoom(request: JoinRoomRequest): Promise<ApiResponse<JoinRoomResponse>> {
  const response = await fetch("/api/room/join", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = (await response.json()) as ApiResponse<JoinRoomResponse>;

  return data;
}

export async function getRoom(roomId: string): Promise<ApiResponse<GetRoomResponse>> {
  const response = await fetch(`/api/room?roomId=${encodeURIComponent(roomId)}`);
  const data = (await response.json()) as ApiResponse<GetRoomResponse>;

  return data;
}

export async function getRoomEvents(roomId: string): Promise<ApiResponse<GetRoomEventsResponse>> {
  const response = await fetch(`/api/room/events?roomId=${encodeURIComponent(roomId)}`);
  const data = (await response.json()) as ApiResponse<GetRoomEventsResponse>;

  return data;
}

export async function renamePlayer(request: RenamePlayerRequest): Promise<ApiResponse<EmptyResponse>> {
  const response = await fetch("/api/room/player/rename", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<EmptyResponse>;

  return data;
}

export async function removePlayer(request: RemovePlayerRequest): Promise<ApiResponse<EmptyResponse>> {
  const response = await fetch("/api/room/player/remove", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<EmptyResponse>;

  return data;
}

export async function startRoom(request: StartRoomRequest): Promise<ApiResponse<EmptyResponse>> {
  const response = await fetch("/api/room/start", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<EmptyResponse>;

  return data;
}

export async function recordScoreEvent(
  request: ScoreEventRequest,
): Promise<ApiResponse<EmptyResponse>> {
  const response = await fetch("/api/room/score", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<EmptyResponse>;

  return data;
}

export async function recordRoomEvent(
  request: AppendRoomEventRequest,
): Promise<ApiResponse<EmptyResponse>> {
  const response = await fetch("/api/room/event", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<EmptyResponse>;

  return data;
}

export async function undoRoomEvent(
  request: UndoRoomEventRequest,
): Promise<ApiResponse<EmptyResponse>> {
  const response = await fetch("/api/room/undo", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiResponse<EmptyResponse>;

  return data;
}

export async function syncRoomEvents(
  roomId: string,
  version: number,
): Promise<ApiResponse<SyncRoomEventsResponse>> {
  const response = await fetch(
    `/api/room/sync?roomId=${encodeURIComponent(roomId)}&version=${encodeURIComponent(version.toString())}`,
  );
  const data = (await response.json()) as ApiResponse<SyncRoomEventsResponse>;

  return data;
}
