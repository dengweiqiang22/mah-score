export const scoreFans = [1, 2, 3, 4] as const;

export type ScoreFan = (typeof scoreFans)[number];

export const kongTypes = ["DISCARD_KONG", "SUPPLEMENT_KONG", "CONCEALED_KONG"] as const;

export type KongType = (typeof kongTypes)[number];

export type ScoreActionType = "DISCARD_WIN" | "SELF_DRAW" | "KONG" | "DRAW_GAME";

export interface DiscardWinScoreRequest {
  readonly roomId: string;
  readonly action: "DISCARD_WIN";
  readonly operator: string;
  readonly winnerId: string;
  readonly discarderId: string;
  readonly fan?: ScoreFan;
}

export interface SelfDrawScoreRequest {
  readonly roomId: string;
  readonly action: "SELF_DRAW";
  readonly operator: string;
  readonly winnerId: string;
  readonly fan?: ScoreFan;
}

export interface DiscardKongScoreRequest {
  readonly roomId: string;
  readonly action: "KONG";
  readonly operator: string;
  readonly playerId: string;
  readonly kongType: "DISCARD_KONG";
  readonly fromPlayerId: string;
}

export interface SupplementKongScoreRequest {
  readonly roomId: string;
  readonly action: "KONG";
  readonly operator: string;
  readonly playerId: string;
  readonly kongType: "SUPPLEMENT_KONG";
}

export interface ConcealedKongScoreRequest {
  readonly roomId: string;
  readonly action: "KONG";
  readonly operator: string;
  readonly playerId: string;
  readonly kongType: "CONCEALED_KONG";
}

export interface DrawGameScoreRequest {
  readonly roomId: string;
  readonly action: "DRAW_GAME";
  readonly operator: string;
  readonly flowerPigPlayerIds?: readonly string[];
  readonly kongTaxRefundPlayerIds?: readonly string[];
  readonly notReadyPlayerIds?: readonly string[];
  readonly readyHands?: readonly {
    readonly maxFan: ScoreFan;
    readonly playerId: string;
  }[];
}

export type ScoreEventRequest =
  | DiscardWinScoreRequest
  | SelfDrawScoreRequest
  | DiscardKongScoreRequest
  | SupplementKongScoreRequest
  | ConcealedKongScoreRequest
  | DrawGameScoreRequest;
