import type { Database } from 'bun:sqlite'

export function epley1Rm(weight_kg: number, reps: number): number {
  if (weight_kg <= 0 || reps <= 0) return 0
  return weight_kg * (1 + reps / 30)
}

export type OneRmPoint = { date: string; est_1rm: number }

export function oneRmDailySeries(
  db: Database,
  query: { user_id: number; exercise_id: number; date_from?: string; date_to?: string },
): OneRmPoint[] {
  const rows = db
    .query(
      `SELECT substr(s.started_at, 1, 10) AS date, ws.weight_kg AS weight, ws.reps AS reps
       FROM workout_sets ws
       JOIN workout_entries e ON e.id = ws.entry_id
       JOIN workout_sessions s ON s.id = e.session_id
       WHERE s.user_id = ?
         AND e.exercise_id = ?
         AND (? IS NULL OR s.started_at >= ?)
         AND (? IS NULL OR s.started_at <= ?)`,
    )
    .all(
      query.user_id,
      query.exercise_id,
      query.date_from ?? null,
      query.date_from ?? null,
      query.date_to ?? null,
      query.date_to ?? null,
    ) as { date: string; weight: number; reps: number }[]

  const dailyMax = new Map<string, number>()
  for (const row of rows) {
    const estimate = epley1Rm(row.weight, row.reps)
    const current = dailyMax.get(row.date) ?? 0
    if (estimate > current) dailyMax.set(row.date, estimate)
  }

  return Array.from(dailyMax.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, est_1rm]) => ({ date, est_1rm }))
}
