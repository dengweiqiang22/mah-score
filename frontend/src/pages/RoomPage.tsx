import type { RoomEvent, RoomPlayer, RoomRecord, RoomState, RoundState } from "@mah-score/shared";

import { useEffect, useState } from "react";
import { replayRoomEvents } from "@mah-score/shared";

import {
  getRoom,
  getRoomEvents,
  removePlayer,
  renamePlayer,
  startRoom,
  syncRoomEvents,
  undoRoomEvent,
} from "../api/roomApi";

interface RoomPageProps {
  readonly roomId: string;
}

function getPayloadString(payload: RoomEvent["payload"], key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPlayerNickname(players: readonly RoomPlayer[], playerId: string | undefined): string {
  if (playerId === undefined) {
    return "未知玩家";
  }

  return players.find((player) => player.id === playerId)?.nickname ?? "未知玩家";
}

function formatRoundTitle(round: RoundState, players: readonly RoomPlayer[]): string {
  if (round.type === "DISCARD_WIN") {
    const winnerName = getPlayerNickname(players, getPayloadString(round.payload, "winnerId"));

    return `${winnerName} 胡牌`;
  }

  if (round.type === "SELF_DRAW") {
    const winnerName = getPlayerNickname(players, getPayloadString(round.payload, "winnerId"));

    return `${winnerName} 自摸`;
  }

  return "流局";
}

function formatRoundDetail(round: RoundState, players: readonly RoomPlayer[]): string {
  if (round.type === "DISCARD_WIN") {
    const discarderName = getPlayerNickname(players, getPayloadString(round.payload, "discarderId"));

    return `${discarderName} 点炮 · +1 / -1`;
  }

  if (round.type === "SELF_DRAW") {
    return `三家付分 · +${Math.max(players.length - 1, 0)} / -1`;
  }

  return "本局不计分";
}

export function RoomPage({ roomId }: RoomPageProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [events, setEvents] = useState<readonly RoomEvent[]>([]);
  const [room, setRoom] = useState<RoomRecord | undefined>();
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");

  async function loadRoom() {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const [roomResponse, eventsResponse] = await Promise.all([getRoom(roomId), getRoomEvents(roomId)]);

      if (!roomResponse.success) {
        setErrorMessage(roomResponse.message);
        return;
      }

      if (!eventsResponse.success) {
        setErrorMessage(eventsResponse.message);
        return;
      }

      setRoom(roomResponse.data.room);
      setEvents(eventsResponse.data.events);
    } catch {
      setErrorMessage("读取房间失败，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRoom();
  }, [roomId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setEvents((currentEvents) => {
        const currentVersion = currentEvents.reduce(
          (version, event) => Math.max(version, event.version),
          0,
        );

        void syncRoomEvents(roomId, currentVersion)
          .then((response) => {
            if (!response.success) {
              setSyncStatus("error");
              return;
            }

            if (response.data.events.length === 0) {
              setSyncStatus("idle");
              return;
            }

            setEvents((latestEvents) => {
              const existingEventIds = new Set(latestEvents.map((event) => event.id));
              const newEvents = response.data.events.filter((event) => !existingEventIds.has(event.id));

              return [...latestEvents, ...newEvents].sort((left, right) => left.version - right.version);
            });
            setSyncStatus("idle");
          })
          .catch(() => {
            setSyncStatus("error");
          });

        setSyncStatus("syncing");
        return currentEvents;
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomId]);

  async function handleRenamePlayer(playerId: string) {
    setErrorMessage(undefined);

    try {
      const response = await renamePlayer({
        roomId,
        playerId,
        nickname: nicknameInput,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      setEditingPlayerId(undefined);
      setNicknameInput("");
      await loadRoom();
    } catch {
      setErrorMessage("修改昵称失败，请稍后再试。");
    }
  }

  async function handleRemovePlayer(playerId: string) {
    setErrorMessage(undefined);

    try {
      const response = await removePlayer({
        roomId,
        playerId,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      await loadRoom();
    } catch {
      setErrorMessage("删除玩家失败，请稍后再试。");
    }
  }

  async function handleStartRoom() {
    setIsStarting(true);
    setErrorMessage(undefined);

    try {
      const response = await startRoom({
        roomId,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      setEditingPlayerId(undefined);
      setNicknameInput("");
      await loadRoom();
    } catch {
      setErrorMessage("开始游戏失败，请稍后再试。");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleUndoRoomEvent() {
    setIsUndoing(true);
    setErrorMessage(undefined);

    try {
      const response = await undoRoomEvent({
        roomId,
        operator: "room",
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      await loadRoom();
    } catch {
      setErrorMessage("撤销失败，请稍后再试。");
    } finally {
      setIsUndoing(false);
    }
  }

  const isWaiting = room?.status === "WAITING";
  const canStart = isWaiting && room.players.length >= 2 && room.players.length <= 4;
  const replayState: RoomState | undefined =
    room === undefined
      ? undefined
      : replayRoomEvents([
          ...room.players.map((player, index) => ({
            id: `room_${room.roomId}_player_${player.id}`,
            roomId,
            type: "PLAYER_JOINED" as const,
            version: index - room.players.length,
            operator: "room",
            timestamp: room.createdAt,
            payload: {
              playerId: player.id,
              nickname: player.nickname,
            },
          })),
          ...events,
        ]);

  function getPlayerScore(playerId: string): number {
    return replayState?.scores.find((score) => score.playerId === playerId)?.total ?? 0;
  }

  const canUndo = (replayState?.rounds.length ?? 0) > 0;
  const recentRounds = [...(replayState?.rounds ?? [])]
    .sort((left, right) => right.version - left.version)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-8">
        <div className="pt-8">
          <p className="text-sm font-semibold text-emerald-700">房间</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">{roomId}</h1>
          <p className="mt-3 text-sm font-medium text-stone-500">
            {room === undefined ? "读取中" : room.status === "WAITING" ? "等待开始" : "游戏中"}
          </p>
          <p className="mt-2 text-xs font-medium text-stone-400">
            {syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "已同步"}
          </p>
        </div>

        {errorMessage !== undefined ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {room !== undefined ? (
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">玩家</p>
              <p className="mt-2 text-xl font-semibold">{room.players.length}/4</p>
            </div>
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">局数</p>
              <p className="mt-2 text-xl font-semibold">{replayState?.rounds.length ?? 0}</p>
            </div>
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">版本</p>
              <p className="mt-2 text-xl font-semibold">{replayState?.version ?? room.version}</p>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">玩家</h2>
              <p className="mt-1 text-sm text-stone-500">
                {room === undefined
                  ? "读取中"
                  : `${room.players.length}/4 人 · ${replayState?.rounds.length ?? 0} 局`}
              </p>
            </div>
            <button
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900"
              onClick={() => {
                void loadRoom();
              }}
              type="button"
            >
              刷新
            </button>
          </div>

          {isLoading ? <p className="text-base text-stone-600">读取中...</p> : null}

          {!isLoading && room !== undefined && room.players.length === 0 ? (
            <p className="rounded-md border border-stone-200 bg-white p-4 text-base text-stone-600">
              等待玩家加入
            </p>
          ) : null}

          {room?.players.map((player) => (
            <div
              className="grid gap-3 rounded-md border border-stone-200 bg-white p-4"
              key={player.id}
            >
              {editingPlayerId === player.id ? (
                <div className="grid gap-3">
                  <input
                    className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                    maxLength={12}
                    onChange={(event) => {
                      setNicknameInput(event.target.value);
                    }}
                    value={nicknameInput}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className="h-11 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white"
                      onClick={() => {
                        void handleRenamePlayer(player.id);
                      }}
                      type="button"
                    >
                      保存
                    </button>
                    <button
                      className="h-11 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900"
                      onClick={() => {
                        setEditingPlayerId(undefined);
                        setNicknameInput("");
                      }}
                      type="button"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{player.nickname}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {isWaiting ? "等待开始" : `${replayState?.rounds.length ?? 0} 局后分数`}
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tabular-nums">
                    {getPlayerScore(player.id)}
                  </p>
                  {isWaiting ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900"
                        onClick={() => {
                          setEditingPlayerId(player.id);
                          setNicknameInput(player.nickname);
                        }}
                        type="button"
                      >
                        改名
                      </button>
                      <button
                        className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700"
                        onClick={() => {
                          void handleRemovePlayer(player.id);
                        }}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="grid gap-4">
          <div className="border-b border-stone-200 pb-3">
            <h2 className="text-xl font-semibold tracking-normal">最近事件</h2>
            <p className="mt-1 text-sm text-stone-500">
              {recentRounds.length === 0 ? "暂无计分事件" : `最近 ${recentRounds.length} 条计分事件`}
            </p>
          </div>

          {recentRounds.length === 0 ? (
            <p className="rounded-md border border-stone-200 bg-white p-4 text-base text-stone-600">
              游戏开始后，计分事件会显示在这里
            </p>
          ) : (
            <div className="grid gap-3">
              {recentRounds.map((round) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-md border border-stone-200 bg-white p-4"
                  key={round.eventId}
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {formatRoundTitle(round, replayState?.players ?? [])}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {formatRoundDetail(round, replayState?.players ?? [])}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-stone-400">#{round.version}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {room !== undefined ? (
          <div className="mt-auto grid gap-3 pb-3">
            <div className="border-b border-stone-200 pb-3">
              <h2 className="text-xl font-semibold tracking-normal">操作</h2>
            </div>
            {isWaiting && room.players.length < 2 ? (
              <p className="text-sm leading-6 text-stone-500">至少 2 名玩家才能开始游戏</p>
            ) : null}
            <button
              className="h-14 rounded-md bg-emerald-700 px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canStart || isStarting}
              onClick={() => {
                void handleStartRoom();
              }}
              type="button"
            >
              {room.status === "PLAYING" ? "游戏已开始" : isStarting ? "开始中..." : "开始游戏"}
            </button>
            {room.status === "PLAYING" ? (
              <button
                className="h-12 rounded-md border border-red-200 bg-red-50 px-4 text-base font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canUndo || isUndoing}
                onClick={() => {
                  void handleUndoRoomEvent();
                }}
                type="button"
              >
                {isUndoing ? "撤销中..." : "撤销上一局"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
