import type { FC } from 'hono/jsx'

export const StatCard: FC<{ label: string; value: string | number; unit?: string }> = ({
  label,
  value,
  unit,
}) => (
  <div class="card">
    <div class="label">{label}</div>
    <div class="stat">
      {value}
      {unit ? <span style="font-size:14px; color:#8a93a0;"> {unit}</span> : null}
    </div>
  </div>
)
