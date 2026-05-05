FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/fit-claw.db

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "const port = process.env.PORT || '3000'; const r = await fetch('http://127.0.0.1:' + port + '/healthz'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", "run", "start"]
