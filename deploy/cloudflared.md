# Cloudflare Tunnel - public ingress for /import/*

## Install

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create fit-claw
```

## Config (`~/.cloudflared/config.yml`)

```yaml
tunnel: fit-claw
credentials-file: /Users/dede/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.fit-claw.<your-domain>
    path: /import/.*
    service: http://localhost:3000
  - service: http_status:404
```

## DNS

```bash
cloudflared tunnel route dns fit-claw api.fit-claw.<your-domain>
```

## Run As Service

```bash
sudo cloudflared service install
```

## Verify

From another network, such as LTE:

```bash
curl -X POST https://api.fit-claw.<your-domain>/import/health \
  -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d '{"samples":[{"date":"2026-05-03","sleep_hours":7.1}]}'
```

The v2 `/import/health` endpoint does not exist yet, so expect `404` after bearer auth succeeds.
