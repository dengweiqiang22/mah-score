import type { ApiResponse, CreateRoomResponse } from "@mah-score/shared";

export async function createRoom(): Promise<ApiResponse<CreateRoomResponse>> {
  const response = await fetch("/api/room/create", {
    method: "POST",
  });

  const data = (await response.json()) as ApiResponse<CreateRoomResponse>;

  return data;
}
