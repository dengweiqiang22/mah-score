import type { ApiResponse, CreateRoomResponse, JoinRoomRequest, JoinRoomResponse } from "@mah-score/shared";

export async function createRoom(): Promise<ApiResponse<CreateRoomResponse>> {
  const response = await fetch("/api/room/create", {
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
