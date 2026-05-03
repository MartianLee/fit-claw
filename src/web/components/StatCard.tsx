import type { FC } from 'hono/jsx'

export const StatCard: FC<{ label: string; value: string | number | null; unit?: string }> = ({
  label,
  value,
  unit,
}) => {
  const empty = value == null || value === ''
  return (
    <div class="stat">
      <div class="label">{label}</div>
      <div class="value">
        {empty ? <span class="empty">—</span> : value}
        {!empty && unit ? <span class="unit">{unit}</span> : null}
      </div>
    </div>
  )
}
