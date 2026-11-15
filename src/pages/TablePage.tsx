import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import type { RowsResponse } from "../../shared/types";
import DataTable from "../components/DataTable";
import { ErrorBox, Loading, OfflineNote } from "../components/Status";
import { useApi } from "../lib/useApi";

export default function TablePage() {
  const { table = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const filters = params.getAll("filter");
  const sortColumn = params.get("sort");
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const { data, error, loading, offline } = useApi<RowsResponse>(`/api/tables/${encodeURIComponent(table)}?${params}`);
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q, table]);

  const update = (change: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next);
  };

  if (error) return <ErrorBox message={error} />;
  if (!data || data.table !== table) return <Loading />;

  const from = data.total === 0 ? 0 : (data.page - 1) * data.size + 1;
  const to = Math.min(data.page * data.size, data.total);
  const lastPage = Math.max(1, Math.ceil(data.total / data.size));
  const goTo = (page: number) => update((p) => (page === 1 ? p.delete("page") : p.set("page", String(page))));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold">{table}</h1>
        <span className="text-sm text-zinc-500">{data.total.toLocaleString()} rows</span>
        {loading && <span className="text-xs text-zinc-400">updating…</span>}
      </div>
      {offline && <OfflineNote />}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update((p) => {
            if (search.trim()) p.set("q", search.trim());
            else p.delete("q");
            p.delete("page");
          });
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${table}…`}
          className="w-full max-w-md rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <button className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
          Search
        </button>
      </form>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {filters.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {f.replace(":", " = ")}
              <button
                aria-label={`Remove filter ${f}`}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() =>
                  update((p) => {
                    const rest = p.getAll("filter").filter((x) => x !== f);
                    p.delete("filter");
                    rest.forEach((x) => p.append("filter", x));
                    p.delete("page");
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
          <Link to={`/t/${table}`} className="text-sky-700 hover:underline dark:text-sky-400">
            clear all
          </Link>
        </div>
      )}

      {data.rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No rows match.</p>
      ) : (
        <DataTable
          table={table}
          columns={data.columns}
          rows={data.rows}
          labels={data.labels}
          sort={sortColumn ? { column: sortColumn, dir } : { column: "id", dir: "asc" }}
          onSort={(column) =>
            update((p) => {
              const same = (p.get("sort") ?? "id") === column;
              p.set("sort", column);
              p.set("dir", same && dir === "asc" ? "desc" : "asc");
              p.delete("page");
            })
          }
        />
      )}

      <div className="flex items-center gap-3 text-sm">
        <button
          disabled={data.page <= 1}
          onClick={() => goTo(data.page - 1)}
          className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
        >
          ← Prev
        </button>
        <span className="text-zinc-500">
          {from.toLocaleString()}–{to.toLocaleString()} of {data.total.toLocaleString()} · page {data.page} of {lastPage}
        </span>
        <button
          disabled={data.page >= lastPage}
          onClick={() => goTo(data.page + 1)}
          className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
