export type RoomEventType =
  | "ROOM_CREATED"
  | "PLAYER_JOINED"
  | "PLAYER_RENAMED"
  | "PLAYER_REMOVED"
  | "GAME_STARTED"
  | "GAME_FINISHED"
  | "ROUND_CONFIRMED"
  | "DISCARD_WIN"
  | "SELF_DRAW"
  | "KONG"
  | "DRAW_GAME"
  | "UNDO";

export type RoomEventPayload = Readonly<Record<string, unknown>>;

export interface RoomEvent {
  readonly id: string;
  readonly roomId: string;
  readonly type: RoomEventType;
  readonly version: number;
  readonly operator: string;
  readonly timestamp: string;
  readonly payload: RoomEventPayload;
}

export interface AppendRoomEventRequest {
  readonly roomId: string;
  readonly type: RoomEventType;
  readonly operator: string;
  readonly payload: RoomEventPayload;
}

export interface AppendRoomEventResponse {
  readonly event: RoomEvent;
}

export interface GetRoomEventsResponse {
  readonly events: readonly RoomEvent[];
}

export interface SyncRoomEventsResponse {
  readonly events: readonly RoomEvent[];
  readonly version: number;
}

export interface UndoRoomEventRequest {
  readonly roomId: string;
  readonly operator: string;
  readonly targetEventId?: string;
}
