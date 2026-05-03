import type { FC } from 'hono/jsx'

export const OneRmChart: FC<{ token: string; exerciseId: number; exerciseName: string }> = ({
  token,
  exerciseId,
  exerciseName,
}) => (
  <div class="card">
    <div class="label">{exerciseName} estimated 1rm (last 180 days)</div>
    <canvas id={`onerm-${exerciseId}`} height="120"></canvas>
    <script
      dangerouslySetInnerHTML={{
        __html: `
      (async () => {
        const r = await fetch('/api/onerm-series?exercise_id=${exerciseId}&days=180', { headers: { authorization: 'Bearer ${token}' } });
        const data = await r.json();
        new Chart(document.getElementById('onerm-${exerciseId}'), {
          type: 'line',
          data: { labels: data.map(d=>d.date), datasets: [{ label: 'est 1rm', data: data.map(d=>d.est_1rm) }]},
          options: { animation: false }
        });
      })();
    `,
      }}
    />
  </div>
)
