# Tailscale - private access for dashboard and SSH

The dashboard has no public ingress. The intended deployment makes it reachable only over your tailnet, while Cloudflare Tunnel handles the narrow `/import/*` public path (see `cloudflared.md`).

## Install

```bash
brew install --cask tailscale
sudo tailscale up
```

## Reach The Dashboard

From your iPhone, iPad, or laptop on the tailnet:

```text
http://<mac-mini-tailnet-name>.ts.net:3000/?t=<token>
```

The first request with `?t=<token>` rotates the token into an `HttpOnly; SameSite=Strict` `fc_session` cookie and 303-redirects to `/`. The token is no longer kept in the browser URL or referer headers after that.

## Network Boundaries

There is **no app-layer tailnet IP check**. The boundaries are:

1. **Bind address** — the API listens on `:3000` of the host. Do not publish that port to `0.0.0.0` on a network with untrusted neighbors. On a Mac mini at home this is normally fine.
2. **Cloudflare Tunnel ingress rules** — only `/import/*` is exposed publicly (see `cloudflared.md`).
3. **Bearer + session cookie** — every protected route checks `Authorization: Bearer <token>` or the `fc_session` cookie. `/tools/*`, `/import/*`, and `/api/*` reject `?t=...` query tokens.

If you want defense-in-depth at the network layer, run a reverse proxy (nginx or Caddy) on the host and restrict to the Tailscale CGNAT range `100.64.0.0/10`. Example Caddy snippet:

```caddy
:3000 {
  @tailnet remote_ip 100.64.0.0/10 127.0.0.1/32
  handle @tailnet {
    reverse_proxy 127.0.0.1:3001
  }
  respond 403
}
```

Then change the app to listen on `127.0.0.1:3001` (set `PORT=3001` and bind explicitly if you fork `Bun.serve`). This is optional; the app does not assume it is in place.

## Verify

```bash
tailscale status
curl http://<mac-mini-tailnet-name>.ts.net:3000/healthz
```
