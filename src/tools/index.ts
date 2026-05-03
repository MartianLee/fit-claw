import type { Database } from 'bun:sqlite'
import type { Hono } from 'hono'
import { bodyRoutes } from './body'
import { exercisesRoutes } from './exercises'
import { workoutsRoutes } from './workouts'

export function mountTools(app: Hono, deps: { db: Database }) {
  app.route('/tools', exercisesRoutes(deps.db))
  app.route('/tools', workoutsRoutes(deps.db))
  app.route('/tools', bodyRoutes(deps.db))
}
