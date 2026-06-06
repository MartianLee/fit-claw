#!/usr/bin/env bash
# Read-only diagnostic for the fit-claw multi-instance / port conflict.
# Checks both 8473 (current default) and 3000 (legacy default) since a host
# mid-migration may still have old instances bound to 3000.
# Safe to run repeatedly: it inspects, copies DBs to /tmp, and prints a report.
# It changes NOTHING on the live system. Run this FIRST on the mini.
#
#   bash deploy/inspect-instances.sh
#
set -uo pipefail

say() { printf '\n=== %s ===\n' "$*"; }
TMP="$(mktemp -d /tmp/fitclaw-inspect.XXXXXX)"

for p in 8473 3000; do
  say "Who is listening on :$p"
  lsof -nP -iTCP:"$p" -sTCP:LISTEN || echo "(nothing listening on :$p)"
done

say "launchd fit-claw services (this user)"
launchctl list | grep -i fitclaw || echo "(none loaded)"

say "Docker containers"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>&1 || echo "(docker not available)"

# Locate the compose file (repo may live in a couple of places on the mini).
COMPOSE=""
for d in "$HOME/workspace/fit-claw" "$HOME/.openclaw/workspace/fit-claw" "$(pwd)"; do
  if [ -f "$d/docker-compose.yml" ]; then COMPOSE="$d/docker-compose.yml"; break; fi
done
echo "compose file: ${COMPOSE:-<not found>}"

for p in 8473 3000; do
  say "Healthz on :$p"
  curl -sS -m 5 "http://127.0.0.1:$p/healthz" || echo "(no response on :$p)"
  echo
done

# --- Inventory every fit-claw.db and snapshot it WAL-safely for inspection ---
report_db() {
  local label="$1" src="$2" snap="$TMP/$3"
  [ -f "$src" ] || { echo "  $label: MISSING ($src)"; return; }
  # .backup produces a consistent snapshot even with an active -wal.
  if sqlite3 "$src" ".backup '$snap'" 2>/dev/null; then
    local sessions checkins body maxs
    sessions=$(sqlite3 "$snap" "SELECT count(*) FROM workout_sessions;" 2>/dev/null)
    maxs=$(sqlite3 "$snap" "SELECT COALESCE(max(started_at),'-') FROM workout_sessions;" 2>/dev/null)
    checkins=$(sqlite3 "$snap" "SELECT count(*) FROM daily_checkins;" 2>/dev/null)
    body=$(sqlite3 "$snap" "SELECT count(*) FROM body_measurements;" 2>/dev/null)
    printf "  %-22s sessions=%-4s last_session=%-22s checkins=%-4s body=%-4s\n" \
      "$label" "${sessions:-?}" "$maxs" "${checkins:-?}" "${body:-?}"
    echo "     snapshot: $snap   (source: $src)"
  else
    echo "  $label: could not snapshot ($src)"
  fi
}

say "Host-side fit-claw.db files"
while IFS= read -r f; do
  report_db "host:$f" "$f" "host-$(echo "$f" | md5 -q 2>/dev/null || echo host).db"
done < <(find "$HOME" -name 'fit-claw.db' -not -path '*/node_modules/*' 2>/dev/null)

say "Docker-volume fit-claw.db"
if [ -n "$COMPOSE" ] && docker compose -f "$COMPOSE" ps >/dev/null 2>&1; then
  if docker compose -f "$COMPOSE" cp fit-claw:/app/data/fit-claw.db "$TMP/volume-fit-claw.db" 2>/dev/null; then
    report_db "docker-volume" "$TMP/volume-fit-claw.db" "volume-snap.db"
  else
    echo "  (could not copy from container — is it running?)"
  fi
else
  echo "  (compose not usable; skipping)"
fi

say "VERDICT"
cat <<EOF
Compare 'last_session' across the rows above.
  - The row with the most recent last_session (and highest counts) is the CANONICAL DB.
  - Under A안 the canonical DB must end up inside the docker volume.
  - Snapshots are in: $TMP  (consistent copies — use these for any migration)
Next: follow deploy/cutover-to-docker.md, steps 2-6.
EOF
