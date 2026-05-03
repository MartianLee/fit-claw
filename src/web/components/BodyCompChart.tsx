import type { FC } from 'hono/jsx'

export const BodyCompChart: FC<{ token: string }> = ({ token }) => (
  <div class="card">
    <div class="label">body composition (last 180 days)</div>
    <canvas id="body-chart" height="120"></canvas>
    <script
      dangerouslySetInnerHTML={{
        __html: `
      (async () => {
        const r = await fetch('/api/body-series?days=180', { headers: { authorization: 'Bearer ${token}' } });
        const data = await r.json();
        const labels = data.map(d => d.date);
        new Chart(document.getElementById('body-chart'), {
          type: 'line',
          data: { labels, datasets: [
            { label: 'weight (kg)', data: data.map(d=>d.weight_kg), spanGaps: true },
            { label: 'smm (kg)', data: data.map(d=>d.smm_kg), spanGaps: true },
            { label: 'pbf (%)', data: data.map(d=>d.pbf_pct), spanGaps: true, yAxisID: 'pct' },
          ]},
          options: { animation: false, scales: { pct: { position: 'right', beginAtZero: false } } }
        });
      })();
    `,
      }}
    />
  </div>
)
