import { HomeActionButton } from "../components/HomeActionButton";

export function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-between">
        <div className="pt-12">
          <p className="text-sm font-semibold text-emerald-700">四川麻将计分</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">mah-score</h1>
        </div>

        <div className="grid gap-3 pb-8">
          <HomeActionButton variant="primary">创建房间</HomeActionButton>
          <HomeActionButton variant="secondary">加入房间</HomeActionButton>
        </div>
      </section>
    </main>
  );
}
