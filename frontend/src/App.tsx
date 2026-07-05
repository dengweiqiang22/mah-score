export function App() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-8 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-700">四川麻将计分</p>
          <h1 className="text-4xl font-semibold tracking-normal">mah-score</h1>
          <p className="text-base leading-7 text-stone-600">
            轻量级多人计分工具。当前 Epic 仅完成项目初始化，房间功能将在后续任务实现。
          </p>
        </div>

        <div className="grid gap-3">
          <button
            className="h-12 rounded-md bg-emerald-700 px-4 text-base font-medium text-white"
            type="button"
          >
            创建房间
          </button>
          <button
            className="h-12 rounded-md border border-stone-300 bg-white px-4 text-base font-medium text-stone-900"
            type="button"
          >
            加入房间
          </button>
        </div>
      </section>
    </main>
  );
}
