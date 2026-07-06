import { useEffect, useState } from "react";

import { createRoom, joinRoom } from "../api/roomApi";
import { HomeActionButton } from "../components/HomeActionButton";

export function HomePage() {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [createNickname, setCreateNickname] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const invitedRoomId = searchParams.get("roomId")?.replace(/\D/gu, "").slice(0, 3);

    if (invitedRoomId?.length === 3) {
      setJoinRoomId(invitedRoomId);
    }
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

    try {
      const response = await joinRoom({
        roomId: joinRoomId,
        nickname: joinNickname,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      window.location.assign(`/room/${response.data.roomId}`);
    } catch {
      setErrorMessage("加入房间失败，请稍后再试。");
    } finally {
      setIsJoiningRoom(false);
    }
  }

  function handleJoinRoomIdChange(value: string) {
    setJoinRoomId(value.replace(/\D/gu, "").slice(0, 3));
  }

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-between">
        <div className="pt-12">
          <p className="text-sm font-semibold text-emerald-700">四川麻将计分</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">mah-score</h1>
        </div>

        <div className="grid gap-3 pb-8">
          {errorMessage !== undefined ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <div className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">加入房间</h2>
              <p className="mt-1 text-sm text-stone-500">输入房间号和昵称</p>
            </div>
            <input
              className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
              inputMode="numeric"
              maxLength={3}
              onChange={(event) => {
                handleJoinRoomIdChange(event.target.value);
              }}
              placeholder="房间号"
              value={joinRoomId}
            />
            <input
              className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
              maxLength={12}
              onChange={(event) => {
                setJoinNickname(event.target.value);
              }}
              placeholder="昵称"
              value={joinNickname}
            />
            <HomeActionButton
              disabled={
                isJoiningRoom || joinRoomId.length !== 3 || joinNickname.trim().length === 0
              }
              onClick={handleJoinRoom}
              variant="primary"
            >
              {isJoiningRoom ? "加入中..." : "加入房间"}
            </HomeActionButton>
          </div>

          <div className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">创建房间</h2>
              <p className="mt-1 text-sm text-stone-500">没有房间号时使用</p>
            </div>
            <input
              className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
              maxLength={12}
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
              {isCreatingRoom ? "创建中..." : "创建房间"}
            </HomeActionButton>
          </div>
        </div>
      </section>
    </main>
  );
}
