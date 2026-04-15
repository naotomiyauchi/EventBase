export default function MaintenancePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
          EVENTBASE
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          このドメインは現在機能停止中です
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          開発・運用は <strong>localhost</strong> または <strong>anfra.jp</strong>{" "}
          系ドメインで利用してください。正式リリース時に
          <strong> event-base.app</strong> / <strong>www.event-base.app</strong>{" "}
          の機能を有効化できます。
        </p>
      </section>
    </main>
  );
}
