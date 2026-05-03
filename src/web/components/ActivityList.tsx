import type { FC } from 'hono/jsx'

export const ActivityList: FC = () => (
  <div class="card">
    <ul class="activity" id="activity"></ul>
    <script
      dangerouslySetInnerHTML={{
        __html: `
        (async () => {
          const r = await fetch('/api/recent-activity', { credentials: 'same-origin' });
          const root = document.getElementById('activity');
          if (!r.ok) { root.innerHTML = '<div class="empty">load failed</div>'; return; }
          const rows = await r.json();
          if (!Array.isArray(rows) || rows.length === 0) {
            root.innerHTML = '<div class="empty">no sessions yet — log one to see it here</div>';
            return;
          }
          const grouped = {};
          for (const row of rows) {
            const k = row.session_id + '|' + row.exercise;
            (grouped[k] ??= { session: row.session_id, started_at: row.started_at, exercise: row.exercise, sets: [] }).sets.push(row);
          }
          const items = Object.values(grouped).sort((a,b) => b.started_at.localeCompare(a.started_at));
          for (const g of items) {
            const li = document.createElement('li');
            const when = document.createElement('div');
            when.className = 'when';
            when.textContent = g.started_at.slice(0, 16).replace('T', ' ');
            const what = document.createElement('div');
            what.className = 'what';
            what.textContent = g.exercise;
            const sets = document.createElement('div');
            sets.className = 'sets';
            sets.textContent = g.sets.map(s => s.weight_kg + '×' + s.reps).join('  ·  ');
            li.appendChild(when);
            li.appendChild(what);
            li.appendChild(sets);
            root.appendChild(li);
          }
        })();
      `,
      }}
    />
  </div>
)
