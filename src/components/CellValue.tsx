import { Link } from "react-router";
import { parseIdList } from "../../shared/schema";
import type { ColumnInfo, Labels, Row } from "../../shared/types";

const linkClass = "text-sky-700 hover:underline dark:text-sky-400";

export function RefLink({ table, id, labels }: { table: string; id: number | string; labels: Labels }) {
  const label = labels[table]?.[String(id)];
  return (
    <Link to={`/t/${table}/${id}`} className={linkClass}>
      {label ?? `#${id}`}
      {label && <span className="ml-1 text-xs text-zinc-500">#{id}</span>}
    </Link>
  );
}

/** Renders one field: links for IDs, clickable URLs, truncated text in tables. */
export function CellValue({ column, row, labels, full = false }: { column: ColumnInfo; row: Row; labels: Labels; full?: boolean }) {
  const value = row[column.name];
  if (value === null || value === undefined) return <span className="text-zinc-400">—</span>;
  if (value === "") return <span className="text-zinc-400 italic">(empty)</span>;

  const target = column.ref ?? (column.poly ? column.poly.targets[String(row[column.poly.typeColumn])] : undefined);
  if (target) {
    const ids = parseIdList(value);
    if (ids.length) {
      return (
        <span className="inline-flex flex-wrap gap-x-3">
          {ids.map((id) => (
            <RefLink key={id} table={target} id={id} labels={labels} />
          ))}
        </span>
      );
    }
  }

  const text = String(value);
  if (/^https?:\/\/\S+$/.test(text)) {
    return (
      <a href={text} target="_blank" rel="noreferrer noopener" className={linkClass}>
        {full ? text : text.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40) + (text.length > 48 ? "…" : "")}
      </a>
    );
  }
  if (full) return <span className="break-words whitespace-pre-wrap">{text}</span>;
  if (text.length > 80) return <span title={text}>{text.slice(0, 80)}…</span>;
  return <span>{text}</span>;
}
