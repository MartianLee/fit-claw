import type { Database } from 'bun:sqlite'
import { HttpError } from '../lib/http'
import { ActivityList } from './components/ActivityList'
import { BodyCompChart } from './components/BodyCompChart'
import { CalendarHeatmap } from './components/CalendarHeatmap'
import { OneRmChart } from './components/OneRmChart'
import { StatCard } from './components/StatCard'
import { Layout } from './layout'

type Summary = {
  weight_kg: number | null
  smm_kg: number | null
  pbf_pct: number | null
  sessions_last_7d: number
}

function fmtNum(v: number | null, digits = 1): string | null {
  if (v == null) return null
  return v.toFixed(digits).replace(/\.0$/, '')
}

function loadSummary(db: Database, userId: number): Summary {
  const latest = db
    .query(
      'SELECT weight_kg, smm_kg, pbf_pct FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1',
    )
    .get(userId) as { weight_kg: number | null; smm_kg: number | null; pbf_pct: number | null } | null
  const sessions = db
    .query(
      `SELECT COUNT(DISTINCT substr(started_at, 1, 10)) AS n
       FROM workout_sessions
       WHERE user_id = ? AND substr(started_at, 1, 10) >= ?`,
    )
    .get(userId, new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)) as { n: number }

  return {
    weight_kg: latest?.weight_kg ?? null,
    smm_kg: latest?.smm_kg ?? null,
    pbf_pct: latest?.pbf_pct ?? null,
    sessions_last_7d: sessions.n,
  }
}

export function renderDashboard(db: Database, userId: number) {
  if (!userId) throw new HttpError(401, 'unauthorized', 'no user in session')

  const summary = loadSummary(db, userId)
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

  const today = new Date().toISOString().slice(0, 10)
  const weight = fmtNum(summary.weight_kg)
  const smm = fmtNum(summary.smm_kg)
  const pbf = fmtNum(summary.pbf_pct)

  return (
    <Layout title="fit-claw">
      <header class="masthead reveal r1">
        <div class="brand">
          fit<em>·</em>claw
        </div>
        <div class="meta">
          <span class="accent">{today}</span>
          <br />a daily ledger
        </div>
      </header>

      <section class="reveal r2">
        <div class="hero">
          <div class="stat primary">
            <div class="label">weight · 체중</div>
            <div class="value">
              {weight ?? <span class="empty">—</span>}
              {weight ? <span class="unit">kg</span> : null}
            </div>
            <div class="sub">latest measurement</div>
          </div>
          <StatCard label="skeletal muscle" value={smm} unit="kg" />
          <StatCard label="body fat" value={pbf} unit="%" />
          <StatCard label="sessions / 7d" value={summary.sessions_last_7d} />
        </div>
      </section>

      <section class="section reveal r3">
        <div class="section-head">
          <span class="num">01</span>
          <span class="title">
            body composition <em>· 신체 추이</em>
          </span>
          <span class="aside">180 days</span>
        </div>
        <BodyCompChart />
      </section>

      {featured ? (
        <section class="section reveal r4">
          <div class="section-head">
            <span class="num">02</span>
            <span class="title">
              estimated 1rm <em>· {featured.name}</em>
            </span>
            <span class="aside">epley</span>
          </div>
          <OneRmChart exerciseId={featured.id} exerciseName={featured.name} />
        </section>
      ) : null}

      <section class="section reveal r4">
        <div class="section-head">
          <span class="num">{featured ? '03' : '02'}</span>
          <span class="title">
            cadence <em>· 운동 빈도</em>
          </span>
          <span class="aside">12 weeks</span>
        </div>
        <CalendarHeatmap />
      </section>

      <section class="section reveal r5">
        <div class="section-head">
          <span class="num">{featured ? '04' : '03'}</span>
          <span class="title">
            recent activity <em>· 최근 기록</em>
          </span>
          <span class="aside">7 days</span>
        </div>
        <ActivityList />
      </section>

      <footer class="colophon">fit·claw — self-hosted · single user · made with care</footer>
    </Layout>
  )
}
