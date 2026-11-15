import { LABEL_COLUMNS, LIST_COLUMNS, parseIdList, polymorphicRef, refTarget } from "../shared/schema";
import type {
  ColumnInfo,
  Labels,
  RecordResponse,
  Reference,
  Row,
  RowsResponse,
  TableSummary,
} from "../shared/types";

interface TableMeta {
  name: string;
  columns: ColumnInfo[];
  labelColumn: string | null;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_PAGE_SIZE = 200;
const REFERENCE_PREVIEW_ROWS = 25;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method !== "GET") throw new HttpError(405, "Method not allowed");
      const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

      if (parts.length === 1 && parts[0] === "tables") return json(await listTables(env.DB));
      if (parts.length === 2 && parts[0] === "tables") return json(await listRows(env.DB, parts[1], url));
      if (parts.length === 3 && parts[0] === "tables") return json(await getRecord(env.DB, parts[1], parts[2]));
      throw new HttpError(404, "Not found");
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong talking to the database" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=300" : "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Schema (read once per isolate: the data only changes when it is re-imported)

let schemaPromise: Promise<Map<string, TableMeta>> | null = null;
let rowCountsPromise: Promise<Map<string, number>> | null = null;

function getSchema(db: D1Database) {
  schemaPromise ??= loadSchema(db).catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

function getRowCounts(db: D1Database, schema: Map<string, TableMeta>) {
  rowCountsPromise ??= (async () => {
    const names = [...schema.keys()];
    const results = await db.batch<{ n: number }>(
      names.map((name) => db.prepare(`SELECT COUNT(*) AS n FROM ${ident(name)}`)),
    );
    return new Map(names.map((name, i) => [name, results[i].results[0]?.n ?? 0]));
  })().catch((err) => {
    rowCountsPromise = null;
    throw err;
  });
  return rowCountsPromise;
}

async function loadSchema(db: D1Database) {
  const { results } = await db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY name",
    )
    .all<{ name: string; sql: string }>();
  return new Map(
    results.map(({ name, sql }) => [name, { name, columns: parseColumns(name, sql), labelColumn: LABEL_COLUMNS[name] ?? null }]),
  );
}

// Column lines look like:  "name" TEXT NOT NULL DEFAULT 'x' CHECK (...), -- comment
const COLUMN_LINE = /^\s*"((?:[^"]|"")+)"\s+([A-Z]+)(.*)$/;

