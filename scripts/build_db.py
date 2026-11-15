#!/usr/bin/env python3
"""Convert the tmidb phpMyAdmin (MySQL) dump in sql/ into SQLite / Cloudflare D1.

Outputs (default: build/, which is git-ignored):
  tmidb.sqlite  - local SQLite database, built and checked against the dump
  tmidb-d1.sql  - SQLite-dialect SQL (DROP + CREATE + batched INSERTs) for D1

Usage: python3 -I scripts/build_db.py [--sql-dir sql] [--out-dir build]

Type mapping: integer types -> INTEGER, decimal -> REAL, enum -> TEXT with a
CHECK constraint, everything else (varchar, text, date) -> TEXT. MySQL column
COMMENTs are kept as `--` comments in the CREATE TABLE statements.
"""
import argparse
import re
import sqlite3
import sys
from pathlib import Path

STRING = r"'(?:[^'\\]|\\.|'')*'"
NUMBER = r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?"
VALUE_TOKEN = re.compile(r"\s*(?:(" + STRING + r")|(" + NUMBER + r")|(NULL)\b|([(),;]))", re.S)
DEF_TOKEN = re.compile(
    r"\s*(`[^`]*`|" + STRING + r"|[A-Za-z_]\w*(?:\((?:" + STRING + r"|[^()'])*\))?|" + NUMBER + r")",
    re.S,
)
CREATE_RE = re.compile(r"CREATE TABLE `(\w+)` \((.*?)\n\) ENGINE=[^;]*;", re.S)
INSERT_RE = re.compile(r"INSERT INTO `(\w+)` \(([^)]*)\) VALUES", re.S)
ALTER_RE = re.compile(r"ALTER TABLE `(\w+)`\s+(.*?);\s*$", re.S | re.M)

MYSQL_UNESCAPES = {"0": "\0", "'": "'", '"': '"', "b": "\b", "n": "\n",
                   "r": "\r", "t": "\t", "Z": "\x1a", "\\": "\\"}
UNESCAPE_RE = re.compile(r"\\(.)|''", re.S)

INT_TYPES = {"tinyint", "smallint", "mediumint", "int", "integer", "bigint", "bit", "bool", "boolean", "year"}
REAL_TYPES = {"decimal", "numeric", "float", "double", "real"}
BLOB_TYPES = {"blob", "tinyblob", "mediumblob", "longblob", "binary", "varbinary"}


def mysql_unquote(lit):
    def repl(m):
        c = m.group(1)
        if c is None:
            return "'"
        if c in MYSQL_UNESCAPES:
            return MYSQL_UNESCAPES[c]
        if c in "%_":
            return "\\" + c
        return c
    return UNESCAPE_RE.sub(repl, lit[1:-1])


def mysql_quote(s):
    """phpMyAdmin / mysqli_real_escape_string style, used to round-trip check parsing."""
    for a, b in (("\\", "\\\\"), ("\0", "\\0"), ("\n", "\\n"), ("\r", "\\r"),
                 ("'", "\\'"), ('"', '\\"'), ("\x1a", "\\Z")):
        s = s.replace(a, b)
    return "'" + s + "'"


def sql_quote(s):
    return "'" + s.replace("'", "''") + "'"


def ident(name):
    return '"' + name.replace('"', '""') + '"'


def split_top_level(body):
    """Split a CREATE TABLE body on commas outside quotes/parens."""
    parts, depth, start, i, n = [], 0, 0, 0, len(body)
    while i < n:
        c = body[i]
        if c == "'":
            m = re.compile(STRING, re.S).match(body, i)
            i = m.end()
            continue
        if c == "`":
            i = body.index("`", i + 1) + 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == "," and depth == 0:
            parts.append(body[start:i])
            start = i + 1
        i += 1
    parts.append(body[start:])
    return [p.strip() for p in parts if p.strip()]


