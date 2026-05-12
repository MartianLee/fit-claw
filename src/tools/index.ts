import type { Database } from 'bun:sqlite'
import type { Hono } from 'hono'
import { alarmsRoutes } from './alarms'
import { bodyRoutes } from './body'
import { exercisesRoutes } from './exercises'
import { predictionsRoutes } from './predictions'
import { workoutsRoutes } from './workouts'

export function mountTools(app: Hono, deps: { db: Database }) {
  app.route('/tools', exercisesRoutes(deps.db))
  app.route('/tools', workoutsRoutes(deps.db))
  app.route('/tools', bodyRoutes(deps.db))
  app.route('/tools', predictionsRoutes(deps.db))
  app.route('/tools', alarmsRoutes(deps.db))
}
