import { Link } from "react-router";
import type { ColumnInfo, Labels, Row } from "../../shared/types";
import { CellValue } from "./CellValue";

interface Props {
  table: string;
  columns: ColumnInfo[];
  rows: Row[];
  labels: Labels;
  sort?: { column: string; dir: "asc" | "desc" } | null;
  onSort?: (column: string) => void;
}

export default function DataTable({ table, columns, rows, labels, sort, onSort }: Props) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-900">
          <tr>
            {columns.map((c) => (
              <th key={c.name} title={c.comment ?? undefined} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {onSort ? (
                  <button className="hover:underline" onClick={() => onSort(c.name)}>
                    {c.name}
                    {sort?.column === c.name ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                ) : (
                  c.name
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)} className="border-t border-zinc-200 align-top dark:border-zinc-800">
              {columns.map((c) => (
                <td key={c.name} className="max-w-[22rem] overflow-hidden px-2 py-1 text-ellipsis whitespace-nowrap">
                  {c.name === "id" && row.id !== null ? (
                    <Link to={`/t/${table}/${row.id}`} className="font-medium text-sky-700 hover:underline dark:text-sky-400">
                      {row.id}
                    </Link>
                  ) : (
                    <CellValue column={c} row={row} labels={labels} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
