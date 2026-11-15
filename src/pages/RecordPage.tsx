import { Link, useParams } from "react-router";
import type { RecordResponse } from "../../shared/types";
import { CellValue } from "../components/CellValue";
import DataTable from "../components/DataTable";
import { ErrorBox, Loading, OfflineNote } from "../components/Status";
import { useApi } from "../lib/useApi";

export default function RecordPage() {
  const { table = "", id = "" } = useParams();
  const { data, error, offline } = useApi<RecordResponse>(`/api/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`);

  if (error) return <ErrorBox message={error} />;
  if (!data || data.table !== table || String(data.row.id) !== id) return <Loading />;

  const { row, columns, labels, references, labelColumn } = data;
  const title =
    labels[table]?.[id] ?? (labelColumn && row[labelColumn] ? String(row[labelColumn]) : `${table} #${id}`);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link to={`/t/${table}`} className="text-sky-700 hover:underline dark:text-sky-400">
            {table}
          </Link>
          <span className="text-zinc-500"> / #{id}</span>
        </p>
        <h1 className="text-xl font-semibold">{title}</h1>
        {offline && <OfflineNote />}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(12rem,auto)_1fr]">
        {columns.map((c) => (
          <div key={c.name} className="contents">
            <dt className="text-sm">
              <span className="font-medium">{c.name}</span>
              {c.comment && <span className="block text-xs text-zinc-500">{c.comment}</span>}
            </dt>
            <dd className="text-sm">
              <CellValue column={c} row={row} labels={labels} full />
            </dd>
          </div>
        ))}
      </dl>

      {references.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Linked from</h2>
          {references.map((ref) => {
            const params = new URLSearchParams();
            ref.filter.forEach((f) => params.append("filter", f));
            return (
              <div key={`${ref.table}.${ref.column}`} className="space-y-2">
                <h3 className="text-sm">
                  <span className="font-medium">{ref.table}</span>
                  <span className="text-zinc-500">
                    {" "}
                    by {ref.column} · {ref.total.toLocaleString()} {ref.total === 1 ? "row" : "rows"}
                  </span>
                  {ref.total > ref.rows.length && (
                    <Link to={`/t/${ref.table}?${params}`} className="ml-2 text-sky-700 hover:underline dark:text-sky-400">
                      view all →
                    </Link>
                  )}
                </h3>
                <DataTable table={ref.table} columns={ref.columns} rows={ref.rows} labels={labels} />
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
