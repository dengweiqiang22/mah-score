import type { RoomRecord } from "@mah-score/shared";

import { useEffect, useState } from "react";

import { getRoom, removePlayer, renamePlayer, startRoom } from "../api/roomApi";

interface RoomPageProps {
  readonly roomId: string;
}

export function RoomPage({ roomId }: RoomPageProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [room, setRoom] = useState<RoomRecord | undefined>();

  async function loadRoom() {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const response = await getRoom(roomId);

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      setRoom(response.data.room);
    } catch {
      setErrorMessage("读取房间失败，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRoom();
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

  const isWaiting = room?.status === "WAITING";
  const canStart = isWaiting && room.players.length >= 2 && room.players.length <= 4;

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-8">
        <div className="pt-8">
          <p className="text-sm font-semibold text-emerald-700">房间</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">{roomId}</h1>
          <p className="mt-3 text-sm font-medium text-stone-500">
            {room === undefined ? "读取中" : room.status === "WAITING" ? "等待开始" : "游戏中"}
          </p>
        </div>

        {errorMessage !== undefined ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <section className="grid gap-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">玩家</h2>
              <p className="mt-1 text-sm text-stone-500">
                {room === undefined ? "读取中" : `${room.players.length}/4 人`}
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
                  <p className="min-w-0 flex-1 truncate text-lg font-semibold">{player.nickname}</p>
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

        {room !== undefined ? (
          <div className="mt-auto grid gap-3 pb-3">
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
          </div>
        ) : null}
      </section>
    </main>
  );
}
