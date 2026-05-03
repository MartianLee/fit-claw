import type { FC } from 'hono/jsx'

const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c')

export const OneRmChart: FC<{ exerciseId: number; exerciseName: string }> = ({
  exerciseId,
  exerciseName,
}) => {
  const canvasId = `onerm-${exerciseId}`
  const cfgId = `onerm-cfg-${exerciseId}`
  const cfg = safeJson({ exerciseId, canvasId })
  return (
    <div class="card">
      <div class="caption">{exerciseName} · estimated 1rm</div>
      <canvas id={canvasId} height="120"></canvas>
      <script id={cfgId} type="application/json" dangerouslySetInnerHTML={{ __html: cfg }} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
        (async () => {
          const cfg = JSON.parse(document.getElementById(${JSON.stringify(cfgId)}).textContent);
          const r = await fetch('/api/onerm-series?exercise_id=' + cfg.exerciseId + '&days=180', { credentials: 'same-origin' });
          const el = document.getElementById(cfg.canvasId);
          if (!r.ok) { el.replaceWith(Object.assign(document.createElement('div'), { textContent: 'load failed', style: 'color:#8a8170;font-family:JetBrains Mono,monospace;font-size:11px;padding:32px;text-align:center;font-weight:700;letter-spacing:0.1em;text-transform:uppercase' })); return; }
          const data = await r.json();
          if (!Array.isArray(data) || data.length === 0) { el.replaceWith(Object.assign(document.createElement('div'), { textContent: 'no data yet', style: 'color:#8a8170;font-family:Fraunces,serif;font-style:italic;font-size:18px;padding:32px;text-align:center' })); return; }
          new Chart(el, {
            type: 'line',
            data: { labels: data.map(d=>d.date), datasets: [{
              label: 'est 1rm (kg)',
              data: data.map(d=>d.est_1rm),
              borderColor: '#e8421e',
              backgroundColor: 'rgba(232,66,30,0.18)',
              borderWidth: 2.5,
              pointRadius: 3,
              pointBackgroundColor: '#110e08',
              pointBorderColor: '#fffaf0',
              pointBorderWidth: 1.5,
              pointHoverRadius: 5,
              tension: 0.25,
              fill: true,
            }]},
            options: {
              animation: { duration: 700 },
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#110e08', borderColor: '#110e08', borderWidth: 2, titleColor: '#fffaf0', bodyColor: '#fffaf0', padding: 12, cornerRadius: 0, displayColors: false, titleFont: { weight: '700' }, bodyFont: { weight: '500' } }
              },
              scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 9, weight: '700' }, color: '#3a342a' }, border: { color: '#110e08', width: 2 } },
                y: { grid: { color: 'rgba(17,14,8,0.08)' }, ticks: { font: { size: 9, weight: '700' }, color: '#3a342a' }, border: { display: false } }
              }
            }
          });
        })();
      `,
        }}
      />
    </div>
  )
}
