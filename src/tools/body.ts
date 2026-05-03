import { zValidator } from '@hono/zod-validator'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { z } from 'zod'
import { logBodyMeasurement, queryBody } from '../domain/body'

export function bodyRoutes(db: Database) {
  const routes = new Hono()

  routes.post(
    '/log_body_measurement',
    zValidator(
      'json',
      z.object({
        weight_kg: z.number().positive().optional(),
        smm_kg: z.number().positive().optional(),
        pbf_pct: z.number().min(0).max(100).optional(),
        bmi: z.number().positive().optional(),
        measured_at: z.string().optional(),
        source: z.enum(['manual', 'inbody_ocr', 'healthkit']).optional(),
      }),
    ),
    (c) => c.json(logBodyMeasurement(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post(
    '/query_body',
    zValidator('json', z.object({ date_from: z.string().optional(), date_to: z.string().optional() })),
    (c) => c.json(queryBody(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  return routes
}
