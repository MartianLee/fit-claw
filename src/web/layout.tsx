import type { FC, PropsWithChildren } from 'hono/jsx'

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({ title, children }) => (
  <html>
    <head>
      <title>{title ?? 'fit-claw'}</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="/static/htmx.min.js"></script>
      <script src="/static/chart.umd.min.js"></script>
      <style>{`
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #0b0d10; color: #e6e8eb; }
        main { max-width: 960px; margin: 0 auto; padding: 24px; }
        h1 { font-size: 20px; }
        .grid { display: grid; gap: 16px; }
        .cards { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        .card { background: #14171c; border: 1px solid #1f242b; border-radius: 8px; padding: 16px; }
        .stat { font-size: 28px; font-weight: 600; }
        .label { color: #8a93a0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
        canvas { width: 100% !important; }
        ul.activity { list-style: none; padding: 0; }
        ul.activity li { padding: 8px 0; border-bottom: 1px solid #1f242b; font-variant-numeric: tabular-nums; }
        .heatmap { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 14px); gap: 2px; }
        .heatmap div { width: 14px; height: 14px; background: #1f242b; border-radius: 2px; }
      `}</style>
    </head>
    <body>
      <main>{children}</main>
    </body>
  </html>
)
