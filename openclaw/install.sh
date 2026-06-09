#!/usr/bin/env bash
#
# Install/refresh the fit-claw skill into a local OpenClaw gateway.
#
# Run on the OpenClaw host, from anywhere inside the repo:
#   bash openclaw/install.sh
#
# Idempotent & safe to re-run:
#   - reuses an existing fit-claw token if one is already configured
#   - backs up openclaw.json before editing
#
# Overridable via env:
#   FIT_CLAW_API_URL   (default http://127.0.0.1:8473)  — the fit-claw instance to target
#   FIT_CLAW_LABEL     (default openclaw)                — label for a newly issued token
#   OPENCLAW_HOME      (default ~/.openclaw)             — OpenClaw config dir
#
# Note: a token is valid only in the DB of the targeted instance. The default
# URL (8473) is the launchd `com.fitclaw.api` instance, whose DB this repo's
# `scripts/new-token.ts` writes to. If you point FIT_CLAW_API_URL at a different
# instance (e.g. the Docker container), issue the token against that instance.

set -euo pipefail

API_URL="${FIT_CLAW_API_URL:-http://127.0.0.1:8473}"
TOKEN_LABEL="${FIT_CLAW_LABEL:-openclaw}"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
CFG="$OPENCLAW_HOME/openclaw.json"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$REPO/openclaw/fit-claw"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# --- preflight -------------------------------------------------------------
for bin in jq openclaw bun curl; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' not found on PATH"
done
[ -f "$SKILL_DIR/SKILL.md" ] || die "skill not found at $SKILL_DIR"
[ -f "$CFG" ] || die "openclaw config not found at $CFG"

# --- 1. token (idempotent) -------------------------------------------------
say "Resolving fit-claw token"
TOKEN="$(jq -r '.skills.entries["fit-claw"].env.FIT_CLAW_API_KEY // empty' "$CFG")"
if [ -n "$TOKEN" ]; then
  echo "Reusing existing token from openclaw.json (…${TOKEN: -6})"
else
  echo "No token configured — issuing a new one (label: $TOKEN_LABEL)"
  TOKEN="$(cd "$REPO" && bun run scripts/new-token.ts "$TOKEN_LABEL" | tail -n1)"
  [ -n "$TOKEN" ] || die "token issuance produced no output"
  echo "Issued new token (…${TOKEN: -6})"
fi

# --- 2. install the skill package ------------------------------------------
say "Installing skill from $SKILL_DIR"
openclaw skills install "$SKILL_DIR"

# --- 3. configure env (enabled + URL + token), with backup -----------------
say "Configuring skills.entries.fit-claw in $CFG"
BACKUP="$CFG.bak.$(date +%Y%m%d-%H%M%S)"
cp "$CFG" "$BACKUP"
echo "Backup: $BACKUP"

TMP="$(mktemp)"
jq --arg url "$API_URL" --arg key "$TOKEN" '
  .skills //= {} | .skills.entries //= {} |
  .skills.entries["fit-claw"] = ((.skills.entries["fit-claw"] // {}) + {
    enabled: true,
    env: ((.skills.entries["fit-claw"].env // {}) + {
      FIT_CLAW_API_URL: $url,
      FIT_CLAW_API_KEY: $key
    })
  })
' "$CFG" > "$TMP"
jq -e . "$TMP" >/dev/null || die "patched config is not valid JSON (left backup at $BACKUP)"
mv "$TMP" "$CFG"
echo "enabled=true  FIT_CLAW_API_URL=$API_URL  FIT_CLAW_API_KEY=…${TOKEN: -6}"

# --- 4. restart the gateway ------------------------------------------------
say "Restarting OpenClaw gateway"
if launchctl print "gui/$(id -u)/ai.openclaw.gateway" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/ai.openclaw.gateway"
  echo "kickstarted ai.openclaw.gateway"
else
  echo "launchd service ai.openclaw.gateway not found — restart the gateway manually."
fi

# --- 5. verify -------------------------------------------------------------
say "Verifying"
echo -n "fit-claw API healthz: "
curl -fsS -m 5 "$API_URL/healthz" || die "fit-claw not reachable at $API_URL"
echo
echo "openclaw skills check (fit-claw):"
openclaw skills check 2>&1 | grep -i "fit-claw" || echo "(fit-claw not shown — run 'openclaw skills list' to inspect)"

say "Done. The OpenClaw agent can now call fit-claw."