def tokenize_def(text):
    toks, pos = [], 0
    text = text.strip()
    while pos < len(text):
        m = DEF_TOKEN.match(text, pos)
        if not m:
            raise ValueError(f"Cannot tokenize column definition near: {text[pos:pos + 60]!r}")
        toks.append(m.group(1))
        pos = m.end()
    return toks


def parse_column(defn):
    toks = tokenize_def(defn)
    if not toks[0].startswith("`"):
        raise ValueError(f"Unsupported table element: {defn[:80]!r}")
    col = {"name": toks[0][1:-1], "mysql_type": toks[1], "not_null": False,
           "default": None, "comment": None}
    base = toks[1].split("(")[0].lower()
    col["base"] = base
    if base in INT_TYPES:
        col["type"] = "INTEGER"
    elif base in REAL_TYPES:
        col["type"] = "REAL"
    elif base in BLOB_TYPES:
        col["type"] = "BLOB"
    else:
        col["type"] = "TEXT"
    col["enum"] = ([mysql_unquote(v) for v in re.findall(STRING, toks[1], re.S)]
                   if base in ("enum", "set") else None)
    i = 2
    while i < len(toks):
        t = toks[i].upper()
        if t in ("UNSIGNED", "ZEROFILL", "AUTO_INCREMENT"):
            i += 1
        elif t == "COLLATE":
            i += 2
        elif t == "CHARACTER" and toks[i + 1].upper() == "SET":
            i += 3
        elif t == "NOT" and toks[i + 1].upper() == "NULL":
            col["not_null"] = True
            i += 2
        elif t == "NULL":
            i += 1
        elif t == "DEFAULT":
            col["default"] = toks[i + 1]
            i += 2
        elif t == "COMMENT":
            col["comment"] = mysql_unquote(toks[i + 1])
            i += 2
        else:
            raise ValueError(f"Unhandled column attribute {toks[i]!r} in: {defn[:120]!r}")
    return col


def sqlite_default(col):
    d = col["default"]
    if d is None or d.upper() == "NULL":
        return None
    if d.startswith("'"):
        v = mysql_unquote(d)
        if col["type"] in ("INTEGER", "REAL") and re.fullmatch(NUMBER, v):
            return v
        return sql_quote(v)
    return d  # bare number or CURRENT_TIMESTAMP


def parse_extra(text):
    """Primary keys and secondary indexes from the phpMyAdmin 'extra' file."""
    pks, indexes = {}, []
    for table, clauses in ALTER_RE.findall(text):
        for m in re.finditer(r"ADD PRIMARY KEY \(([^)]*)\)", clauses):
            pks[table] = re.findall(r"`(\w+)`", m.group(1))
        for m in re.finditer(r"ADD (UNIQUE )?(?:KEY|INDEX) `(\w+)` \(((?:[^()]|\(\d+\))*)\)", clauses):
            indexes.append((table, m.group(2), bool(m.group(1)), re.findall(r"`(\w+)`", m.group(3))))
        if re.search(r"ADD (FULLTEXT|SPATIAL|CONSTRAINT|FOREIGN)", clauses):
            print(f"warning: skipped unsupported index/constraint on {table}", file=sys.stderr)
    return pks, indexes


def build_create(table, cols, pk):
    single_int_pk = pk is not None and len(pk) == 1 and next(
        c for c in cols if c["name"] == pk[0])["type"] == "INTEGER"
    lines = []
    for c in cols:
        parts = [ident(c["name"]), c["type"]]
        if single_int_pk and c["name"] == pk[0]:
            parts.append("PRIMARY KEY")
        if c["not_null"]:
            parts.append("NOT NULL")
        default = sqlite_default(c)
        if default is not None:
            parts.append("DEFAULT " + default)
        if c["enum"] is not None:
            # MySQL always accepts '' as an enum's "invalid value" (non-strict mode
            # stores it for out-of-list values), so the CHECK has to allow it too.
            allowed = c["enum"] + ([""] if "" not in c["enum"] else [])
            parts.append(f"CHECK ({ident(c['name'])} IN ({', '.join(sql_quote(v) for v in allowed)}))")
        lines.append([" ".join(parts), c["comment"]])
    if pk and not single_int_pk:
        lines.append([f"PRIMARY KEY ({', '.join(ident(k) for k in pk)})", None])
    out = []
    for idx, (sql, comment) in enumerate(lines):
        sep = "," if idx < len(lines) - 1 else ""
        note = f" -- {' '.join(comment.split())}" if comment else ""
        out.append(f"  {sql}{sep}{note}")
    return f"CREATE TABLE {ident(table)} (\n" + "\n".join(out) + "\n);"


