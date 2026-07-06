import type { RoundState, SettlementPlayerState, SettlementState } from "../types/roomState.js";
import type { RoomPlayer } from "../types/room.js";

function getPayloadString(round: RoundState, key: string): string | undefined {
  const value = round.payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPlayerNickname(players: readonly RoomPlayer[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.nickname ?? "未知玩家";
}

function countRounds(rounds: readonly RoundState[]): number {
  return rounds.filter(
    (round) =>
      round.type === "DISCARD_WIN" || round.type === "SELF_DRAW" || round.type === "DRAW_GAME",
  ).length;
}

function countWins(rounds: readonly RoundState[], playerId: string): number {
  return rounds.filter((round) => {
    if (round.type !== "DISCARD_WIN" && round.type !== "SELF_DRAW") {
      return false;
    }

    return getPayloadString(round, "winnerId") === playerId;
  }).length;
}

function countDiscards(rounds: readonly RoundState[], playerId: string): number {
  return rounds.filter(
    (round) => round.type === "DISCARD_WIN" && getPayloadString(round, "discarderId") === playerId,
  ).length;
}

function countKongs(rounds: readonly RoundState[], playerId: string): number {
  return rounds.filter(
    (round) => round.type === "KONG" && getPayloadString(round, "playerId") === playerId,
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
  rounds: readonly RoundState[],
): SettlementState {
  const settlementWithoutText = {
    roomId,
    totalRounds: countRounds(rounds),
    players: rankPlayers(
      players.map((player) => ({
        playerId: player.id,
        nickname: getPlayerNickname(players, player.id),
        total: scores.find((score) => score.playerId === player.id)?.total ?? 0,
        winCount: countWins(rounds, player.id),
        discardCount: countDiscards(rounds, player.id),
        kongCount: countKongs(rounds, player.id),
      })),
    ),
  };

  return {
    ...settlementWithoutText,
    text: formatSettlementText(settlementWithoutText),
  };
}
