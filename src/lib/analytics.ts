import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

type Kind = 'product' | 'project' | 'page';

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(process.cwd(), 'data', 'analytics.sqlite');

// HMR-safe singleton (Astro dev hot-reloads modules)
const g = globalThis as unknown as { __MST_ANALYTICS_DB?: Database.Database };

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = g.__MST_ANALYTICS_DB ?? new Database(DB_PATH);
if (!g.__MST_ANALYTICS_DB) {
  g.__MST_ANALYTICS_DB = db;

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');   // good balance for web workloads
  db.pragma('busy_timeout = 5000');    // avoid SQLITE_BUSY under parallel hits

  db.exec(`
    CREATE TABLE IF NOT EXISTS view_counts (
      pk TEXT PRIMARY KEY,             -- e.g. "product:cedar-birdhouse"
      kind TEXT NOT NULL,              -- 'product' | 'project' | 'page'
      key TEXT NOT NULL,               -- slug or page key
      total INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_view_counts_kind_key ON view_counts(kind, key);
  `);
}

export function inc(kind: Kind, key: string) {
  const k = String(key).trim();
  if (!k) return;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO view_counts (pk, kind, key, total, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(pk) DO UPDATE SET
      total = total + 1,
      updated_at = excluded.updated_at
  `).run(`${kind}:${k}`, kind, k, now);
}

export function totalForKey(kind: Kind, key: string): number {
  const k = String(key).trim();
  if (!k) return 0;
  const row = db.prepare(`SELECT total FROM view_counts WHERE pk=?`).get(`${kind}:${k}`) as { total?: number } | undefined;
  return row?.total ?? 0;
}

export function sumByKind(kind: Kind): number {
  const row = db.prepare(`SELECT COALESCE(SUM(total),0) AS n FROM view_counts WHERE kind=?`).get(kind) as { n?: number } | undefined;
  return row?.n ?? 0;
}

export function totalsForKeys(kind: Kind, keys: string[]) {
  const filtered = keys.map(String).map(s => s.trim()).filter(Boolean);
  if (filtered.length === 0) return [] as Array<{ key: string; total: number }>;

  const placeholders = filtered.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT key, total FROM view_counts WHERE kind=? AND key IN (${placeholders})`)
    .all(kind, ...filtered) as Array<{ key: string; total: number }>;

  // ensure zeroes for missing rows
  const map = Object.fromEntries(filtered.map(k => [k, 0]));
  rows.forEach(r => { map[r.key] = r.total; });
  return Object.entries(map).map(([key, total]) => ({ key, total: total as number }));
}

// ADD after your existing schema creation:
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_views (
    pk TEXT PRIMARY KEY,         -- e.g. "project:birdhouse:2025-08-26"
    kind TEXT NOT NULL,          -- 'product' | 'project' | 'page'
    key  TEXT NOT NULL,          -- slug or page key
    day  TEXT NOT NULL,          -- YYYY-MM-DD (UTC)
    total INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_daily_views_day       ON daily_views(day);
  CREATE INDEX IF NOT EXISTS idx_daily_views_kind_day  ON daily_views(kind, day);
`);

// ADD helpers:
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function incWithDaily(kind: Kind, rawKey: string, when = new Date()) {
  const key = String(rawKey).trim();
  if (!key) return;
  const nowIso = new Date().toISOString();
  const day = ymd(when);

  // increment total
  db.prepare(`
    INSERT INTO view_counts (pk, kind, key, total, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(pk) DO UPDATE SET total = total + 1, updated_at = excluded.updated_at
  `).run(`${kind}:${key}`, kind, key, nowIso);

  // increment daily bucket
  db.prepare(`
    INSERT INTO daily_views (pk, kind, key, day, total, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(pk) DO UPDATE SET total = total + 1, updated_at = excluded.updated_at
  `).run(`${kind}:${key}:${day}`, kind, key, day, nowIso);
}

export function seriesByKind(kind: Kind, startDay: string, endDay: string) {
  const rows = db.prepare(
    `SELECT day, SUM(total) AS n FROM daily_views
     WHERE kind=? AND day BETWEEN ? AND ? GROUP BY day`
  ).all(kind, startDay, endDay) as Array<{ day: string; n: number }>;

  const days: string[] = [];
  for (let d = new Date(startDay + 'T00:00:00Z'); d <= new Date(endDay + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1)) {
    days.push(ymd(d));
  }
  const map = Object.fromEntries(rows.map(r => [r.day, r.n]));
  return { days, values: days.map(d => (map[d] ?? 0)) };
}

export function seriesForKeys(kind: Kind, keys: string[], startDay: string, endDay: string) {
  const k = keys.map(s => String(s).trim()).filter(Boolean);
  if (!k.length) return { days: [], series: {} as Record<string, number[]> };

  const placeholders = k.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT key, day, total FROM daily_views
     WHERE kind=? AND key IN (${placeholders}) AND day BETWEEN ? AND ?`
  ).all(kind, ...k, startDay, endDay) as Array<{ key: string; day: string; total: number }>;

  const days: string[] = [];
  for (let d = new Date(startDay + 'T00:00:00Z'); d <= new Date(endDay + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1)) {
    days.push(ymd(d));
  }

  const byKey: Record<string, Record<string, number>> = Object.fromEntries(k.map(x => [x, {}]));
  rows.forEach(r => { byKey[r.key][r.day] = (byKey[r.key][r.day] ?? 0) + r.total; });

  const series: Record<string, number[]> = {};
  k.forEach(key => { series[key] = days.map(d => byKey[key][d] ?? 0); });
  return { days, series };
}

export function topKeysByKind(kind: Kind, limit = 10) {
  return db.prepare(
    `SELECT key, total FROM view_counts WHERE kind=? ORDER BY total DESC LIMIT ?`
  ).all(kind, limit) as Array<{ key: string; total: number }>;
}

export function topByKind(kind: 'product'|'project'|'page'|'whatson', limit = 10) {
  return db.prepare(
    `SELECT key, total 
       FROM view_counts 
      WHERE kind = ?
   ORDER BY total DESC
      LIMIT ?`
  ).all(kind, limit) as Array<{ key: string; total: number }>;
}