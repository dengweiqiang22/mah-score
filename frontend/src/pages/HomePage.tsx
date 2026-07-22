import { useEffect, useState } from "react";
import { LogIn, Plus } from "lucide-react";

import { createRoom, joinRoom } from "../api/roomApi";
import { AvatarSelector } from "../components/AvatarSelector";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Notice";
import { saveInitialRoomDetail } from "../utils/initialRoomDetail";
import { defaultAvatarId } from "../utils/avatars";
import { savePlayerIdentity } from "../utils/playerIdentity";

type EntryMode = "join" | "create";

export function HomePage() {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>("join");
  const [createAvatarId, setCreateAvatarId] = useState(defaultAvatarId);
  const [createNickname, setCreateNickname] = useState("");
  const [joinAvatarId, setJoinAvatarId] = useState(defaultAvatarId);
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
        avatarId: createAvatarId,
        nickname: createNickname.trim(),
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      savePlayerIdentity({
        avatarId: createAvatarId,
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
        avatarId: joinAvatarId,
        roomId,
        nickname: joinNickname,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      savePlayerIdentity({
        avatarId: joinAvatarId,
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
  const activeEntryMode: EntryMode = isInviteMode ? "join" : entryMode;

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-md content-start gap-5">
        <div className="grid gap-3 pt-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-700 text-xl font-semibold text-white shadow-sm">
            麻
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700">四川麻将计分</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">mah-score</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              牌桌旁快速开房、邀请好友、记录每一局输赢。
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {inviteModeError !== undefined ? (
            <Notice variant="danger">{inviteModeError}</Notice>
          ) : null}
          {errorMessage !== undefined ? (
            <Notice variant="danger">{errorMessage}</Notice>
          ) : null}

          {!isInviteMode ? (
            <div className="grid grid-cols-2 gap-2 rounded-md bg-stone-200/70 p-1">
              <button
                className={`h-11 rounded-md text-sm font-semibold transition-colors ${
                  activeEntryMode === "join"
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-600 active:bg-stone-100"
                }`}
                onClick={() => {
                  setEntryMode("join");
                  setErrorMessage(undefined);
                }}
                type="button"
              >
                加入房间
              </button>
              <button
                className={`h-11 rounded-md text-sm font-semibold transition-colors ${
                  activeEntryMode === "create"
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-600 active:bg-stone-100"
                }`}
                onClick={() => {
                  setEntryMode("create");
                  setErrorMessage(undefined);
                }}
                type="button"
              >
                创建房间
              </button>
            </div>
          ) : null}

          {activeEntryMode === "join" ? (
            <div className="grid gap-4 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
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
              <AvatarSelector onChange={setJoinAvatarId} value={joinAvatarId} />
              <Button
                disabled={
                  isJoiningRoom ||
                  joinNickname.trim().length === 0 ||
                  (!isInviteMode && manualJoinRoomId.length !== 3)
                }
                onClick={() => {
                  void handleJoinRoom();
                }}
                size="lg"
                variant="primary"
              >
                <LogIn className="h-4 w-4" />
                {isJoiningRoom ? "加入中..." : "加入房间"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">创建房间</h2>
              <p className="mt-1 text-sm text-stone-500">输入你的昵称，创建后分享给好友。</p>
            </div>
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
            <AvatarSelector onChange={setCreateAvatarId} value={createAvatarId} />
            <Button
              disabled={isCreatingRoom || createNickname.trim().length === 0}
              onClick={() => {
                void handleCreateRoom();
              }}
              size="lg"
              variant="primary"
            >
              <Plus className="h-4 w-4" />
              {isCreatingRoom ? "创建中..." : "创建房间"}
            </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
