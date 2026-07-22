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

interface EntryModeTabsProps {
  readonly activeMode: EntryMode;
  readonly onChange: (mode: EntryMode) => void;
}

function EntryModeTabs({ activeMode, onChange }: EntryModeTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-200/70 p-1">
      <button
        className={`h-11 rounded-md text-sm font-semibold transition-colors ${
          activeMode === "join"
            ? "bg-white text-stone-950 shadow-sm"
            : "text-stone-600 active:bg-stone-100"
        }`}
        onClick={() => {
          onChange("join");
        }}
        type="button"
      >
        加入房间
      </button>
      <button
        className={`h-11 rounded-md text-sm font-semibold transition-colors ${
          activeMode === "create"
            ? "bg-white text-stone-950 shadow-sm"
            : "text-stone-600 active:bg-stone-100"
        }`}
        onClick={() => {
          onChange("create");
        }}
        type="button"
      >
        创建房间
      </button>
    </div>
  );
}

function HomeHeader() {
  return (
    <header className="grid gap-3 pt-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-xl font-semibold text-white shadow-sm">
          麻
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-700">四川麻将计分</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-normal">mah-score</h1>
        </div>
      </div>
      <p className="max-w-sm text-sm leading-6 text-stone-500">
        牌桌旁快速开房、邀请好友、记录每一局输赢。
      </p>
    </header>
  );
}

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
    <main className="min-h-screen bg-stone-100 px-4 py-5 text-stone-950">
      <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-md content-start gap-4">
        <HomeHeader />

        <div className="grid gap-3">
          {inviteModeError !== undefined ? (
            <Notice variant="danger">{inviteModeError}</Notice>
          ) : null}
          {errorMessage !== undefined ? (
            <Notice variant="danger">{errorMessage}</Notice>
          ) : null}

          {!isInviteMode ? (
            <EntryModeTabs
              activeMode={activeEntryMode}
              onChange={(mode) => {
                setEntryMode(mode);
                setErrorMessage(undefined);
              }}
            />
          ) : (
            <div className="rounded-md bg-emerald-50 px-3 py-3 ring-1 ring-emerald-100">
              <p className="text-sm font-semibold text-emerald-800">邀请加入房间 {invitedRoomId}</p>
              <p className="mt-1 text-xs text-emerald-700">填写昵称并选择头像后即可进入。</p>
            </div>
          )}

          {activeEntryMode === "join" ? (
            <div className="grid gap-4 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
              {!isInviteMode ? (
                <label className="grid gap-2" htmlFor="join-room-id">
                  <span className="text-sm font-semibold text-stone-700">房间号</span>
                  <input
                    className="h-12 rounded-md border border-stone-300 px-3 text-center text-xl font-semibold tabular-nums tracking-normal outline-none focus:border-emerald-700"
                    autoComplete="off"
                    id="join-room-id"
                    inputMode="numeric"
                    maxLength={3}
                    name="joinRoomId"
                    onChange={(event) => {
                      handleJoinRoomIdChange(event.target.value);
                    }}
                    placeholder="010"
                    value={manualJoinRoomId}
                  />
                </label>
              ) : null}
              <label className="grid gap-2" htmlFor="join-nickname">
                <span className="text-sm font-semibold text-stone-700">昵称</span>
                <input
                  className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                  autoComplete="name"
                  id="join-nickname"
                  maxLength={12}
                  name="joinNickname"
                  onChange={(event) => {
                    setJoinNickname(event.target.value);
                  }}
                  placeholder="输入你的昵称"
                  value={joinNickname}
                />
              </label>
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
              <label className="grid gap-2" htmlFor="create-nickname">
                <span className="text-sm font-semibold text-stone-700">房主昵称</span>
                <input
                  className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                  autoComplete="name"
                  id="create-nickname"
                  maxLength={12}
                  name="createNickname"
                  onChange={(event) => {
                    setCreateNickname(event.target.value);
                  }}
                  placeholder="输入你的昵称"
                  value={createNickname}
                />
              </label>
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