function parseColumns(table: string, sql: string): ColumnInfo[] {
  const columns: ColumnInfo[] = [];
  for (const line of sql.split("\n")) {
    const m = COLUMN_LINE.exec(line);
    if (!m) continue;
    const name = m[1].replaceAll('""', '"');
    const commentAt = m[3].indexOf(" -- ");
    const def = commentAt >= 0 ? m[3].slice(0, commentAt) : m[3];
    const enumMatch = /CHECK \(.*? IN \((.*)\)\)/.exec(def);
    columns.push({
      name,
      type: m[2],
      primaryKey: def.includes("PRIMARY KEY"),
      notNull: def.includes("NOT NULL"),
      comment: commentAt >= 0 ? m[3].slice(commentAt + 4).trim() || null : null,
      enumValues: enumMatch
        ? [...enumMatch[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replaceAll("''", "'"))
        : null,
      ref: refTarget(table, name),
      list: LIST_COLUMNS.has(name),
      poly: polymorphicRef(table, name),
    });
  }
  return columns;
}

async function requireTable(db: D1Database, table: string) {
  const schema = await getSchema(db);
  const meta = schema.get(table);
  if (!meta) throw new HttpError(404, `No table called "${table}"`);
  return { schema, meta };
}

// ---------------------------------------------------------------------------
// GET /api/tables

async function listTables(db: D1Database): Promise<TableSummary[]> {
  const schema = await getSchema(db);
  const counts = await getRowCounts(db, schema);
  return [...schema.values()].map((m) => ({ ...m, rowCount: counts.get(m.name) ?? 0 }));
}

// ---------------------------------------------------------------------------
// GET /api/tables/:table?page=&size=&q=&sort=&dir=&filter=col:value

async function listRows(db: D1Database, table: string, url: URL): Promise<RowsResponse> {
  const { schema, meta } = await requireTable(db, table);
  const columns = new Map(meta.columns.map((c) => [c.name, c]));
  const page = intParam(url, "page", 1, 1, 1_000_000);
  const size = intParam(url, "size", 50, 1, MAX_PAGE_SIZE);

  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown) => {
    params.push(v);
    return `?${params.length}`;
  };

  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const like = bind(`%${escapeLike(q)}%`);
    const ors = meta.columns.filter((c) => c.type === "TEXT").map((c) => `${ident(c.name)} LIKE ${like} ESCAPE '\\'`);
    if (/^\d+$/.test(q) && columns.has("id")) ors.push(`"id" = ${bind(Number(q))}`);
    where.push(ors.length ? `(${ors.join(" OR ")})` : "0");
  }

  for (const f of url.searchParams.getAll("filter")) {
    const at = f.indexOf(":");
    const col = at > 0 ? columns.get(f.slice(0, at)) : undefined;
    if (!col) throw new HttpError(400, `Bad filter "${f}"`);
    const value = f.slice(at + 1);
    if (col.list) where.push(`${listExpr(col.name)} LIKE ${bind(`%|${escapeLike(value)}|%`)} ESCAPE '\\'`);
    else where.push(`${ident(col.name)} = ${bind(value)}`);
  }

  const sortCol = columns.get(url.searchParams.get("sort") ?? "") ?? columns.get("id");
  const dir = url.searchParams.get("dir") === "desc" ? "DESC" : "ASC";
  const orderBy = sortCol
    ? `ORDER BY ${ident(sortCol.name)} ${dir}${sortCol.name !== "id" && columns.has("id") ? `, "id" ${dir}` : ""}`
    : "";
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const filterParams = [...params];

  const rowsStmt = db
    .prepare(
      `SELECT * FROM ${ident(table)} ${whereSql} ${orderBy} LIMIT ${bind(size)} OFFSET ${bind((page - 1) * size)}`,
    )
    .bind(...params);

  let rows: Row[];
  let total: number;
  if (where.length) {
    const [rowsRes, countRes] = await db.batch<Record<string, unknown>>([
      rowsStmt,
      db.prepare(`SELECT COUNT(*) AS n FROM ${ident(table)} ${whereSql}`).bind(...filterParams),
    ]);
    rows = rowsRes.results as Row[];
    total = Number(countRes.results[0]?.n ?? 0);
  } else {
    // Unfiltered: reuse the cached table count instead of scanning the table again.
    const [rowsRes, counts] = await Promise.all([rowsStmt.all<Row>(), getRowCounts(db, schema)]);
    rows = rowsRes.results;
    total = counts.get(table) ?? rows.length;
  }

  return {
    table,
    columns: meta.columns,
    labelColumn: meta.labelColumn,
    rows,
    total,
    page,
    size,
    labels: await resolveLabels(db, schema, rows.map((row) => ({ table, row }))),
  };
}

// ---------------------------------------------------------------------------
// GET /api/tables/:table/:id  (the row, plus rows elsewhere that point at it)

