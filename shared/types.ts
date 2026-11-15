// Shapes of the JSON the Worker's /api routes return.

export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface ColumnInfo {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  comment: string | null;
  enumValues: string[] | null;
  /** Table this column points at (single ID or list of IDs). */
  ref: string | null;
  list: boolean;
  /** For polymorphic columns: which column says the target, and the mapping. */
  poly: { typeColumn: string; targets: Record<string, string> } | null;
}

export interface TableSummary {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  labelColumn: string | null;
}

/** table -> id -> display label */
export type Labels = Record<string, Record<string, string>>;

export interface RowsResponse {
  table: string;
  columns: ColumnInfo[];
  labelColumn: string | null;
  rows: Row[];
  total: number;
  page: number;
  size: number;
  labels: Labels;
}

export interface Reference {
  table: string;
  column: string;
  /** Filter to use on the table page to see every matching row. */
  filter: string[];
  total: number;
  rows: Row[];
  columns: ColumnInfo[];
}

export interface RecordResponse {
  table: string;
  columns: ColumnInfo[];
  labelColumn: string | null;
  row: Row;
  references: Reference[];
  labels: Labels;
}
