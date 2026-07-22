import type { ScoreFan } from "../types/score.js";

export interface RoomRuleConfig {
  readonly baseScore: 1;
  readonly maxFan: ScoreFan;
  readonly selfDrawExtraFan: 1;
}

export const defaultRoomRuleConfig: RoomRuleConfig = {
  baseScore: 1,
  maxFan: 4,
  selfDrawExtraFan: 1,
};

export function clampScoreFan(fan: number | undefined): ScoreFan {
  if (fan === 2) {
    return 2;
  }

  if (fan === 3) {
    return 3;
  }

  if (fan === 4) {
    return 4;
  }

  return 1;
}

export function getEffectiveScoreFan(
  fan: number | undefined,
  extraFan = 0,
  ruleConfig: RoomRuleConfig = defaultRoomRuleConfig,
): ScoreFan {
  return clampScoreFan(Math.min(clampScoreFan(fan) + extraFan, ruleConfig.maxFan));
}

export function getFanScore(fan: number | undefined): number {
  return defaultRoomRuleConfig.baseScore * 2 ** (clampScoreFan(fan) - 1);
}

export function getSelfDrawScoreFan(
  fan: number | undefined,
  ruleConfig: RoomRuleConfig = defaultRoomRuleConfig,
): ScoreFan {
  return getEffectiveScoreFan(fan, ruleConfig.selfDrawExtraFan, ruleConfig);
}
