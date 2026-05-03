import type { FC } from 'hono/jsx'

export const ActivityList: FC<{ token: string }> = ({ token }) => (
  <div class="card">
    <div class="label">recent activity (7 days)</div>
    <ul class="activity" id="activity"></ul>
    <script
      dangerouslySetInnerHTML={{
        __html: `
      (async () => {
        const r = await fetch('/api/recent-activity', { headers: { authorization: 'Bearer ${token}' } });
        const rows = await r.json();
        const root = document.getElementById('activity');
        const grouped = {};
        for (const r of rows) {
          const k = r.session_id + '|' + r.exercise;
          (grouped[k] ??= { session: r.session_id, started_at: r.started_at, exercise: r.exercise, sets: [] }).sets.push(r);
        }
        for (const g of Object.values(grouped)) {
          const li = document.createElement('li');
          const summary = g.sets.map(s => s.weight_kg + 'x' + s.reps).join(', ');
          li.textContent = g.started_at.slice(0, 16).replace('T', ' ') + '  ' + g.exercise + '  ' + summary;
          root.appendChild(li);
        }
      })();
    `,
      }}
    />
  </div>
)
