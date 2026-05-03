import type { FC } from 'hono/jsx'

export const CalendarHeatmap: FC = () => (
  <div class="card">
    <div class="caption">workout days</div>
    <div class="heatmap-wrap">
      <div class="heatmap-wdays">
        <div></div>
        <div>M</div>
        <div></div>
        <div>W</div>
        <div></div>
        <div>F</div>
        <div></div>
      </div>
      <div id="heatmap-cols" class="heatmap-cols"></div>
    </div>
    <div class="heatmap-legend">
      <span>less</span>
      <div class="scale">
        <div style="background:#ebe1c8"></div>
        <div style="background:#ffd9c4"></div>
        <div style="background:#ffa57a"></div>
        <div style="background:#ec6638"></div>
        <div style="background:#a32a10"></div>
      </div>
      <span>more</span>
    </div>
    <script
      dangerouslySetInnerHTML={{
        __html: `
        (async () => {
          const weeks = 12;
          const r = await fetch('/api/calendar?weeks=' + weeks, { credentials: 'same-origin' });
          const root = document.getElementById('heatmap-cols');
          if (!r.ok) { root.textContent = 'load failed'; root.style.color = '#8a8170'; root.style.fontFamily = 'JetBrains Mono, monospace'; root.style.fontSize = '11px'; return; }
          const data = await r.json();
          if (!Array.isArray(data)) { root.textContent = 'load failed'; return; }
          const byDate = new Map(data.map(x => [x.date, x.volume]));
          const max = Math.max(1, ...data.map(x => x.volume));
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const today = new Date();
          const start = new Date(today);
          start.setDate(today.getDate() - (weeks * 7 - 1));
          const startDay = (start.getDay() + 6) % 7;
          start.setDate(start.getDate() - startDay);
          let lastMonth = -1;
          for (let w = 0; w < weeks + 1; w++) {
            const col = document.createElement('div');
            col.className = 'heatmap-col';
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month';
            const colDate = new Date(start);
            colDate.setDate(start.getDate() + w * 7);
            const m = colDate.getMonth();
            if (m !== lastMonth && colDate.getDate() <= 7) {
              monthLabel.textContent = months[m];
              lastMonth = m;
            }
            col.appendChild(monthLabel);
            for (let d = 0; d < 7; d++) {
              const cur = new Date(start);
              cur.setDate(start.getDate() + w * 7 + d);
              const cell = document.createElement('div');
              cell.className = 'heatmap-cell';
              if (cur > today) {
                cell.style.opacity = '0.25';
              } else {
                const key = cur.toISOString().slice(0, 10);
                const v = byDate.get(key) ?? 0;
                if (v > 0) {
                  const t = Math.min(1, Math.sqrt(v / max));
                  const lightness = 78 - 42 * t;
                  const sat = 70 + 25 * t;
                  cell.style.background = 'hsl(14 ' + sat + '% ' + lightness + '%)';
                }
                cell.title = key + '  ·  ' + v.toLocaleString() + ' kg·rep';
              }
              col.appendChild(cell);
            }
            root.appendChild(col);
          }
        })();
      `,
      }}
    />
  </div>
)
