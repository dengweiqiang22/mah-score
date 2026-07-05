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

export interface CreateRoomResponse {
  readonly roomId: string;
}
