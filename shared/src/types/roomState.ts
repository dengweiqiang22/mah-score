import type { RoomEvent } from "./event.js";
import type { RoomPlayer, RoomStatus } from "./room.js";

export interface ScoreState {
  readonly playerId: string;
  readonly total: number;
}

export interface CurrentRoundState {
  readonly number: number;
  readonly winnerIds: readonly string[];
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
  readonly currentRound: CurrentRoundState;
  readonly rounds: readonly RoundState[];
  readonly events: readonly RoomEvent[];
}

export interface SettlementPlayerState {
  readonly playerId: string;
  readonly nickname: string;
  readonly rank: number;
  readonly total: number;
  readonly winCount: number;
  readonly discardCount: number;
  readonly kongCount: number;
}

export interface SettlementState {
  readonly roomId: string;
  readonly totalRounds: number;
  readonly players: readonly SettlementPlayerState[];
  readonly text: string;
}
