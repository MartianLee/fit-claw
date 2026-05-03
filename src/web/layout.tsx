import type { FC, PropsWithChildren } from 'hono/jsx'

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({ title, children }) => (
  <html lang="ko">
    <head>
      <title>{title ?? 'fit-claw'}</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&family=Noto+Serif+KR:wght@400;500;700&display=swap"
      />
      <script src="/static/htmx.min.js"></script>
      <script src="/static/chart.umd.min.js"></script>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          --bg: #f4ecd8;
          --bg-raised: #fffaf0;
          --bg-deep: #ebe1c8;
          --ink: #110e08;
          --ink-soft: #3a342a;
          --ink-muted: #8a8170;
          --line: #1d1810;
          --line-soft: #d3c7a7;
          --accent: #e8421e;
          --accent-deep: #a32a10;
          --accent-soft: #ffb898;
          --positive: #2f6b2a;
          --indigo: #1e3a8a;
          --serif: 'Fraunces', 'Noto Serif KR', ui-serif, Georgia, serif;
          --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
          --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }

        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: var(--sans);
          background: var(--bg);
          color: var(--ink);
          font-feature-settings: 'ss01', 'cv11';
          -webkit-font-smoothing: antialiased;
          background-image:
            radial-gradient(ellipse 70% 40% at 80% 0%, rgba(232, 66, 30, 0.10), transparent 60%),
            radial-gradient(ellipse 60% 50% at 10% 100%, rgba(30, 58, 138, 0.06), transparent 60%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          min-height: 100vh;
        }

        main { max-width: 1100px; margin: 0 auto; padding: 64px 32px 120px; }

        ::selection { background: var(--accent); color: var(--bg-raised); }

        /* Masthead */
        .masthead {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: end;
          padding-bottom: 28px;
          border-bottom: 3px solid var(--ink);
          margin-bottom: 48px;
          position: relative;
        }
        .masthead::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: -8px;
          height: 1px; background: var(--ink);
        }
        .masthead .brand {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 88px;
          letter-spacing: -0.045em;
          line-height: 0.92;
          font-variation-settings: 'opsz' 144, 'SOFT' 30, 'WONK' 1;
          color: var(--ink);
        }
        .masthead .brand em {
          font-style: italic;
          color: var(--accent);
          font-weight: 700;
          font-variation-settings: 'opsz' 144, 'SOFT' 100, 'WONK' 1;
        }
        .masthead .meta {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--ink);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-align: right;
          line-height: 1.7;
          font-weight: 500;
        }
        .masthead .meta .accent {
          display: inline-block;
          background: var(--ink);
          color: var(--bg);
          padding: 2px 8px;
          margin-bottom: 6px;
        }

        /* Section header */
        .section { margin-top: 64px; }
        .section-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
          margin-bottom: 22px;
        }
        .section-head .num {
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 700;
          color: var(--bg-raised);
          background: var(--accent);
          letter-spacing: 0.08em;
          padding: 4px 10px;
          border-radius: 1px;
        }
        .section-head .title {
          font-family: var(--serif);
          font-size: 32px;
          font-weight: 600;
          letter-spacing: -0.02em;
          font-variation-settings: 'opsz' 48;
          line-height: 1;
        }
        .section-head .title em {
          font-style: italic;
          color: var(--ink-soft);
          font-weight: 500;
        }
        .section-head .rule {
          height: 2px;
          background: var(--ink);
        }
        .section-head .aside {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 500;
          padding: 4px 8px;
          border: 1.5px solid var(--ink);
        }

        /* Hero stat row */
        .hero {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 0;
          border: 2.5px solid var(--ink);
          background: var(--bg-raised);
          box-shadow: 8px 8px 0 var(--ink);
        }
        .hero .stat {
          padding: 32px 28px;
          border-right: 2px solid var(--ink);
          position: relative;
          background: var(--bg-raised);
        }
        .hero .stat:last-child { border-right: none; }
        .hero .stat.primary {
          padding: 36px 32px;
          background: var(--accent);
          color: var(--bg-raised);
        }
        .hero .stat.primary .label { color: rgba(255, 250, 240, 0.85); }
        .hero .stat.primary .value { color: var(--bg-raised); }
        .hero .stat.primary .unit { color: rgba(255, 250, 240, 0.7); }
        .hero .stat.primary .sub { color: rgba(255, 250, 240, 0.7); }

        .stat .label {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-soft);
          text-transform: uppercase;
          letter-spacing: 0.16em;
          margin-bottom: 16px;
          font-weight: 700;
        }
        .stat .value {
          font-family: var(--serif);
          font-size: 56px;
          font-weight: 700;
          line-height: 0.95;
          letter-spacing: -0.035em;
          font-variation-settings: 'opsz' 144, 'WONK' 1;
          font-variant-numeric: tabular-nums;
          color: var(--ink);
        }
        .stat.primary .value {
          font-size: 84px;
        }
        .stat .unit {
          font-family: var(--mono);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-muted);
          margin-left: 8px;
          letter-spacing: 0.04em;
        }
        .stat .sub {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-muted);
          margin-top: 14px;
          letter-spacing: 0.08em;
          font-weight: 500;
          text-transform: uppercase;
        }
        .stat .empty { color: var(--ink-muted); font-style: italic; }

        /* Card (chart container) */
        .card {
          border: 2.5px solid var(--ink);
          padding: 28px 32px 32px;
          background: var(--bg-raised);
          box-shadow: 6px 6px 0 var(--ink);
        }
        .card .caption {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 22px;
          font-weight: 700;
          padding-bottom: 12px;
          border-bottom: 1.5px solid var(--ink);
        }
        canvas { width: 100% !important; }

        @media (max-width: 760px) {
          .hero { grid-template-columns: 1fr 1fr; box-shadow: 4px 4px 0 var(--ink); }
          .hero .stat:nth-child(1) { grid-column: 1 / -1; border-right: none; border-bottom: 2px solid var(--ink); }
          .hero .stat:nth-child(2) { border-right: none; }
          main { padding: 32px 20px 64px; }
          .masthead .brand { font-size: 56px; }
          .section-head .title { font-size: 24px; }
        }

        /* Calendar heatmap */
        .heatmap-wrap {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          margin-top: 4px;
        }
        .heatmap-wdays {
          display: grid;
          grid-template-rows: repeat(7, 16px);
          gap: 4px;
          padding-top: 22px;
          font-family: var(--mono);
          font-size: 10px;
          color: var(--ink-soft);
          letter-spacing: 0.06em;
          font-weight: 700;
          text-transform: uppercase;
        }
        .heatmap-wdays div { height: 16px; line-height: 16px; }
        .heatmap-cols {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: 16px;
          gap: 4px;
        }
        .heatmap-col {
          display: grid;
          grid-template-rows: 16px repeat(7, 16px);
          gap: 4px;
        }
        .heatmap-col .month {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.06em;
          line-height: 16px;
          text-transform: uppercase;
        }
        .heatmap-cell {
          width: 16px;
          height: 16px;
          background: var(--bg-deep);
          border: 1.5px solid var(--ink);
          transition: transform 0.12s ease;
        }
        .heatmap-cell:hover { transform: scale(1.5); z-index: 2; position: relative; }
        .heatmap-legend {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          font-family: var(--mono);
          font-size: 10px;
          color: var(--ink);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .heatmap-legend .scale { display: flex; gap: 4px; }
        .heatmap-legend .scale div {
          width: 14px;
          height: 14px;
          border: 1.5px solid var(--ink);
        }

        /* Activity list */
        .activity { list-style: none; padding: 0; margin: 0; }
        .activity li {
          padding: 18px 0;
          border-bottom: 1.5px solid var(--ink);
          display: grid;
          grid-template-columns: 110px 1fr auto;
          gap: 24px;
          align-items: baseline;
        }
        .activity li:last-child { border-bottom: none; padding-bottom: 4px; }
        .activity .when {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .activity .what {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.015em;
          line-height: 1.1;
          color: var(--ink);
          font-variation-settings: 'opsz' 36;
        }
        .activity .what em {
          font-style: italic;
          color: var(--ink-soft);
          font-weight: 500;
        }
        .activity .sets {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          text-align: right;
          font-weight: 500;
          background: var(--bg-deep);
          padding: 6px 10px;
          border: 1.5px solid var(--ink);
        }
        .activity .empty {
          padding: 32px 0;
          color: var(--ink-muted);
          font-style: italic;
          font-family: var(--serif);
          font-size: 18px;
          text-align: center;
        }

        /* Footer */
        .colophon {
          margin-top: 96px;
          padding-top: 28px;
          border-top: 3px solid var(--ink);
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-align: center;
          font-weight: 700;
        }
        .colophon .dot { color: var(--accent); }

        /* Page-load reveal */
        @keyframes rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reveal { opacity: 0; animation: rise 0.7s cubic-bezier(0.2, 0.6, 0.2, 1) forwards; }
        .r1 { animation-delay: 0.05s; }
        .r2 { animation-delay: 0.18s; }
        .r3 { animation-delay: 0.32s; }
        .r4 { animation-delay: 0.46s; }
        .r5 { animation-delay: 0.60s; }
      `,
        }}
      />
    </head>
    <body>
      <main>{children}</main>
    </body>
  </html>
)