def parse_inserts(text, table, cols, stats):
    rows = []
    for m in INSERT_RE.finditer(text):
        if m.group(1) != table:
            raise ValueError(f"INSERT for {m.group(1)} found in file for {table}")
        names = re.findall(r"`(\w+)`", m.group(2))
        if names != [c["name"] for c in cols]:
            raise ValueError(f"{table}: INSERT column list differs from CREATE TABLE")
        pos = m.end()
        while True:
            tok = VALUE_TOKEN.match(text, pos)
            if not tok or tok.group(4) != "(":
                raise ValueError(f"{table}: expected '(' at offset {pos}")
            pos = tok.end()
            row = []
            while True:
                tok = VALUE_TOKEN.match(text, pos)
                if not tok:
                    raise ValueError(f"{table}: bad value at offset {pos}: {text[pos:pos + 60]!r}")
                pos = tok.end()
                s, num, null = tok.group(1), tok.group(2), tok.group(3)
                if s is not None:
                    v = mysql_unquote(s)
                    stats["strings"] += 1
                    if mysql_quote(v) != s:
                        stats["roundtrip_mismatch"].append((table, s[:80]))
                    row.append(v)
                elif num is not None:
                    row.append(float(num) if any(ch in num for ch in ".eE") else int(num))
                elif null is not None:
                    row.append(None)
                else:
                    raise ValueError(f"{table}: unexpected {tok.group(4)!r} at offset {pos}")
                tok = VALUE_TOKEN.match(text, pos)
                pos = tok.end()
                if tok.group(4) == ",":
                    continue
                if tok.group(4) == ")":
                    break
                raise ValueError(f"{table}: expected ',' or ')' at offset {pos}")
            if len(row) != len(cols):
                raise ValueError(f"{table}: row has {len(row)} values, expected {len(cols)}")
            rows.append(row)
            tok = VALUE_TOKEN.match(text, pos)
            pos = tok.end()
            if tok.group(4) == ",":
                continue
            if tok.group(4) == ";":
                break
            raise ValueError(f"{table}: expected ',' or ';' after row at offset {pos}")
    return rows


