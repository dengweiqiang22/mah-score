export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface RoomPlayer {
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
  readonly nickname: string;
}

export interface CreateRoomResponse {
  readonly roomId: string;
  readonly playerId: string;
}

export interface JoinRoomRequest {
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

export interface RenamePlayerRequest {
  readonly roomId: string;
  readonly playerId: string;
  readonly nickname: string;
}

export interface RemovePlayerRequest {
  readonly roomId: string;
  readonly playerId: string;
}

export interface StartRoomRequest {
  readonly roomId: string;
}
