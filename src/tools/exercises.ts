import { zValidator } from '@hono/zod-validator'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { z } from 'zod'
import { confirmNewExercise, findOrProposeExercise } from '../domain/exercises'

export function exercisesRoutes(db: Database) {
  const routes = new Hono()

  routes.post(
    '/find_or_propose_exercise',
    zValidator('json', z.object({ query: z.string().min(1) })),
    (c) => c.json(findOrProposeExercise(db, c.req.valid('json').query)),
  )

  routes.post(
    '/confirm_new_exercise',
    zValidator(
      'json',
      z.object({
        canonical_name: z.string().min(1),
        body_part: z.string().min(1),
        equipment: z.string().min(1),
        is_bodyweight: z.boolean().optional(),
        aliases: z.array(z.string()).optional(),
      }),
    ),
    (c) => c.json(confirmNewExercise(db, c.req.valid('json'))),
  )

  return routes
}
