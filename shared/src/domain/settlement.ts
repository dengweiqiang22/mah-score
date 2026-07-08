import type {
  CurrentRoundState,
  SettlementPlayerState,
  SettlementState,
} from "../types/roomState.js";
import type { RoomPlayer } from "../types/room.js";
import type { RoomEvent } from "../types/event.js";

import { createScoreHistory, type ScoreHistoryItem } from "./history.js";

function getPayloadString(event: RoomEvent, key: string): string | undefined {
  const value = event.payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPlayerNickname(players: readonly RoomPlayer[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.nickname ?? "未知玩家";
}

function getCompletedRoundCount(
  currentRound: CurrentRoundState,
  scoreHistory: readonly ScoreHistoryItem[],
): number {
  if (currentRound.number === 0) {
    return 0;
  }

  if (currentRound.status === "FINISHED") {
    return currentRound.number;
  }

  if (
    scoreHistory.some(
      (item) =>
        !item.isUndone && item.roundNumber === currentRound.number && item.event.type !== "DRAW_GAME",
    )
  ) {
    return currentRound.number;
  }

  return Math.max(0, currentRound.number - 1);
}

function countWins(
  scoreHistory: readonly ScoreHistoryItem[],
  playerId: string,
  completedRoundCount: number,
): number {
  return scoreHistory.filter((item) => {
    if (item.isUndone || item.roundNumber > completedRoundCount) {
      return false;
    }

    if (item.event.type !== "DISCARD_WIN" && item.event.type !== "SELF_DRAW") {
      return false;
    }

    return getPayloadString(item.event, "winnerId") === playerId;
  }).length;
}

function countDiscards(
  scoreHistory: readonly ScoreHistoryItem[],
  playerId: string,
  completedRoundCount: number,
): number {
  return scoreHistory.filter(
    (item) =>
      !item.isUndone &&
      item.roundNumber <= completedRoundCount &&
      item.event.type === "DISCARD_WIN" &&
      getPayloadString(item.event, "discarderId") === playerId,
  ).length;
}

function countKongs(
  scoreHistory: readonly ScoreHistoryItem[],
  playerId: string,
  completedRoundCount: number,
): number {
  return scoreHistory.filter(
    (item) =>
      !item.isUndone &&
      item.roundNumber <= completedRoundCount &&
      item.event.type === "KONG" &&
      getPayloadString(item.event, "playerId") === playerId,
  ).length;
}

function rankPlayers(
  players: readonly Omit<SettlementPlayerState, "rank">[],
): SettlementPlayerState[] {
  const sortedPlayers = [...players].sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return left.nickname.localeCompare(right.nickname, "zh-Hans-CN");
  });

  return sortedPlayers.reduce<SettlementPlayerState[]>((rankedPlayers, player, index) => {
    const previousRankedPlayer = rankedPlayers[index - 1];
    const rank =
      previousRankedPlayer !== undefined && previousRankedPlayer.total === player.total
        ? previousRankedPlayer.rank
        : index + 1;

    return [
      ...rankedPlayers,
      {
        ...player,
        rank,
      },
    ];
  }, []);
}

function formatSettlementText(settlement: Omit<SettlementState, "text">): string {
  const lines = [
    `mah-score 房间 ${settlement.roomId} 结算`,
    `总局数：${settlement.totalRounds}`,
    ...settlement.players.map(
      (player) =>
        `${player.rank}. ${player.nickname} ${player.total} 分 胡${player.winCount} 点炮${player.discardCount} 杠${player.kongCount}`,
    ),
  ];

  return lines.join("\n");
}

export function createSettlement(
  roomId: string,
  players: readonly RoomPlayer[],
  scores: readonly { readonly playerId: string; readonly total: number }[],
  events: readonly RoomEvent[],
  currentRound: CurrentRoundState,
): SettlementState {
  const scoreHistory = createScoreHistory(events, players);
  const completedRoundCount = getCompletedRoundCount(currentRound, scoreHistory);
  const settlementWithoutText = {
    roomId,
    totalRounds: completedRoundCount,
    players: rankPlayers(
      players.map((player) => ({
        playerId: player.id,
        nickname: getPlayerNickname(players, player.id),
        total: scores.find((score) => score.playerId === player.id)?.total ?? 0,
        winCount: countWins(scoreHistory, player.id, completedRoundCount),
        discardCount: countDiscards(scoreHistory, player.id, completedRoundCount),
        kongCount: countKongs(scoreHistory, player.id, completedRoundCount),
      })),
    ),
  };

  return {
    ...settlementWithoutText,
    text: formatSettlementText(settlementWithoutText),
  };
}
