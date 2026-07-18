// Stats derivation: pick a period (week/month/year) anchored on a date, fetch
// that window's daily rows from Rust, then bucket into a chart series + compute
// summary totals. The all-time pie and the current focus streak come from a
// separate all-time query so they don't depend on the viewed window.

import type { DayStat } from "../types";
import { statsDaily } from "./ipc";

export type Period = "week" | "month" | "year";

export type Bucket = {
  key: string;
  label: string;
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  sessions: number;
  breaks: number;
};

export type Totals = {
  focusHours: number;
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  sessions: number;
  breaks: number;
  streak: number;
};

// All-time minutes per phase, for the pie chart.
export type PieData = { focus: number; shortBreak: number; longBreak: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

// Monday-based start of the week containing `d`.
function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // Mon=0..Sun=6
  r.setDate(r.getDate() - dow);
  return r;
}

// Inclusive [start, end] Date range covering the period that contains `anchor`.
export function periodRange(period: Period, anchor: Date): { start: Date; end: Date } {
  if (period === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }
  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start, end };
  }
  return {
    start: new Date(anchor.getFullYear(), 0, 1),
    end: new Date(anchor.getFullYear(), 11, 31),
  };
}

// Human label for the currently viewed period.
export function periodLabel(period: Period, anchor: Date): string {
  if (period === "year") return String(anchor.getFullYear());
  if (period === "month") return `${MONTHS_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const { start, end } = periodRange("week", anchor);
  const left = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const right =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${left} – ${right}, ${end.getFullYear()}`;
}

// Move the anchor one period back (dir=-1) or forward (dir=1). Normalized to the
// period start so month/year steps never overflow (e.g. Jan 31 + 1 month).
export function shiftAnchor(period: Period, anchor: Date, dir: 1 | -1): Date {
  if (period === "week") {
    const r = new Date(anchor);
    r.setDate(r.getDate() + 7 * dir);
    return r;
  }
  if (period === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return new Date(anchor.getFullYear() + dir, 0, 1);
}

// Can't go earlier than the oldest logged day.
export function canGoPrev(period: Period, anchor: Date, firstDay: string | null): boolean {
  if (!firstDay) return false;
  return toLocalDay(periodRange(period, anchor).start) > firstDay;
}

// Can't step into a period that hasn't started yet.
export function canGoNext(period: Period, anchor: Date): boolean {
  return toLocalDay(periodRange(period, anchor).end) < toLocalDay(new Date());
}

function emptyBucket(key: string, label: string): Bucket {
  return { key, label, focusMin: 0, breakMin: 0, longBreakMin: 0, sessions: 0, breaks: 0 };
}

function add(b: Bucket, row: DayStat) {
  b.focusMin += row.focusMin;
  b.breakMin += row.breakMin;
  b.longBreakMin += row.longBreakMin;
  b.sessions += row.sessions;
  b.breaks += row.breaks;
}

// One bucket per day across [start, end].
function dailyBuckets(
  rows: DayStat[],
  start: Date,
  end: Date,
  labelOf: (d: Date) => string,
): Bucket[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const buckets: Bucket[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = toLocalDay(cur);
    const b = emptyBucket(key, labelOf(cur));
    const row = byDay.get(key);
    if (row) add(b, row);
    buckets.push(b);
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

// All 12 months of `year`, empty months included.
function monthlyBuckets(rows: DayStat[], year: number): Bucket[] {
  const buckets = MONTHS.map((m, i) =>
    emptyBucket(`${year}-${String(i + 1).padStart(2, "0")}`, m),
  );
  for (const row of rows) {
    const d = parseDay(row.day);
    if (d.getFullYear() === year) add(buckets[d.getMonth()], row);
  }
  return buckets;
}

function bucketsFor(period: Period, rows: DayStat[], anchor: Date): Bucket[] {
  const { start, end } = periodRange(period, anchor);
  if (period === "week") return dailyBuckets(rows, start, end, (d) => WEEKDAYS[d.getDay()]);
  if (period === "month") return dailyBuckets(rows, start, end, (d) => String(d.getDate()));
  return monthlyBuckets(rows, anchor.getFullYear());
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

export type StatsResult = { buckets: Bucket[]; totals: Totals; pie: PieData };

export async function loadStats(period: Period, anchor: Date): Promise<StatsResult> {
  const { start, end } = periodRange(period, anchor);
  const rows = await statsDaily(toLocalDay(start), toLocalDay(end));
  const buckets = bucketsFor(period, rows, anchor);

  const focusMin = rows.reduce((sum, r) => sum + r.focusMin, 0);
  const breakMin = rows.reduce((sum, r) => sum + r.breakMin, 0);
  const longBreakMin = rows.reduce((sum, r) => sum + r.longBreakMin, 0);
  const sessions = rows.reduce((sum, r) => sum + r.sessions, 0);
  const breaks = rows.reduce((sum, r) => sum + r.breaks, 0);

  // All-time query drives the pie and the current streak, independent of the
  // viewed period.
  const allRows = await statsDaily("1970-01-01", toLocalDay(new Date()));
  const pie: PieData = {
    focus: allRows.reduce((s, r) => s + r.focusMin, 0),
    shortBreak: allRows.reduce((s, r) => s + r.breakMin, 0),
    longBreak: allRows.reduce((s, r) => s + r.longBreakMin, 0),
  };

  return {
    buckets,
    totals: {
      focusHours: focusMin / 60,
      focusMin,
      breakMin,
      longBreakMin,
      sessions,
      breaks,
      streak: computeStreak(allRows),
    },
    pie,
  };
}
