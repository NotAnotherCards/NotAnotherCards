import typescriptLogo from "/typescript.svg";
import { Button } from "./components/ui/button";

export function App() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-6">
          <h1 className="text-3xl font-bold uppercase tracking-[0.3em] text-muted-foreground">
            NotAnotherCards
          </h1>
          <h2 className="font-heading text-xl leading-none font-semibold tracking-tight text-balance">
            This is a test for Vitest.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">This is also a test</Button>
          </div>
        </div>

        <div className="flex items-center gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <img src="/vite.svg" className="size-16" alt="Vite logo" />
          <img src={typescriptLogo} className="size-16" alt="TypeScript logo" />
        </div>
      </section>
    </main>
  );
}
