import { useEffect, useState } from "react";

import { createRoom, joinRoom } from "../api/roomApi";
import { HomeActionButton } from "../components/HomeActionButton";
import { saveInitialRoomDetail } from "../utils/initialRoomDetail";
import { savePlayerIdentity } from "../utils/playerIdentity";

export function HomePage() {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [createNickname, setCreateNickname] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [manualJoinRoomId, setManualJoinRoomId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [invitedRoomId, setInvitedRoomId] = useState<string | undefined>();
  const [inviteModeError, setInviteModeError] = useState<string | undefined>();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const rawRoomId = searchParams.get("roomId");

    if (rawRoomId === null) {
      setInvitedRoomId(undefined);
      setInviteModeError(undefined);
      return;
    }

    if (!/^\d{3}$/u.test(rawRoomId)) {
      setInvitedRoomId(undefined);
      setInviteModeError("邀请链接中的房间号无效，请检查链接是否完整。");
      return;
    }

    setInvitedRoomId(rawRoomId);
    setInviteModeError(undefined);
  }, []);

  async function handleCreateRoom() {
    setIsCreatingRoom(true);
    setErrorMessage(undefined);

    try {
      const response = await createRoom({
        nickname: createNickname.trim(),
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      savePlayerIdentity({
        roomId: response.data.roomId,
        playerId: response.data.playerId,
        nickname: createNickname.trim(),
      });
      saveInitialRoomDetail({
        room: response.data.room,
        events: response.data.events,
      });
      window.location.assign(`/room/${response.data.roomId}`);
    } catch {
      setErrorMessage("创建房间失败，请稍后再试。");
    } finally {
      setIsCreatingRoom(false);
    }
  }

  async function handleJoinRoom() {
    setIsJoiningRoom(true);
    setErrorMessage(undefined);

    const roomId = invitedRoomId ?? manualJoinRoomId;

    try {
      const response = await joinRoom({
        roomId,
        nickname: joinNickname,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      savePlayerIdentity({
        roomId: response.data.roomId,
        playerId: response.data.playerId,
        nickname: joinNickname.trim(),
      });
      window.location.assign(`/room/${response.data.roomId}`);
    } catch {
      setErrorMessage("加入房间失败，请稍后再试。");
    } finally {
      setIsJoiningRoom(false);
    }
  }

  function handleJoinRoomIdChange(value: string) {
    setManualJoinRoomId(value.replace(/\D/gu, "").slice(0, 3));
  }

  const isInviteMode = invitedRoomId !== undefined && inviteModeError === undefined;

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-between">
        <div className="pt-12">
          <p className="text-sm font-semibold text-emerald-700">四川麻将计分</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">mah-score</h1>
        </div>

        <div className="grid gap-3 pb-8">
          {inviteModeError !== undefined ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {inviteModeError}
            </p>
          ) : null}
          {errorMessage !== undefined ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <div className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">加入房间</h2>
              <p className="mt-1 text-sm text-stone-500">
                {isInviteMode ? `邀请加入房间 ${invitedRoomId}` : "输入房间号和昵称"}
              </p>
            </div>
            {!isInviteMode ? (
              <input
                className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                autoComplete="off"
                id="join-room-id"
                inputMode="numeric"
                maxLength={3}
                name="joinRoomId"
                onChange={(event) => {
                  handleJoinRoomIdChange(event.target.value);
                }}
                placeholder="房间号"
                value={manualJoinRoomId}
              />
            ) : null}
            <input
              className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
              autoComplete="name"
              id="join-nickname"
              maxLength={12}
              name="joinNickname"
              onChange={(event) => {
                setJoinNickname(event.target.value);
              }}
              placeholder="昵称"
              value={joinNickname}
            />
            <HomeActionButton
              disabled={
                isJoiningRoom ||
                joinNickname.trim().length === 0 ||
                (!isInviteMode && manualJoinRoomId.length !== 3)
              }
              onClick={handleJoinRoom}
              variant="primary"
            >
              {isJoiningRoom ? "加入中..." : "加入房间"}
            </HomeActionButton>
          </div>

          {!isInviteMode ? (
            <div className="grid gap-3 px-1">
              <div className="flex items-center justify-center gap-2 text-sm text-stone-500">
                <span>没有房间？</span>
                <button
                  className="font-semibold text-emerald-700"
                  onClick={() => {
                    setIsCreateRoomOpen((currentValue) => !currentValue);
                  }}
                  type="button"
                >
                  创建房间
                </button>
              </div>

              {isCreateRoomOpen ? (
                <div className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
                  <input
                    className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                    autoComplete="name"
                    id="create-nickname"
                    maxLength={12}
                    name="createNickname"
                    onChange={(event) => {
                      setCreateNickname(event.target.value);
                    }}
                    placeholder="房主昵称"
                    value={createNickname}
                  />
                  <HomeActionButton
                    disabled={isCreatingRoom || createNickname.trim().length === 0}
                    onClick={handleCreateRoom}
                    variant="secondary"
                  >
                    {isCreatingRoom ? "创建中..." : "确认创建"}
                  </HomeActionButton>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
