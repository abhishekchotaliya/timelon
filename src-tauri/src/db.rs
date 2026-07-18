//! The single persistence path. Writes go through `log_session`; stats reads
//! go through `query_daily`. All grouping is by local calendar `day`.

use std::path::PathBuf;

use chrono::Local;
use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::timer::SessionLog;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phase         TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  planned_secs  INTEGER NOT NULL,
  actual_secs   INTEGER NOT NULL,
  completed     INTEGER NOT NULL,
  day           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_day   ON sessions(day);
CREATE INDEX IF NOT EXISTS idx_sessions_phase ON sessions(phase);
"#;

/// Per-day aggregate returned by `stats_daily`. Mirrors `DayStat` in types.ts.
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DayStat {
    pub day: String,
    pub focus_min: f64,
    pub break_min: f64,
    pub long_break_min: f64,
    pub sessions: i64,
    pub breaks: i64,
}

pub async fn init_db(db_path: PathBuf) -> Result<SqlitePool, sqlx::Error> {
    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(opts)
        .await?;

    sqlx::raw_sql(SCHEMA).execute(&pool).await?;
    Ok(pool)
}

pub async fn log_session(pool: &SqlitePool, log: &SessionLog) -> Result<(), sqlx::Error> {
    // `day` is the local calendar date of when the phase ended.
    let day = log.ended_at.with_timezone(&Local).format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO sessions
           (phase, started_at, ended_at, planned_secs, actual_secs, completed, day)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(log.phase.as_str())
    .bind(log.started_at.to_rfc3339())
    .bind(log.ended_at.to_rfc3339())
    .bind(log.planned_secs as i64)
    .bind(log.actual_secs as i64)
    .bind(i64::from(log.completed))
    .bind(day)
    .execute(pool)
    .await?;

    Ok(())
}

/// Daily focus minutes, completed focus sessions, and break count for a date
/// range (inclusive). Weekly/monthly buckets and streaks are derived in JS.
pub async fn query_daily(
    pool: &SqlitePool,
    start_day: &str,
    end_day: &str,
) -> Result<Vec<DayStat>, sqlx::Error> {
    sqlx::query_as::<_, DayStat>(
        "SELECT day,
                COALESCE(SUM(CASE WHEN phase='focus' THEN actual_secs ELSE 0 END), 0) / 60.0 AS focus_min,
                COALESCE(SUM(CASE WHEN phase='short_break' THEN actual_secs ELSE 0 END), 0) / 60.0 AS break_min,
                COALESCE(SUM(CASE WHEN phase='long_break' THEN actual_secs ELSE 0 END), 0) / 60.0 AS long_break_min,
                COALESCE(SUM(CASE WHEN phase='focus' AND completed=1 THEN 1 ELSE 0 END), 0) AS sessions,
                COALESCE(SUM(CASE WHEN phase LIKE '%break%' THEN 1 ELSE 0 END), 0) AS breaks
         FROM sessions
         WHERE day BETWEEN ?1 AND ?2
         GROUP BY day
         ORDER BY day",
    )
    .bind(start_day)
    .bind(end_day)
    .fetch_all(pool)
    .await
}

/// Oldest logged calendar day (`YYYY-MM-DD`), or `None` if no sessions exist.
/// Used by the UI to bound how far back period navigation can go.
pub async fn query_first_day(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    let row: (Option<String>,) = sqlx::query_as("SELECT MIN(day) FROM sessions")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}
