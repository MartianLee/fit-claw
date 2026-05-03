import type { FC } from 'hono/jsx'

export const BodyCompChart: FC = () => (
  <div class="card">
    <div class="caption">weight · smm · pbf</div>
    <canvas id="body-chart" height="120"></canvas>
    <script
      dangerouslySetInnerHTML={{
        __html: `
        (async () => {
          const r = await fetch('/api/body-series?days=180', { credentials: 'same-origin' });
          if (!r.ok) { document.getElementById('body-chart').replaceWith(Object.assign(document.createElement('div'), { textContent: 'load failed', style: 'color:#8a8170;font-family:JetBrains Mono,monospace;font-size:11px;padding:32px;text-align:center;font-weight:700;letter-spacing:0.1em;text-transform:uppercase' })); return; }
          const data = await r.json();
          if (!Array.isArray(data) || data.length === 0) { document.getElementById('body-chart').replaceWith(Object.assign(document.createElement('div'), { textContent: 'no data yet', style: 'color:#8a8170;font-family:Fraunces,serif;font-style:italic;font-size:18px;padding:32px;text-align:center' })); return; }
          const labels = data.map(d => d.date);
          Chart.defaults.color = '#3a342a';
          Chart.defaults.font.family = "'JetBrains Mono', ui-monospace, monospace";
          Chart.defaults.font.size = 10;
          Chart.defaults.font.weight = '500';
          new Chart(document.getElementById('body-chart'), {
            type: 'line',
            data: { labels, datasets: [
              { label: 'weight (kg)', data: data.map(d=>d.weight_kg), spanGaps: true, borderColor: '#e8421e', backgroundColor: 'rgba(232,66,30,0.12)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true },
              { label: 'smm (kg)', data: data.map(d=>d.smm_kg), spanGaps: true, borderColor: '#1e3a8a', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3 },
              { label: 'pbf (%)', data: data.map(d=>d.pbf_pct), spanGaps: true, borderColor: '#2f6b2a', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, borderDash: [4,4], yAxisID: 'pct' },
            ]},
            options: {
              animation: { duration: 700, easing: 'easeOutCubic' },
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 3, padding: 16, font: { size: 10, weight: '700' }, color: '#110e08' } },
                tooltip: { backgroundColor: '#110e08', borderColor: '#110e08', borderWidth: 2, titleColor: '#fffaf0', bodyColor: '#fffaf0', padding: 12, cornerRadius: 0, displayColors: true, titleFont: { weight: '700' }, bodyFont: { weight: '500' } }
              },
              scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 9, weight: '700' }, color: '#3a342a' }, border: { color: '#110e08', width: 2 } },
                y: { grid: { color: 'rgba(17,14,8,0.08)' }, ticks: { font: { size: 9, weight: '700' }, color: '#3a342a' }, border: { display: false } },
                pct: { position: 'right', beginAtZero: false, grid: { display: false }, ticks: { font: { size: 9, weight: '700' }, color: '#2f6b2a' }, border: { display: false } }
              }
            }
          });
        })();
      `,
      }}
    />
  </div>
)
