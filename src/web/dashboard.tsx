import type { Database } from 'bun:sqlite'
import { ActivityList } from './components/ActivityList'
import { BodyCompChart } from './components/BodyCompChart'
import { CalendarHeatmap } from './components/CalendarHeatmap'
import { OneRmChart } from './components/OneRmChart'
import { StatCard } from './components/StatCard'
import { Layout } from './layout'

export type DashboardData = {
  summary: {
    weight_kg: number | null
    smm_kg: number | null
    pbf_pct: number | null
    sessions_last_7d: number
  }
  featuredExercise?: { id: number; name: string }
  token: string
}

export function renderDashboard(db: Database, userId: number, token: string) {
  const summary = db
    .query(
      `SELECT
         (SELECT weight_kg FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1) AS weight_kg,
         (SELECT smm_kg FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1) AS smm_kg,
         (SELECT pbf_pct FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1) AS pbf_pct,
         (SELECT COUNT(DISTINCT substr(started_at, 1, 10)) FROM workout_sessions WHERE user_id = ? AND started_at >= datetime('now', '-7 days')) AS sessions_last_7d`,
    )
    .get(userId, userId, userId, userId) as DashboardData['summary']
  const featured = db
    .query(
      `SELECT e.id, e.canonical_name AS name
       FROM workout_entries we
       JOIN exercises e ON e.id = we.exercise_id
       JOIN workout_sessions s ON s.id = we.session_id
       WHERE s.user_id = ?
       GROUP BY e.id
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
    )
    .get(userId) as { id: number; name: string } | null

  return (
    <Layout title="fit-claw">
      <h1>fit-claw</h1>
      <div class="grid cards">
        <StatCard label="weight" value={summary.weight_kg ?? '-'} unit="kg" />
        <StatCard label="smm" value={summary.smm_kg ?? '-'} unit="kg" />
        <StatCard label="pbf" value={summary.pbf_pct ?? '-'} unit="%" />
        <StatCard label="sessions / 7d" value={summary.sessions_last_7d} />
      </div>
      <div class="grid" style="margin-top:16px;">
        <BodyCompChart token={token} />
        {featured ? (
          <OneRmChart token={token} exerciseId={featured.id} exerciseName={featured.name} />
        ) : null}
        <CalendarHeatmap token={token} />
        <ActivityList token={token} />
      </div>
    </Layout>
  )
}
