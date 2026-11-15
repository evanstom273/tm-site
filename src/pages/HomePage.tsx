import { Link } from "react-router";
import type { TableSummary } from "../../shared/types";
import { ErrorBox, Loading, OfflineNote } from "../components/Status";
import { useApi } from "../lib/useApi";

export default function HomePage() {
  const { data, error, offline } = useApi<TableSummary[]>("/api/tables");

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const totalRows = data.reduce((n, t) => n + t.rowCount, 0);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tables</h1>
        <p className="text-sm text-zinc-500">
          {data.length} tables, {totalRows.toLocaleString()} rows
        </p>
        {offline && <OfflineNote />}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((t) => (
          <li key={t.name}>
            <Link
              to={`/t/${t.name}`}
              className="flex items-baseline justify-between rounded border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-zinc-500">
                {t.rowCount.toLocaleString()} rows · {t.columns.length} cols
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
