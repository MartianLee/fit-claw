import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  createWorkoutEntry,
  deleteSet,
  logWorkout,
  queryWorkouts,
  recentWorkouts,
  updateSet,
} from '../domain/workouts'
import { zv } from '../lib/validator'

const BaseSetSchema = z.object({
  weight_kg: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  side_mode: z.enum(['none', 'each_side', 'single_side']).optional(),
  side: z.enum(['left', 'right']).optional(),
  rpe: z.number().optional(),
  rir: z.number().int().optional(),
  rest_sec: z.number().int().optional(),
  tempo: z.string().optional(),
  notes: z.string().optional(),
})

const SetSchema = BaseSetSchema.superRefine((set, ctx) => {
  if (set.side_mode === 'single_side' && !set.side) {
    ctx.addIssue({
      code: 'custom',
      path: ['side'],
      message: 'side is required when side_mode is single_side',
    })
  }
  if (set.side_mode !== 'single_side' && set.side) {
    ctx.addIssue({
      code: 'custom',
      path: ['side'],
      message: 'side is only allowed when side_mode is single_side',
    })
  }
})

export function workoutsRoutes(db: Database) {
  const routes = new Hono()

  routes.post(
    '/log_workout',
    zv(
      'json',
      z.object({
        exercise: z.string().trim().min(1),
        sets: z.array(SetSchema).min(1),
        session_id: z.number().int().optional(),
        started_at: z.string().optional(),
        ended_at: z.string().optional(),
        notes: z.string().optional(),
      }),
    ),
    (c) => c.json(logWorkout(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/create_workout_entry',
    zv(
      'json',
      z.object({
        exercise_id: z.number().int(),
        sets: z.array(SetSchema).min(1),
        session_id: z.number().int().optional(),
        started_at: z.string().optional(),
        ended_at: z.string().optional(),
        notes: z.string().optional(),
      }),
    ),
    (c) => c.json(createWorkoutEntry(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/query_workouts',
    zv(
      'json',
      z.object({
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        exercise_id: z.number().int().optional(),
      }),
    ),
    (c) => c.json(queryWorkouts(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/recent_workouts',
    zv('json', z.object({ days: z.number().int().positive().max(60).optional() })),
    (c) => c.json(recentWorkouts(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/update_set',
    zv('json', z.object({ set_id: z.number().int(), patch: BaseSetSchema.partial() })),
    (c) => {
      const { set_id, patch } = c.req.valid('json')
      return c.json(updateSet(db, set_id, patch))
    },
  )

  routes.post(
    '/delete_set',
    zv('json', z.object({ set_id: z.number().int() })),
    (c) => {
      deleteSet(db, c.req.valid('json').set_id)
      return c.json({ ok: true })
    },
  )

  routes.post(
    '/set_workout_detail_mode',
    zv('json', z.object({ mode: z.enum(['basic', 'detailed']) })),
    (c) => {
      db.run('UPDATE users SET workout_detail_mode = ? WHERE id = ?', [
        c.req.valid('json').mode,
        c.get('userId'),
      ])
      return c.json(db.query('SELECT * FROM users WHERE id = ?').get(c.get('userId')))
    },
  )

  return routes
}
