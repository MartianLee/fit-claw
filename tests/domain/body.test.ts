import { describe, expect, it } from 'bun:test'
import { logBodyMeasurement, queryBody } from '../../src/domain/body'
import { makeTestDb } from '../helpers/db'

describe('logBodyMeasurement', () => {
  it('saves only provided fields', () => {
    const db = makeTestDb()

    const measurement = logBodyMeasurement(db, { user_id: 1, weight_kg: 72.3 })

    expect(measurement.weight_kg).toBe(72.3)
    expect(measurement.smm_kg).toBeNull()
  })

  it('rejects empty submission', () => {
    const db = makeTestDb()

    expect(() => logBodyMeasurement(db, { user_id: 1 })).toThrow()
  })
})

describe('queryBody', () => {
  it('orders by measured_at desc', () => {
    const db = makeTestDb()
    logBodyMeasurement(db, {
      user_id: 1,
      weight_kg: 71,
      measured_at: '2026-04-01T00:00:00Z',
    })
    logBodyMeasurement(db, {
      user_id: 1,
      weight_kg: 72,
      measured_at: '2026-05-01T00:00:00Z',
    })

    const out = queryBody(db, { user_id: 1 })

    expect(out[0]?.weight_kg).toBe(72)
  })
})