def literal(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return str(int(v))
    if isinstance(v, (int, float)):
        return repr(v)
    if "\0" in v:
        raise ValueError("NUL byte in text value cannot be written as a SQL literal")
    return sql_quote(v)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sql-dir", default="sql")
    ap.add_argument("--out-dir", default="build")
    ap.add_argument("--batch-bytes", type=int, default=90_000,
                    help="max size of one INSERT statement in the D1 file (D1 limit is 100 KB)")
    args = ap.parse_args()

    sql_dir, out_dir = Path(args.sql_dir), Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    pks, indexes = parse_extra((sql_dir / "tmidb_extra.sql").read_text(encoding="utf-8"))

    db_path = out_dir / "tmidb.sqlite"
    db_path.unlink(missing_ok=True)
    db = sqlite3.connect(db_path)
    stats = {"strings": 0, "roundtrip_mismatch": []}
    schema, tables = [], []

    for path in sorted(sql_dir.glob("tmidb_table_*.sql")):
        text = path.read_text(encoding="utf-8")
        creates = CREATE_RE.findall(text)
        if len(creates) != 1:
            raise ValueError(f"{path.name}: expected one CREATE TABLE, found {len(creates)}")
        table, body = creates[0]
        cols = [parse_column(d) for d in split_top_level(body)]
        create_sql = build_create(table, cols, pks.get(table))
        db.execute(create_sql)
        rows = parse_inserts(text, table, cols, stats)
        placeholders = ", ".join("?" for _ in cols)
        col_list = ", ".join(ident(c["name"]) for c in cols)
        db.executemany(f"INSERT INTO {ident(table)} ({col_list}) VALUES ({placeholders})", rows)
        schema.append((table, create_sql))
        tables.append((table, cols, len(rows)))

    index_sql = []
    for table, name, unique, cols in indexes:
        stmt = (f"CREATE {'UNIQUE ' if unique else ''}INDEX {ident(table + '_' + name)} "
                f"ON {ident(table)} ({', '.join(ident(c) for c in cols)});")
        db.execute(stmt)
        index_sql.append(stmt)
    db.commit()

    # ---- verification -------------------------------------------------------
    problems = []
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        problems.append("integrity_check failed")
    for table, cols, n in tables:
        got = db.execute(f"SELECT COUNT(*) FROM {ident(table)}").fetchone()[0]
        if got != n:
            problems.append(f"{table}: {got} rows in SQLite, {n} in dump")
        for c in cols:
            allowed = {"INTEGER": "('integer','null')", "REAL": "('real','integer','null')",
                       "TEXT": "('text','null')", "BLOB": "('blob','null')"}[c["type"]]
            bad = db.execute(f"SELECT COUNT(*) FROM {ident(table)} "
                             f"WHERE typeof({ident(c['name'])}) NOT IN {allowed}").fetchone()[0]
            if bad:
                problems.append(f"{table}.{c['name']}: {bad} values not stored as {c['type']}")
    if stats["roundtrip_mismatch"]:
        problems.append(f"{len(stats['roundtrip_mismatch'])} string literals did not round-trip, "
                        f"e.g. {stats['roundtrip_mismatch'][:3]}")

    # ---- D1 SQL file --------------------------------------------------------
    d1_path = out_dir / "tmidb-d1.sql"
    n_statements = 0
    with d1_path.open("w", encoding="utf-8", newline="\n") as f:
        for table, create_sql in schema:
            f.write(f"DROP TABLE IF EXISTS {ident(table)};\n{create_sql}\n")
        for stmt in index_sql:
            f.write(stmt + "\n")
        for table, cols, _ in tables:
            col_list = ", ".join(ident(c["name"]) for c in cols)
            head = f"INSERT INTO {ident(table)} ({col_list}) VALUES\n"
            batch, size = [], len(head)
            for row in db.execute(f"SELECT * FROM {ident(table)} ORDER BY rowid"):
                tup = "(" + ", ".join(literal(v) for v in row) + ")"
                if len(head) + len(tup.encode()) + 2 > args.batch_bytes:
                    raise ValueError(f"{table}: a single row exceeds --batch-bytes")
                if batch and size + len(tup.encode()) + 2 > args.batch_bytes:
                    f.write(head + ",\n".join(batch) + ";\n")
                    n_statements += 1
                    batch, size = [], len(head)
                batch.append(tup)
                size += len(tup.encode()) + 2
            if batch:
                f.write(head + ",\n".join(batch) + ";\n")
                n_statements += 1
    db.close()

    total = sum(n for _, _, n in tables)
    for table, cols, n in tables:
        print(f"  {table:<28} {n:>7} rows  {len(cols):>3} cols")
    print(f"tables: {len(tables)}  rows: {total}  string values checked: {stats['strings']}")
    print(f"wrote {db_path} ({db_path.stat().st_size / 1e6:.1f} MB)")
    print(f"wrote {d1_path} ({d1_path.stat().st_size / 1e6:.1f} MB, {n_statements} INSERT statements)")
    if problems:
        print("PROBLEMS:\n  " + "\n  ".join(problems), file=sys.stderr)
        sys.exit(1)
    print("all checks passed")


if __name__ == "__main__":
    main()
