import type { FC } from 'hono/jsx'

export const CalendarHeatmap: FC<{ token: string }> = ({ token }) => (
  <div class="card">
    <div class="label">workout days (last 12 weeks)</div>
    <div id="heatmap" class="heatmap"></div>
    <script
      dangerouslySetInnerHTML={{
        __html: `
      (async () => {
        const r = await fetch('/api/calendar?weeks=12', { headers: { authorization: 'Bearer ${token}' } });
        const data = await r.json();
        const byDate = new Map(data.map(x => [x.date, x.volume]));
        const max = Math.max(1, ...data.map(x => x.volume));
        const root = document.getElementById('heatmap');
        const start = new Date(); start.setDate(start.getDate() - 12 * 7 + 1);
        for (let i = 0; i < 12 * 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          const v = byDate.get(key) ?? 0;
          const cell = document.createElement('div');
          if (v > 0) {
            const t = Math.min(1, v / max);
            cell.style.background = 'hsl(150 70% ' + (15 + 35 * t) + '%)';
          }
          cell.title = key + ': ' + v + ' kg.rep';
          root.appendChild(cell);
        }
      })();
    `,
      }}
    />
  </div>
)
