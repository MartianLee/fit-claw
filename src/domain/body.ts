import type { Database } from 'bun:sqlite'

export type BodyMeasurement = {
  id: number
  user_id: number
  measured_at: string
  weight_kg: number | null
  smm_kg: number | null
  pbf_pct: number | null
  bmi: number | null
  source: 'manual' | 'inbody_ocr' | 'healthkit'
}

export type LogBodyInput = {
  user_id: number
  measured_at?: string
  weight_kg?: number
  smm_kg?: number
  pbf_pct?: number
  bmi?: number
  source?: 'manual' | 'inbody_ocr' | 'healthkit'
}

export function logBodyMeasurement(db: Database, input: LogBodyInput): BodyMeasurement {
  const hasValue = [input.weight_kg, input.smm_kg, input.pbf_pct, input.bmi].some(
    (value) => value !== undefined,
  )
  if (!hasValue) throw new Error('at least one of weight_kg/smm_kg/pbf_pct/bmi required')

  const measuredAt = input.measured_at ?? new Date().toISOString()
  const result = db.run(
    'INSERT INTO body_measurements(user_id, measured_at, weight_kg, smm_kg, pbf_pct, bmi, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      input.user_id,
      measuredAt,
      input.weight_kg ?? null,
      input.smm_kg ?? null,
      input.pbf_pct ?? null,
      input.bmi ?? null,
      input.source ?? 'manual',
    ],
  )

  return db
    .query('SELECT * FROM body_measurements WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as BodyMeasurement
}

export function queryBody(
  db: Database,
  query: { user_id: number; date_from?: string; date_to?: string },
): BodyMeasurement[] {
  return db
    .query(
      `SELECT * FROM body_measurements
       WHERE user_id = ?
         AND (? IS NULL OR measured_at >= ?)
         AND (? IS NULL OR measured_at <= ?)
       ORDER BY measured_at DESC`,
    )
    .all(
      query.user_id,
      query.date_from ?? null,
      query.date_from ?? null,
      query.date_to ?? null,
      query.date_to ?? null,
    ) as BodyMeasurement[]
}
