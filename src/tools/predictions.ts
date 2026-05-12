import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { z } from 'zod'
import { predictPerformance, predictSeries, refitPredictionModels } from '../domain/predictions'
import { zv } from '../lib/validator'

export function predictionsRoutes(db: Database) {
  const routes = new Hono()

  routes.post(
    '/predict_performance',
    zv(
      'json',
      z.object({
        exercise_id: z.number().int().positive(),
        target_date: z.string().min(10),
      }),
    ),
    (c) => c.json(predictPerformance(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/predict_series',
    zv(
      'json',
      z.object({
        exercise_id: z.number().int().positive(),
        until_date: z.string().min(10),
      }),
    ),
    (c) => c.json(predictSeries(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/refit_prediction_models',
    zv('json', z.object({ user_id: z.number().int().positive().optional() })),
    (c) => {
      const body = c.req.valid('json')
      const models = refitPredictionModels(db, { user_id: body.user_id ?? c.get('userId') })
      return c.json({ count: models.length, models })
    },
  )

  return routes
}