async function getRecord(db: D1Database, table: string, idParam: string): Promise<RecordResponse> {
  const { schema, meta } = await requireTable(db, table);
  if (!/^\d+$/.test(idParam)) throw new HttpError(400, "IDs are whole numbers");
  const id = Number(idParam);

  const relations: { meta: TableMeta; column: string; filter: string[]; stmt: D1PreparedStatement }[] = [];
  for (const other of schema.values()) {
    for (const col of other.columns) {
      const from = `SELECT *, COUNT(*) OVER () AS __total FROM ${ident(other.name)}`;
      const tail = `ORDER BY ${other.columns.some((c) => c.name === "id") ? '"id"' : "rowid"} LIMIT ${REFERENCE_PREVIEW_ROWS}`;
      if (col.ref === table && col.list) {
        relations.push({
          meta: other,
          column: col.name,
          filter: [`${col.name}:${id}`],
          stmt: db.prepare(`${from} WHERE ${listExpr(col.name)} LIKE ?1 ${tail}`).bind(`%|${id}|%`),
        });
      } else if (col.ref === table) {
        relations.push({
          meta: other,
          column: col.name,
          filter: [`${col.name}:${id}`],
          stmt: db.prepare(`${from} WHERE ${ident(col.name)} = ?1 ${tail}`).bind(id),
        });
      } else if (col.poly) {
        const key = Object.entries(col.poly.targets).find(([, t]) => t === table)?.[0];
        if (key === undefined) continue;
        relations.push({
          meta: other,
          column: col.name,
          filter: [`${col.poly.typeColumn}:${key}`, `${col.name}:${id}`],
          stmt: db
            .prepare(`${from} WHERE ${ident(col.poly.typeColumn)} = ?1 AND ${ident(col.name)} = ?2 ${tail}`)
            .bind(key, id),
        });
      }
    }
  }

  const [rowRes, ...relResults] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT * FROM ${ident(table)} WHERE "id" = ?1`).bind(id),
    ...relations.map((r) => r.stmt),
  ]);
  const row = rowRes.results[0] as Row | undefined;
  if (!row) throw new HttpError(404, `No ${table} row with id ${id}`);

  const references: Reference[] = [];
  relations.forEach((rel, i) => {
    const results = relResults[i].results;
    if (!results.length) return;
    const rows = results.map(({ __total, ...rest }) => rest as Row);
    references.push({
      table: rel.meta.name,
      column: rel.column,
      filter: rel.filter,
      total: Number(results[0].__total),
      rows,
      columns: rel.meta.columns,
    });
  });

  const labelItems = [{ table, row }, ...references.flatMap((r) => r.rows.map((row) => ({ table: r.table, row })))];
  return {
    table,
    columns: meta.columns,
    labelColumn: meta.labelColumn,
    row,
    references,
    labels: await resolveLabels(db, schema, labelItems),
  };
}

// ---------------------------------------------------------------------------
// Labels for every ID a set of rows links to, so links read "Greg Davies"
// rather than "#3".

const LABEL_SQL: Record<string, string> = {
  // "Series 1" exists for every show, so prefix the show name.
  seasons: `COALESCE((SELECT name FROM "shows" WHERE "shows"."id" = t."show_id") || ' · ', '') || t."title"`,
};

async function resolveLabels(db: D1Database, schema: Map<string, TableMeta>, items: { table: string; row: Row }[]) {
  const wanted = new Map<string, Set<number>>();
  const want = (target: string, ids: number[]) => {
    if (!LABEL_COLUMNS[target] || !schema.has(target) || !ids.length) return;
    const set = wanted.get(target) ?? new Set<number>();
    ids.forEach((id) => set.add(id));
    wanted.set(target, set);
  };

  for (const { table, row } of items) {
    const meta = schema.get(table);
    if (!meta) continue;
    if (meta.labelColumn && typeof row.id === "number") want(table, [row.id]);
    for (const col of meta.columns) {
      const value = row[col.name];
      if (col.ref) want(col.ref, parseIdList(value));
      else if (col.poly) {
        const target = col.poly.targets[String(row[col.poly.typeColumn])];
        if (target) want(target, parseIdList(value));
      }
    }
  }

  const targets = [...wanted.keys()];
  if (!targets.length) return {};
  const results = await db.batch<{ id: number; label: string | null }>(
    targets.map((target) => {
      const expr = LABEL_SQL[target] ?? `t.${ident(LABEL_COLUMNS[target])}`;
      return db
        .prepare(`SELECT t."id" AS id, ${expr} AS label FROM ${ident(target)} AS t WHERE t."id" IN (SELECT value FROM json_each(?1))`)
        .bind(JSON.stringify([...wanted.get(target)!]));
    }),
  );

  const labels: Labels = {};
  targets.forEach((target, i) => {
    labels[target] = {};
    for (const { id, label } of results[i].results) if (label) labels[target][id] = label;
  });
  return labels;
}

// ---------------------------------------------------------------------------
// helpers

function ident(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, "\\$&");
}

/** Normalises "|1|2|" / "1,2" lists to "|1|2|" so one LIKE pattern matches either. */
function listExpr(column: string) {
  return `('|' || replace(replace(IFNULL(${ident(column)}, ''), ',', '|'), ' ', '') || '|')`;
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `Bad ${name} "${raw}"`);
  return n;
}
