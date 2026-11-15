# tm-site

A browser for the tmidb Taskmaster database: every table, every row, with IDs
turned into links (a task links to its show, season, episode and winners; a
person's page lists everything that points at them).

Stack: React 19 + Vite + TypeScript + Tailwind CSS 4 on the front end, a
Cloudflare Worker for the API, Cloudflare D1 for the data, and Dexie
(IndexedDB) to keep a copy of pages you've already opened on your device.

## Layout

```
src/        React app (pages, components, Dexie cache in src/lib)
worker/     Cloudflare Worker: the /api routes, reading from D1
shared/     Types and the table-relationship map used by both
sql/        The original phpMyAdmin (MySQL) dump of tmidb
scripts/    build_db.py: converts sql/ into SQLite / D1 SQL in build/
```

## The database

D1 database `tmidb` (id `a7ce26f6-b05b-4d82-a03c-9967b6ba79e4`), bound to the
Worker as `DB`. 21 tables, 86,027 rows, converted from the dump in `sql/`.

`scripts/build_db.py` maps MySQL types to SQLite, keeps the original column
descriptions as SQL comments, and checks that every row and string value
survived the conversion. Run `npm run db:build` to regenerate
`build/tmidb.sqlite` and `build/tmidb-d1.sql`.

To load a newer dump: replace the files in `sql/`, then `npm run db:remote`.
That drops and recreates every table. It writes ~86k rows, which is most of
D1's free-plan daily write allowance.

Text comparisons in SQLite are case-sensitive, unlike the original MySQL
(`= 'greg davies'` won't match `Greg Davies`). Use `LIKE` or `COLLATE NOCASE`.

## API

- `GET /api/tables`: tables with row counts and column info
- `GET /api/tables/:table?page=&size=&q=&sort=&dir=&filter=column:value`
- `GET /api/tables/:table/:id`: one row, plus rows in other tables that link to it

## Develop

```sh
npm install
npm run db:local   # load the data into a local D1 for `npm run dev`
npm run dev
```

## Deploy

```sh
npx wrangler login
npm run deploy     # https://tm-site.<your-subdomain>.workers.dev
```
