import { useState } from "react";

import { createRoom } from "../api/roomApi";
import { HomeActionButton } from "../components/HomeActionButton";

export function HomePage() {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleCreateRoom() {
    setIsCreatingRoom(true);
    setErrorMessage(undefined);

    try {
      const response = await createRoom();

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
          <HomeActionButton disabled={isCreatingRoom} onClick={handleCreateRoom} variant="primary">
            {isCreatingRoom ? "创建中..." : "创建房间"}
          </HomeActionButton>
          <HomeActionButton variant="secondary">加入房间</HomeActionButton>
        </div>
      </section>
    </main>
  );
}
