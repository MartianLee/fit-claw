import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { z } from 'zod'
import { queryBody } from '../domain/body'
import { oneRmDailySeries } from '../domain/stats'
import { zv } from '../lib/validator'

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

export function webApiRoutes(db: Database) {
  const routes = new Hono()

  routes.get('/api/summary', (c) => {
    const userId = c.get('userId')
    const latest = db
      .query('SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1')
      .get(userId) as { weight_kg: number | null; smm_kg: number | null; pbf_pct: number | null } | null
    const last7 = db
      .query(
        `SELECT COUNT(DISTINCT substr(started_at, 1, 10)) AS n
         FROM workout_sessions
         WHERE user_id = ? AND substr(started_at, 1, 10) >= ?`,
      )
      .get(userId, isoDateDaysAgo(7)) as { n: number }

    return c.json({
      weight_kg: latest?.weight_kg ?? null,
      smm_kg: latest?.smm_kg ?? null,
      pbf_pct: latest?.pbf_pct ?? null,
      sessions_last_7d: last7.n,
    })
  })

  routes.get(
    '/api/body-series',
    zv('query', z.object({ days: z.coerce.number().int().positive().max(365).default(180) })),
    (c) => {
      const days = c.req.valid('query').days
      const rows = queryBody(db, {
        user_id: c.get('userId'),
        date_from: new Date(Date.now() - days * 86_400_000).toISOString(),
      })
      return c.json(
        rows.map((row) => ({
          date: row.measured_at.slice(0, 10),
          weight_kg: row.weight_kg,
          smm_kg: row.smm_kg,
          pbf_pct: row.pbf_pct,
        })),
      )
    },
  )

  routes.get(
    '/api/onerm-series',
    zv(
      'query',
      z.object({
        exercise_id: z.coerce.number().int(),
        days: z.coerce.number().int().positive().max(730).default(180),
      }),
    ),
    (c) => {
      const { exercise_id, days } = c.req.valid('query')
      return c.json(
        oneRmDailySeries(db, {
          user_id: c.get('userId'),
          exercise_id,
          date_from: new Date(Date.now() - days * 86_400_000).toISOString(),
        }),
      )
    },
  )

  routes.get(
    '/api/calendar',
    zv('query', z.object({ weeks: z.coerce.number().int().positive().max(52).default(12) })),
    (c) => {
      const weeks = c.req.valid('query').weeks
      const rows = db
        .query(
          `SELECT substr(s.started_at, 1, 10) AS date,
                  COALESCE(SUM(ws.weight_kg * ws.reps * CASE WHEN ws.side_mode = 'each_side' THEN 2 ELSE 1 END), 0) AS volume
           FROM workout_sessions s
           LEFT JOIN workout_entries e ON e.session_id = s.id
           LEFT JOIN workout_sets ws ON ws.entry_id = e.id
           WHERE s.user_id = ? AND substr(s.started_at, 1, 10) >= ?
           GROUP BY substr(s.started_at, 1, 10)
           ORDER BY date`,
        )
        .all(c.get('userId'), isoDateDaysAgo(weeks * 7))
      return c.json(rows)
    },
  )

  routes.get('/api/recent-activity', (c) => {
    const rows = db
      .query(
        `SELECT s.id AS session_id, s.started_at, e.id AS entry_id, ex.canonical_name AS exercise,
                ws.set_number, ws.weight_kg, ws.reps
         FROM workout_sessions s
         JOIN workout_entries e ON e.session_id = s.id
         JOIN exercises ex ON ex.id = e.exercise_id
         JOIN workout_sets ws ON ws.entry_id = e.id
         WHERE s.user_id = ? AND substr(s.started_at, 1, 10) >= ?
         ORDER BY s.started_at DESC, e.sequence, ws.set_number`,
      )
      .all(c.get('userId'), isoDateDaysAgo(7))
    return c.json(rows)
  })

  return routes
}
