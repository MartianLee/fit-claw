# Tailscale - private access for dashboard and SSH

## Install

```bash
brew install --cask tailscale
sudo tailscale up
```

## Restrict Dashboard To Tailnet

Add nginx/Caddy in front of `:3000`, or add a CIDR check middleware:

```ts
// src/auth/tailnet.ts
export function tailnetOnly(): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const ok = ip.startsWith('100.') // CGNAT range used by Tailscale
    if (!ok) return c.json({ error: { code: 'forbidden', message: 'tailnet only' } }, 403)
    await next()
  }
}
```

Apply to `/` and `/api/*`. Cloudflare Tunnel only exposes `/import/*`, so the dashboard does not need public ingress.

## Reach Dashboard

From your iPhone, iPad, or laptop on the tailnet:

```text
http://<mac-mini-tailnet-name>.ts.net:3000/?t=<token>
```
