import { useLiveQuery } from "dexie-react-hooks";
import { Link, Outlet, useNavigate, useParams } from "react-router";
import type { TableSummary } from "../../shared/types";
import { cacheDb } from "../lib/cache";
import { useApi } from "../lib/useApi";

export default function Layout() {
  const { data: tables } = useApi<TableSummary[]>("/api/tables");
  const { table } = useParams();
  const navigate = useNavigate();
  const cachedCount = useLiveQuery(() => cacheDb.responses.count().catch(() => 0), [], 0);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="font-semibold">
            tm-site
          </Link>
          <span className="text-sm text-zinc-500">database browser</span>
          <select
            aria-label="Jump to table"
            className="ml-auto rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
            value={table ?? ""}
            onChange={(e) => e.target.value && navigate(`/t/${e.target.value}`)}
          >
            <option value="">Jump to table…</option>
            {tables?.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <span>
            {cachedCount} {cachedCount === 1 ? "page" : "pages"} saved offline
          </span>
          {cachedCount > 0 && (
            <button className="underline hover:text-zinc-800 dark:hover:text-zinc-200" onClick={() => cacheDb.responses.clear()}>
              Clear
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
