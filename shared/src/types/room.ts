import type { RoomEvent } from "./event.js";

export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface RoomPlayer {
  readonly avatarId?: string;
  readonly id: string;
  readonly nickname: string;
}

export interface RoomRecord {
  readonly roomId: string;
  readonly version: number;
  readonly players: readonly RoomPlayer[];
  readonly status: RoomStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RoomSnapshot {
  readonly roomId: string;
  readonly players: readonly RoomPlayer[];
  readonly status: RoomStatus;
  readonly createdAt: string;
}

export interface CreateRoomRequest {
  readonly avatarId?: string;
  readonly nickname: string;
}

export interface CreateRoomResponse {
  readonly roomId: string;
  readonly playerId: string;
  readonly room: RoomRecord;
  readonly events: readonly RoomEvent[];
}

export interface JoinRoomRequest {
  readonly avatarId?: string;
  readonly roomId: string;
  readonly nickname: string;
}

export interface JoinRoomResponse {
  readonly roomId: string;
  readonly playerId: string;
}

export interface GetRoomResponse {
  readonly room: RoomRecord;
}

export interface GetRoomDetailResponse {
  readonly room: RoomRecord;
  readonly events: readonly RoomEvent[];
}

export interface RenamePlayerRequest {
  readonly avatarId?: string;
  readonly roomId: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly requesterPlayerId: string;
}

export interface RemovePlayerRequest {
  readonly roomId: string;
  readonly playerId: string;
  readonly requesterPlayerId: string;
}

export interface StartRoomRequest {
  readonly roomId: string;
}
