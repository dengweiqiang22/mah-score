interface RoomPageProps {
  readonly roomId: string;
}

export function RoomPage({ roomId }: RoomPageProps) {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-8">
        <div className="pt-8">
          <p className="text-sm font-semibold text-emerald-700">房间</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">{roomId}</h1>
        </div>

        <div className="rounded-md border border-stone-200 bg-white p-4 text-base text-stone-600">
          等待玩家加入
        </div>
      </section>
    </main>
  );
}
