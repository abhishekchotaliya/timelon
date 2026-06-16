// Stats derivation: fetch daily rows from Rust, then bucket into daily/weekly/
// monthly series and compute summary totals + the current focus streak in JS.

import type { DayStat } from "../types";
import { statsDaily } from "./ipc";

export type Period = "daily" | "weekly" | "monthly";

export type Bucket = {
  key: string;
  label: string;
  focusMin: number;
  sessions: number;
  breaks: number;
};

export type Totals = {
  focusHours: number;
  sessions: number;
  breaks: number;
  streak: number;
};

export function toLocalDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoWeek(d: Date): { year: number; week: number } {
  // Shift the date to the Thursday of its ISO week, then count weeks from the
  // first Thursday of that year.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: date.getUTCFullYear(), week };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/// Inclusive date range to fetch for a given period view.
export function rangeForPeriod(period: Period, now = new Date()): { start: string; end: string } {
  const start = new Date(now);
  if (period === "daily") start.setDate(start.getDate() - 13); // last 14 days
  else if (period === "weekly") start.setDate(start.getDate() - 7 * 11); // ~12 weeks
  else start.setMonth(start.getMonth() - 11); // last 12 months
  return { start: toLocalDay(start), end: toLocalDay(now) };
}

function emptyBucket(key: string, label: string): Bucket {
  return { key, label, focusMin: 0, sessions: 0, breaks: 0 };
}

function add(b: Bucket, row: DayStat) {
  b.focusMin += row.focusMin;
  b.sessions += row.sessions;
  b.breaks += row.breaks;
}

function dailyBuckets(rows: DayStat[], start: string, end: string): Bucket[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const buckets: Bucket[] = [];
  const cur = parseDay(start);
  const last = parseDay(end);
  while (cur <= last) {
    const key = toLocalDay(cur);
    const b = emptyBucket(key, `${cur.getMonth() + 1}/${cur.getDate()}`);
    const row = byDay.get(key);
    if (row) add(b, row);
    buckets.push(b);
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

function groupBuckets(
  rows: DayStat[],
  keyOf: (d: Date) => string,
  labelOf: (d: Date) => string,
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const d = parseDay(row.day);
    const key = keyOf(d);
    let b = map.get(key);
    if (!b) {
      b = emptyBucket(key, labelOf(d));
      map.set(key, b);
    }
    add(b, row);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

function bucketsFor(period: Period, rows: DayStat[], start: string, end: string): Bucket[] {
  if (period === "daily") return dailyBuckets(rows, start, end);
  if (period === "weekly") {
    return groupBuckets(
      rows,
      (d) => {
        const { year, week } = isoWeek(d);
        return `${year}-W${String(week).padStart(2, "0")}`;
      },
      (d) => `W${isoWeek(d).week}`,
    );
  }
  return groupBuckets(
    rows,
    (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    (d) => MONTHS[d.getMonth()],
  );
}

function computeStreak(rows: DayStat[]): number {
  const active = new Set(rows.filter((r) => r.sessions > 0).map((r) => r.day));
  let streak = 0;
  const cur = new Date();
  // Allow today to be empty without breaking a streak that ended yesterday.
  if (!active.has(toLocalDay(cur))) cur.setDate(cur.getDate() - 1);
  while (active.has(toLocalDay(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export type StatsResult = { buckets: Bucket[]; totals: Totals };

export async function loadStats(period: Period): Promise<StatsResult> {
  const { start, end } = rangeForPeriod(period);
  const rows = await statsDaily(start, end);
  const buckets = bucketsFor(period, rows, start, end);

  const focusMin = rows.reduce((sum, r) => sum + r.focusMin, 0);
  const sessions = rows.reduce((sum, r) => sum + r.sessions, 0);
  const breaks = rows.reduce((sum, r) => sum + r.breaks, 0);

  return {
    buckets,
    totals: {
      focusHours: focusMin / 60,
      sessions,
      breaks,
      streak: computeStreak(rows),
    },
  };
}
