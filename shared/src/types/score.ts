export type ScoreActionType = "DISCARD_WIN" | "SELF_DRAW" | "DRAW_GAME";

export interface DiscardWinScoreRequest {
  readonly roomId: string;
  readonly action: "DISCARD_WIN";
  readonly operator: string;
  readonly winnerId: string;
  readonly discarderId: string;
}

export interface SelfDrawScoreRequest {
  readonly roomId: string;
  readonly action: "SELF_DRAW";
  readonly operator: string;
  readonly winnerId: string;
}

export interface DrawGameScoreRequest {
  readonly roomId: string;
  readonly action: "DRAW_GAME";
  readonly operator: string;
}

export type ScoreEventRequest =
  | DiscardWinScoreRequest
  | SelfDrawScoreRequest
  | DrawGameScoreRequest;
