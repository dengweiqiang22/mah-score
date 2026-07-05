import type { RoomEvent } from "./event.js";
import type { RoomPlayer, RoomStatus } from "./room.js";

export interface ScoreState {
  readonly playerId: string;
  readonly total: number;
}

export interface RoundState {
  readonly eventId: string;
  readonly type: RoomEvent["type"];
  readonly version: number;
  readonly payload: RoomEvent["payload"];
}

export interface RoomState {
  readonly roomId: string;
  readonly version: number;
  readonly status: RoomStatus;
  readonly players: readonly RoomPlayer[];
  readonly scores: readonly ScoreState[];
  readonly rounds: readonly RoundState[];
  readonly events: readonly RoomEvent[];
}
